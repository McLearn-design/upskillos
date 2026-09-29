import ts from 'typescript'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import type { CompilerDiagnostic, SourceLocation, StackFrame, TraceEvent } from '../types'

const SOURCE_FILE = 'codelens.ts'

export interface TypeScriptCompilation {
  code: string
  diagnostics: CompilerDiagnostic[]
  mapPosition: (line: number, column?: number) => SourceLocation
}

const stripExports: ts.TransformerFactory<ts.SourceFile> = context => {
  const visit: ts.Visitor = node => {
    if (ts.isExportDeclaration(node)) return undefined
    if (ts.isExportAssignment(node)) {
      return ts.factory.createExpressionStatement(node.expression)
    }
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node)
      if (modifiers?.some(modifier => (
        modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword
      ))) {
        const kept = modifiers.filter(modifier => (
          modifier.kind !== ts.SyntaxKind.ExportKeyword && modifier.kind !== ts.SyntaxKind.DefaultKeyword
        ))
        return ts.visitEachChild(ts.factory.replaceModifiers(node, kept), visit, context)
      }
    }
    return ts.visitEachChild(node, visit, context)
  }
  return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile
}

function diagnosticCategory(category: ts.DiagnosticCategory): CompilerDiagnostic['category'] {
  if (category === ts.DiagnosticCategory.Error) return 'error'
  if (category === ts.DiagnosticCategory.Warning) return 'warning'
  return 'message'
}

function formatDiagnostic(diagnostic: ts.Diagnostic): CompilerDiagnostic {
  const start = diagnostic.start ?? 0
  const position = diagnostic.file?.getLineAndCharacterOfPosition(start)
  return {
    category: diagnosticCategory(diagnostic.category),
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    line: position ? position.line + 1 : null,
    column: position ? position.character + 1 : null,
  }
}

export function compileTypeScript(source: string): TypeScriptCompilation {
  const result = ts.transpileModule(source, {
    fileName: SOURCE_FILE,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      sourceMap: true,
      inlineSources: true,
      removeComments: false,
      useDefineForClassFields: false,
    },
    // TypeScript may synthesize an export list after the type-erasing pass
    // when the original source was a module, so remove module syntax both
    // before and after the built-in transform.
    transformers: { before: [stripExports], after: [stripExports] },
  })

  const diagnostics = (result.diagnostics ?? []).map(formatDiagnostic)
  const sourceMap = result.sourceMapText ? new TraceMap(result.sourceMapText) : null
  const code = result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/m, '')

  return {
    code,
    diagnostics,
    mapPosition: (line, column = 0) => {
      if (!sourceMap) return { file: SOURCE_FILE, line, column }
      const original = originalPositionFor(sourceMap, { line, column })
      return {
        file: original.source ?? SOURCE_FILE,
        line: original.line ?? line,
        column: original.column ?? column,
      }
    },
  }
}

export function remapTraceEvent(
  event: TraceEvent,
  mapPosition: TypeScriptCompilation['mapPosition'],
): TraceEvent {
  const sourceLocation = event.sourceLocation
    ? { ...event.sourceLocation, ...mapPosition(event.sourceLocation.line, event.sourceLocation.column ?? 0) }
    : event.sourceLocation

  const stackSnapshot = event.stackSnapshot?.map((frame): StackFrame => (
    frame.line == null ? frame : { ...frame, line: mapPosition(frame.line, 0).line }
  ))

  return {
    ...event,
    sourceLocation,
    ...(stackSnapshot ? { stackSnapshot } : {}),
  }
}
