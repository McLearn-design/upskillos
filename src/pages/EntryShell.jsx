import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { setEntryLink } from '../utils/entryLinks.js'
import { useEffect, useState } from 'react'
import { useDesktop } from '../components/desktop/DesktopProvider.jsx'
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx'

// Thin route-trigger: loads the lab/game component, opens it as a desktop
// floating window, then navigates back to the page the link was followed from (or the listing).
// fallbackPath(key): for an entry that is a full page rather than a window
// (a lab with its own route and no index file), where to send #/lab/<key>.
export default function EntryShell({ paramKey, loader, notFoundEmoji, notFoundLabel, backTo, backLabel, fallbackPath }) {
  const params = useParams()
  const key = params[paramKey]
  const navigate = useNavigate()
  const location = useLocation()
  const { search } = location
  const { openWindow } = useDesktop()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    loader(key).then(entry => {
      if (cancelled) return
      if (!entry?.component) {
        const page = fallbackPath?.(key)
        if (page) navigate(page + search, { replace: true })
        else setNotFound(true)
        return
      }
      // A deep link's query (?project=…) would be lost by the navigation below; hand it to the lab.
      if (search) setEntryLink(key, search)
      openWindow({
        id: key,
        label: entry.label,
        emoji: entry.emoji,
        Component: entry.component,
        width: entry.width,
        height: entry.height,
        backTo,
        backLabel,
      })
      // Back to the page the link was followed from (the lab opens over it), or the listing for a link
      // opened cold. location.key is 'default' only on the first page of the session.
      if (location.key !== 'default') navigate(-1)
      else navigate(backTo, { replace: true })
    }).catch(() => { if (!cancelled) setNotFound(true) })
    return () => { cancelled = true }
  }, [key, search])

  if (notFound) return (
    <div className="py-20 text-center">
      <p className="text-4xl mb-4">{notFoundEmoji}</p>
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">{notFoundLabel}</h2>
      <button onClick={() => navigate(backTo)} className="text-brand-600 hover:underline dark:text-brand-400">
        {backLabel || 'Go back'}
      </button>
    </div>
  )

  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" />
    </div>
  )
}
