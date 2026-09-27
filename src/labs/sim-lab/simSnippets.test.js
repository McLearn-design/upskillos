import { describe, expect, it } from 'vitest'
import { DEFAULT_SIM_SNIPPET, SIM_SNIPPETS } from './simSnippets.js'
import { SIM_TEMPLATES } from './simTemplates.js'

describe('Sim Lab starter and snippet library', () => {
  const snippets = SIM_SNIPPETS.flatMap(category => category.items)

  it('starts with blank boilerplate instead of a completed example', () => {
    expect(SIM_TEMPLATES[0]).toMatchObject({ key: 'blank-3d', group: 'Starter', mode: '3d' })
    expect(SIM_TEMPLATES[0].code).toContain('function init()')
    expect(SIM_TEMPLATES[0].code).toContain('function update(dt)')
    expect(SIM_TEMPLATES[0].code).not.toContain('new THREE.Mesh(')
  })

  it('gives every snippet unique code, teaching text, and a runnable preview', () => {
    expect(snippets.length).toBeGreaterThanOrEqual(60)
    expect(new Set(snippets.map(snippet => snippet.key)).size).toBe(snippets.length)
    for (const snippet of snippets) {
      expect(snippet.code.trim().length).toBeGreaterThan(10)
      expect(snippet.summary.trim().length).toBeGreaterThan(20)
      expect(snippet.explanation.length).toBeGreaterThan(0)
      expect(snippet.walkthrough.length).toBeGreaterThan(0)
      expect(snippet.walkthrough.every(step => step.lines && step.title && step.detail)).toBe(true)
      const lineCount = snippet.code.split('\n').length
      for (const step of snippet.walkthrough) {
        const bounds = step.lines.split(/[–-]/).map(value => Number.parseInt(value, 10))
        expect(bounds[0]).toBeGreaterThanOrEqual(1)
        expect(bounds.at(-1)).toBeLessThanOrEqual(lineCount)
      }
      expect(snippet.concepts.length).toBeGreaterThan(0)
      expect(['Beginner', 'Intermediate', 'Advanced']).toContain(snippet.level)
      expect(['2d', '3d', 'html']).toContain(snippet.mode)
      if (snippet.mode !== 'html') {
        expect(snippet.previewCode).toContain('function init()')
        expect(snippet.previewCode).toContain('function update(dt)')
      }
      expect(() => new Function(snippet.code)).not.toThrow()
      expect(() => new Function(snippet.previewCode)).not.toThrow()
    }
  })

  it('covers the requested advanced learning areas', () => {
    const categories = SIM_SNIPPETS.map(category => category.category)
    expect(categories).toEqual(expect.arrayContaining([
      'Camera',
      'Lighting & Materials',
      'Rotation & Linear Algebra',
      'Collisions & Dynamics',
      'Effects & Custom Drawing',
      'Controls & Interaction',
      'SVG',
      'Simulation Projects',
    ]))
    expect(snippets.some(snippet => snippet.key === 'quaternion-slerp')).toBe(true)
    expect(snippets.some(snippet => snippet.key === 'svg-interactive-nodes')).toBe(true)
  })

  it('uses a real library entry as the initial modal selection', () => {
    expect(snippets).toContain(DEFAULT_SIM_SNIPPET)
  })
})
