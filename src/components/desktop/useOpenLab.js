// Open a lab's window from inside the app, without leaving the page you are on: a lesson's Try it card
// opens Game Studio beside the lesson, Game Studio opens Sprite Forge beside itself. Routing to /lab/<id>
// would open it too, but swaps the page underneath (the lesson unmounts and loses its place).
//
//   const openLab = useOpenLab()
//   openLab('game-studio', '?task=first-sprite&from=…')   // the query reaches the lab as a deep link would
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDesktop } from './DesktopProvider.jsx'
import { getLabEntry } from '../../labs/labLoader.js'
import { setEntryLink } from '../../utils/entryLinks.js'

export function useOpenLab() {
  // No desktop around this component (rendered outside DesktopProvider, or a hot reload left a stale
  // context): open the lab's route instead of crashing the card that asked for it.
  const openWindow = useDesktop()?.openWindow
  const navigate = useNavigate()
  return useCallback(async (key, search = '') => {
    if (!openWindow) { navigate(`/lab/${key}${search}`); return }
    const entry = await getLabEntry(key)
    if (!entry?.component) throw new Error(`There is no lab "${key}"`)
    // Set before the window opens, so a lab that is just mounting finds it; one already open hears the event.
    if (search) setEntryLink(key, search)
    openWindow({ id: key, label: entry.label, emoji: entry.emoji, Component: entry.component, width: entry.width, height: entry.height, backTo: '/', backLabel: 'Back' })
  }, [openWindow, navigate])
}
