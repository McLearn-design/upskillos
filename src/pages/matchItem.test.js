// The home page's search (matchItem): names win over category words.
import { describe, expect, it } from 'vitest'
import { matchItem } from './HomePage.jsx'

const studio = { label: 'Game Studio', desc: 'A browser game engine in the spirit of Godot', tags: ['Game Dev'] }
const builder = { kind: 'builder' }

describe('matchItem', () => {
  it('finds an item by its name even when the name contains a category word ("game studio" is a builder)', () => {
    for (const q of ['game studio', 'Game Studio', 'game st', 'studio']) expect(matchItem(studio, q, builder), q).toBe(true)
  })
  it('still uses category words to narrow other searches: "games about physics" keeps games only', () => {
    expect(matchItem({ label: 'Rocket Lab', tags: ['physics'] }, 'games about physics', { kind: 'lab' })).toBe(false)
    expect(matchItem({ label: 'Orbit Run', tags: ['physics'] }, 'games about physics', { kind: 'game' })).toBe(true)
  })
  it('a bare category word lists that category', () => {
    expect(matchItem({ label: 'Orbit Run' }, 'games', { kind: 'game' })).toBe(true)
    expect(matchItem({ label: 'Rocket Lab' }, 'games', { kind: 'lab' })).toBe(false)
  })
})
