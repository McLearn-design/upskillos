// What kind of statement each line of a JavaScript or TypeScript program is, for the
// line-by-line explanations (explainTrace.ts). Produces the same kinds and fields as the
// Python tracer (interpreter/python/codelens_tracer.py statement_info) and the C/C++
// tracer, so one explainer serves every language. Keyed by line: TypeScript runs as
// compiled JavaScript, but its trace lines are mapped back to the TypeScript source,
// which is what is parsed here.
import { parse as babelParse } from '@babel/parser'

export interface StatementInfo {
  kind: string
  code: string
  body?: [number, number]
  orelse?: [number, number]
  targets?: string[]
  iterable?: string
  condition?: string
  operator?: string
  init?: string
  update?: string
  name?: string
  call?: string
  expression?: string
  isElif?: boolean
  prints?: boolean
}

type Node = { type: string; start: number; end: number; loc: { start: { line: number }; end: { line: number } }; [key: string]: any }

const AUG_OPERATORS: Record<string, string> = {
  '+=': 'Add', '-=': 'Sub', '*=': 'Mult', '/=': 'Div', '%=': 'Mod', '**=': 'Pow', '|=': 'BitOr', '&=': 'BitAnd', '^=': 'BitXor',
}

function span(node: Node | null | undefined): [number, number] | undefined {
  if (!node) return undefined
  // A block's statements: from its first statement to its closing line.
  if (node.type === 'BlockStatement') {
    if (!node.body.length) return [node.loc.start.line, node.loc.end.line]
    return [node.body[0].loc.start.line, node.loc.end.line]
  }
  return [node.loc.start.line, node.loc.end.line]
}

function targetNames(node: Node, source: string): string[] {
  if (node.type === 'Identifier') return [node.name]
  if (node.type === 'ArrayPattern') return node.elements.filter(Boolean).flatMap((n: Node) => targetNames(n, source))
  if (node.type === 'ObjectPattern') return node.properties.flatMap((p: Node) => targetNames(p.value ?? p.argument ?? p, source))
  if (node.type === 'RestElement') return targetNames(node.argument, source)
  if (node.type === 'AssignmentPattern') return targetNames(node.left, source)
  return [source.slice(node.start, node.end)]
}

/** Key for a statement: its line and its syntax-node type, since several statements can
 *  start on one line (a for loop, its `let i = 0`, and its body's `{`). */
export const statementKey = (line: number, nodeType: string) => `${line}:${nodeType}`

export function jsStatementInfo(source: string): Map<string, StatementInfo> {
  const info = new Map<string, StatementInfo>()
  let program: Node
  try {
    program = babelParse(source, { sourceType: 'module', plugins: ['typescript'], errorRecovery: true }).program as unknown as Node
  } catch {
    return info
  }
  const lines = source.split('\n')
  const text = (node: Node) => source.slice(node.start, node.end)
  const lineCode = (line: number) => {
    const code = (lines[line - 1] ?? '').trim()
    return code.length <= 120 ? code : code.slice(0, 119) + '…'
  }

  const visit = (node: Node | null | undefined, isElif = false) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(child => visit(child)); return }
    if (!node.type) return
    const add = (entry: Omit<StatementInfo, 'code'>, keyNode: Node = node) => {
      const key = statementKey(keyNode.loc?.start.line, keyNode.type)
      if (keyNode.loc && !info.has(key)) info.set(key, { code: lineCode(keyNode.loc.start.line), ...entry })
    }

    switch (node.type) {
      case 'VariableDeclaration':
        add({ kind: 'Assign', targets: node.declarations.flatMap((d: Node) => targetNames(d.id, source)) })
        break
      case 'ExpressionStatement': {
        const expr = node.expression
        if (expr.type === 'AssignmentExpression') {
          add(expr.operator === '='
            ? { kind: 'Assign', targets: targetNames(expr.left, source) }
            : { kind: 'AugAssign', targets: targetNames(expr.left, source), operator: AUG_OPERATORS[expr.operator] ?? expr.operator })
        } else if (expr.type === 'UpdateExpression') {
          add({ kind: 'AugAssign', targets: targetNames(expr.argument, source), operator: expr.operator === '++' ? 'Increment' : 'Decrement' })
        } else if (expr.type === 'CallExpression' || expr.type === 'AwaitExpression' && expr.argument?.type === 'CallExpression') {
          const call = expr.type === 'CallExpression' ? expr : expr.argument
          const callee = text(call.callee)
          add({ kind: 'Expr', call: callee, ...(/^console\.(log|info|warn|error)$/.test(callee) ? { prints: true } : {}) })
        } else {
          add({ kind: 'Expr' })
        }
        break
      }
      case 'IfStatement':
        add({ kind: 'If', condition: text(node.test), body: span(node.consequent), orelse: span(node.alternate), isElif })
        visit(node.consequent)
        visit(node.alternate, node.alternate?.type === 'IfStatement')
        return
      case 'ForStatement':
        if (node.init?.type === 'VariableDeclaration') {
          // The interpreter runs the loop's `let i = 0` as a statement of its own.
          add({ kind: 'Assign', targets: node.init.declarations.flatMap((d: Node) => targetNames(d.id, source)) }, node.init)
        }
        add({
          kind: 'CFor',
          init: node.init ? text(node.init) : '',
          condition: node.test ? text(node.test) : 'true',
          update: node.update ? text(node.update) : '',
          body: span(node.body),
        })
        visit(node.body)
        return
      case 'ForOfStatement':
      case 'ForInStatement': {
        const left = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left
        add({ kind: 'For', targets: targetNames(left, source), iterable: text(node.right), body: span(node.body) })
        visit(node.body)
        return
      }
      case 'WhileStatement':
        add({ kind: 'While', condition: text(node.test), body: span(node.body) })
        visit(node.body)
        return
      case 'DoWhileStatement':
        add({ kind: 'DoWhile', condition: text(node.test), body: span(node.body) })
        visit(node.body)
        return
      case 'ReturnStatement':
        add({ kind: 'Return', ...(node.argument ? { expression: text(node.argument) } : {}) })
        break
      case 'FunctionDeclaration':
        add({ kind: 'FunctionDef', name: node.id?.name ?? 'function' })
        visit(node.body)
        return
      case 'ClassDeclaration':
        add({ kind: 'ClassDef', name: node.id?.name ?? 'class' })
        visit(node.body)
        return
      case 'ClassMethod':
      case 'ClassPrivateMethod':
        visit(node.body)
        return
      case 'BreakStatement':
        add({ kind: 'Break' }); break
      case 'ContinueStatement':
        add({ kind: 'Continue' }); break
      case 'ThrowStatement':
        add({ kind: 'Raise', expression: text(node.argument) }); break
      case 'BlockStatement':
        node.body.forEach((child: Node) => visit(child))
        return
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        visit(node.declaration)
        return
    }
    // Statements nested inside expressions (callbacks, arrow functions with block bodies).
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue
      if (value && typeof value === 'object') visit(value as Node)
    }
  }
  visit(program.body as unknown as Node)
  return info
}
