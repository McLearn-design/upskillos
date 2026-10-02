import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Lesson prose, notebook text and other Markdown render in-app links as plain anchors whose href is a hash route. Followed
// as they are, the browser changes the hash itself, so React Router's history entry has no key, and a
// page that goes back afterwards (EntryShell, after opening a lab over the page it came from) cannot
// tell it was followed from the lesson and falls back to its listing. This turns a plain click on such
// a link into router navigation, the same as a <Link>. A click a <Link> already handled, a modified
// click (new tab) and a link with a target are left alone.
export default function InAppLinks() {
  const navigate = useNavigate()
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest('a[href^="#/"]') : null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      e.preventDefault()
      navigate(a.getAttribute('href').slice(1))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate])
  return null
}
