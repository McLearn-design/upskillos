import { useState, useEffect } from 'react'

export function useContributorMode() {
  const isElectron = typeof window !== 'undefined' && !!window.openCalcDesktop
  const [devFsAvailable, setDevFsAvailable] = useState(false)
  const [isCloned, setIsCloned] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // The file API only exists in Vite development or the desktop app. A
    // production-site probe can only return 404 and adds noise to every page.
    if (!isElectron && !import.meta.env.DEV) {
      setLoading(false)
      return () => { cancelled = true }
    }

    async function probe() {
      try {
        const [pingRes, statusRes] = await Promise.all([
          fetch('/api/dev-fs/ping').then(r => r.ok ? r.json() : null).catch(() => null),
          isElectron
            ? window.openCalcDesktop.getContributorStatus()
            : Promise.resolve(null),
        ])

        if (cancelled) return
        setDevFsAvailable(!!pingRes?.ok)
        setIsCloned(statusRes?.cloned ?? false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    probe()
    return () => { cancelled = true }
  }, [isElectron])

  return { isElectron, isCloned, devFsAvailable, available: devFsAvailable, loading }
}
