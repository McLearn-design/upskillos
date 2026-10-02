import { useEffect, useState } from 'react'

// Follows the app's theme (the "dark" class on <html>), for parts that need
// it in JavaScript rather than CSS, such as the code editor's colours.
export function useDarkMode() {
  const read = () => document.documentElement.classList.contains('dark')
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}
