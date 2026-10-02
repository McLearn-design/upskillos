// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage.js'

function Show({ k = 'docs' }) {
  const [value, setValue] = useLocalStorage(k, ['a'])
  return (
    <>
      <p data-testid="value">{value.join(',')}</p>
      <button onClick={() => setValue((v) => [...v, 'b'])}>add</button>
    </>
  )
}

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

describe('useLocalStorage', () => {
  it('picks up a value another tab saved, so this tab does not overwrite it with stale data', () => {
    render(<Show />)
    // Another tab writes; the browser tells this tab with a native storage event.
    localStorage.setItem('docs', JSON.stringify(['a', 'from-other-tab']))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'docs' })) })
    expect(screen.getByTestId('value').textContent).toBe('a,from-other-tab')
    act(() => { screen.getByText('add').click() })
    expect(JSON.parse(localStorage.getItem('docs'))).toEqual(['a', 'from-other-tab', 'b'])
  })
})
