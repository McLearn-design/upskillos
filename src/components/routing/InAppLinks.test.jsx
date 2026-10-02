// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import InAppLinks from './InAppLinks.jsx'

function Where() {
  const l = useLocation()
  return <p data-testid="where">{`${l.pathname}${l.search} ${l.key === 'default' ? 'no-key' : 'keyed'}`}</p>
}

function app() {
  return render(
    <MemoryRouter initialEntries={['/chapter/x']}>
      <InAppLinks />
      <Routes><Route path="*" element={<Where />} /></Routes>
      {/* What Markdown renders: a plain anchor, not a <Link>. */}
      <div dangerouslySetInnerHTML={{ __html: '<a href="#/lab/mesh-lab?project=p">open</a> <a href="#/x" target="_blank">tab</a> <a href="https://example.com">out</a>' }} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('InAppLinks', () => {
  it('a plain click on a #/ link navigates through the router, so the entry has a key to go back from', () => {
    app()
    expect(screen.getByTestId('where').textContent).toBe('/chapter/x no-key')
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('where').textContent).toBe('/lab/mesh-lab?project=p keyed')
  })

  it('leaves new-tab clicks, targeted links and other sites to the browser', () => {
    app()
    // Record whether InAppLinks claimed the click, then stop the test browser following the link itself.
    let claimed = null
    const after = (e) => { claimed = e.defaultPrevented; e.preventDefault() }
    document.addEventListener('click', after)
    for (const [text, opts] of [['open', { metaKey: true }], ['open', { ctrlKey: true }], ['tab', {}], ['out', {}]]) {
      fireEvent.click(screen.getByText(text), { button: 0, ...opts })
      expect(claimed, `${text} ${JSON.stringify(opts)}`).toBe(false)
    }
    document.removeEventListener('click', after)
    expect(screen.getByTestId('where').textContent).toBe('/chapter/x no-key')
  })
})
