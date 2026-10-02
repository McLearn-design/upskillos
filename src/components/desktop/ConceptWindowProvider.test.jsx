// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// The concept renderer is a lazy chunk; here it fails to load, as it does
// when a deploy has removed the file an open page expects.
vi.mock('../docs/MarkdownHub.jsx', () => { throw new Error('Failed to load chunk') })
vi.mock('../../utils/staleChunk.js', () => ({ isStaleChunkError: () => false, reloadForNewVersion: vi.fn() }))
vi.mock('../../context/ThemeContext.jsx', () => ({ useGlobalTheme: () => ({}) }))
// Just the window's content, without the drag/resize chrome.
vi.mock('./FloatingWindow.jsx', () => ({ default: ({ win }) => <win.Component /> }))

const { default: ConceptWindowProvider, useConceptWindow } = await import('./ConceptWindowProvider.jsx')

function OpenButton() {
  const { openFromLesson } = useConceptWindow()
  return <button onClick={() => openFromLesson('/src/docs/concepts/x.md', 'X', 'Lesson')}>open</button>
}

afterEach(cleanup)

describe('ConceptWindowProvider', () => {
  it('says the concept could not be loaded instead of loading forever', async () => {
    render(<ConceptWindowProvider><OpenButton /></ConceptWindowProvider>)
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText(/Loading concept/)).toBeTruthy()
    expect(await screen.findByText(/couldn't be loaded/)).toBeTruthy()
    expect(screen.queryByText(/Loading concept/)).toBeNull()
  })
})
