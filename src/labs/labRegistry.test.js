import { describe, expect, it } from 'vitest'

// A lab is reachable in one of two ways (docs/catalog-discovery.md):
// - an index.jsx/index.tsx, opened as a window at #/lab/<key> (EntryShell), or
// - routes plus a component in meta.js, mounted as full pages by App.jsx.
// A lab with neither shows "Lab not found" and nothing else says so.
const METAS = import.meta.glob('./*/meta.js', { eager: true })
const ENTRIES = import.meta.glob('./*/index.{jsx,tsx}')

const labKey = (path) => path.split('/')[1]
const hasEntry = new Set(Object.keys(ENTRIES).map(labKey))

describe('lab registry', () => {
  const labs = Object.entries(METAS).map(([path, mod]) => ({ key: labKey(path), meta: mod.default }))

  it('finds the labs', () => {
    expect(labs.length).toBeGreaterThan(0)
  })

  it.each(labs.map((lab) => [lab.key, lab]))('%s can be opened', (_key, { key, meta }) => {
    const hasRoutes = Array.isArray(meta?.routes) && meta.routes.length > 0 && Boolean(meta.component)
    expect(hasEntry.has(key) || hasRoutes, `${key}: add index.jsx/index.tsx, or routes and component in meta.js`).toBe(true)
  })
})
