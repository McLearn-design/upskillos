import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import FloatingWindow from './FloatingWindow.jsx'
import { useGlobalTheme } from '../../context/ThemeContext.jsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Taskbar from './Taskbar.jsx'

const DesktopContext = createContext(null)
export const useDesktop = () => useContext(DesktopContext)

const BASE_Z = 1700

export default function DesktopProvider({ children }) {
  const [windows, setWindows] = useState([])
  const [focusOrder, setFocusOrder] = useState([])
  const { pageEffect } = useGlobalTheme()
  const reduceMotion = useReducedMotion()
  const [style, setStyleState] = useState(
    () => localStorage.getItem('oc-desktop-style') || 'taskbar'
  )

  // Regular routes use pb-20 lg:pb-11 on <main> to stay above the Taskbar.
  // Full-screen routes use h-[calc(100vh-44px)] to stop before the Taskbar.
  // Body padding is not needed and caused every full-screen lab to be scrollable by 44px.

  const openWindow = useCallback((config) => {
    setWindows(prev => {
      const exists = prev.find(w => w.id === config.id)
      if (exists) {
        return prev.map(w => w.id === config.id
          ? { ...w, state: w.state === 'minimized' ? 'normal' : w.state }
          : w
        )
      }
      return [...prev, { ...config, state: 'normal', offset: prev.length }]
    })
    setFocusOrder(prev => [...prev.filter(id => id !== config.id), config.id])
  }, [])

  const closeWindow = useCallback((id) => {
    setWindows(prev => prev.filter(w => w.id !== id))
    setFocusOrder(prev => prev.filter(fid => fid !== id))
  }, [])

  const minimizeWindow = useCallback((id) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, state: 'minimized' } : w))
  }, [])

  const toggleMaximize = useCallback((id) => {
    setWindows(prev => prev.map(w => w.id === id
      ? { ...w, state: w.state === 'maximized' ? 'normal' : 'maximized' }
      : w
    ))
  }, [])

  const focusWindow = useCallback((id) => {
    setWindows(prev => prev.map(w =>
      w.id === id && w.state === 'minimized' ? { ...w, state: 'normal' } : w
    ))
    setFocusOrder(prev => [...prev.filter(fid => fid !== id), id])
  }, [])

  const setStyle = useCallback((value) => {
    setStyleState(value)
    localStorage.setItem('oc-desktop-style', value)
  }, [])

  const value = useMemo(() => ({
    windows,
    openWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    desktopStyle: style,
    setDesktopStyle: setStyle,
  }), [windows, openWindow, closeWindow, minimizeWindow, toggleMaximize, focusWindow, style, setStyle])

  // A maximized window sits above the page's own bars (1800). Every window focused after it, maximized
  // or not, goes above it too: otherwise a window opened from a maximized one (Game Studio opening
  // Sprite Forge) opened behind it, out of sight.
  const firstMaximized = Math.min(...windows.filter(w => w.state === 'maximized').map(w => focusOrder.indexOf(w.id)).filter(i => i >= 0))
  const zOf = (w) => {
    const order = focusOrder.indexOf(w.id)
    return (order >= firstMaximized ? 1800 : BASE_Z) + order
  }

  return (
    <DesktopContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {windows
          .filter(w => w.state !== 'minimized')
          .map(w => {
            const exit = !reduceMotion && pageEffect === 'fire' ? {
              opacity: 0,
              filter: 'sepia(1) hue-rotate(-30deg) saturate(5) blur(10px) brightness(2) contrast(1.5)',
              scale: 0.9,
              y: -30,
              transition: { duration: 0.5 }
            } : {
              opacity: 0,
              transition: { duration: 0 }
            }

            return (
              <motion.div
                key={w.id}
                initial={false}
                animate={{ opacity: 1, scale: 1, filter: 'sepia(0) hue-rotate(0deg) saturate(1) blur(0px) brightness(1) contrast(1)', y: 0 }}
                exit={exit}
                style={{
                  position: 'fixed',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: zOf(w)
                }}
              >
                <FloatingWindow
                  win={w}
                  zIndex={zOf(w)}
                  onClose={() => closeWindow(w.id)}
                  onMinimize={() => minimizeWindow(w.id)}
                  onMaximize={() => toggleMaximize(w.id)}
                  onFocus={() => focusWindow(w.id)}
                />
              </motion.div>
            )
          })}
      </AnimatePresence>
      <Taskbar
        windows={windows}
        desktopStyle={style}
        onFocus={focusWindow}
        onClose={closeWindow}
      />
    </DesktopContext.Provider>
  )
}
