// Every example in the learning library runs and prints the output it promises, in every
// language this machine can run: JavaScript and TypeScript through the CodeLens interpreter
// (TypeScript compiled the way the worker compiles it), Python with the real interpreter,
// C# and C++ through the desktop tracers (skipped where the .NET SDK or GDB is missing).
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from '../../../engines/js/interpreter/interpreter.js'
import { LIBRARY } from './library'
import { compileTypeScript } from './interpreter/typescriptCompiler'
import type { ExecutionResult } from './types'

const require = createRequire(import.meta.url)
const python = ['python', 'python3', 'py'].find(cmd => spawnSync(cmd, ['--version']).status === 0)
const hasDotnet = (spawnSync('dotnet', ['--list-sdks']).stdout?.toString().trim().length ?? 0) > 0
const hasGdb = spawnSync('gdb', ['-batch', '-nx', '-ex', 'python print(1)']).status === 0 && spawnSync('g++', ['--version']).status === 0
const desktop = hasDotnet || hasGdb ? require('../../../../desktop/app/runtimes/codelens.cjs') : null
const app = { getPath: () => path.join(os.tmpdir(), 'opencalc-codelens-test') }

function traceOnDesktop(lang: 'csharp' | 'cpp', source: string): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    desktop.runCode(app, JSON.stringify({ lang, source }), (event: any) => {
      if (event.stream === 'stdout') stdout += event.text
      if (event.stream === 'exit') resolve(JSON.parse(stdout))
    }).then((res: any) => { if (!res.ok) reject(new Error(res.reason)) })
  })
}

const variants = (lang: string) => LIBRARY.flatMap(example => {
  const variant = example.variants[lang as keyof typeof example.variants]
  return variant ? [[example.id, variant] as const] : []
})

describe('CodeLens learning library', () => {
  it('has the teaching notes every example needs', () => {
    for (const example of LIBRARY) {
      expect(example.concept.length, example.id).toBeGreaterThan(80)
      expect(example.watch.length, example.id).toBeGreaterThan(0)
      expect(example.exercises.length, example.id).toBeGreaterThan(0)
      expect(Object.keys(example.variants).length, example.id).toBeGreaterThan(0)
    }
    expect(new Set(LIBRARY.map(e => e.id)).size).toBe(LIBRARY.length)
  })

  it.each(variants('js'))('%s: JavaScript prints its expected output', (_id, variant) => {
    const result = run(variant.code) as { error: unknown; output: string[] }
    expect(result.error).toBeNull()
    expect(result.output).toEqual(variant.output)
  })

  it.each(variants('ts'))('%s: TypeScript compiles and prints its expected output', (_id, variant) => {
    const compiled = compileTypeScript(variant.code)
    expect(compiled.diagnostics.filter(d => d.category === 'error')).toEqual([])
    const result = run(compiled.code) as { error: unknown; output: string[] }
    expect(result.error).toBeNull()
    expect(result.output).toEqual(variant.output)
  })

  it.skipIf(!python).each(variants('py'))('%s: Python prints its expected output', (_id, variant) => {
    const result = spawnSync(python!, ['-c', variant.code], { encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.stdout.replace(/\r\n/g, '\n').trimEnd().split('\n')).toEqual(variant.output)
  })

  it.skipIf(!hasDotnet).each(variants('cs'))('%s: C# traces and prints its expected output', async (_id, variant) => {
    const result = await traceOnDesktop('csharp', variant.code)
    expect(result.error).toBeNull()
    expect(result.status).toBe('completed')
    expect(result.output).toEqual(variant.output)
  }, 120_000)

  it.skipIf(!hasGdb).each(variants('cpp'))('%s: C++ traces and prints its expected output', async (_id, variant) => {
    const result = await traceOnDesktop('cpp', variant.code)
    expect(result.error).toBeNull()
    expect(result.status).toBe('completed')
    expect(result.output).toEqual(variant.output)
  }, 120_000)
})
