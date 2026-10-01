// Any address with no page: say so, and offer a way home, instead of a blank screen. In-app links are
// checked against the routes by src/routes.test.js, so this is for typed or stale addresses.
import { Link, useLocation } from 'react-router-dom'

export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <div data-testid="not-found" className="py-20 text-center">
      <p className="mb-4 text-4xl">🧭</p>
      <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-300">There is no page at {pathname}</h2>
      <Link to="/" className="text-brand-600 hover:underline dark:text-brand-400">Go to the home page</Link>
    </div>
  )
}
