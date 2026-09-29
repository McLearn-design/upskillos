// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { setEntryLink, takeEntryLink } from './entryLinks.js'

describe('entry links', () => {
  it('hand a query to the lab once, and announce it to an open one', () => {
    const heard = []
    const on = (e) => heard.push(e.detail)
    window.addEventListener('entry-link', on)
    setEntryLink('mesh-lab', '?project=walk-cycle')
    window.removeEventListener('entry-link', on)
    expect(heard).toEqual([{ key: 'mesh-lab', search: '?project=walk-cycle' }])
    expect(takeEntryLink('mesh-lab')).toBe('?project=walk-cycle')
    expect(takeEntryLink('mesh-lab')).toBeNull()
  })
})
