import { Component } from 'react'
import { isStaleChunkError, reloadForNewVersion } from '../../utils/staleChunk.js'

// Wraps the whole app in main.jsx, above the providers. RootErrorBoundary
// (inside App) can't sit there: its report form needs the auth provider. So
// a throw in a provider used to leave a blank white page. This fallback uses
// no app context, only plain markup and a Reload button.
export default class LastResortBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('UpSkillOS stopped after an error:', error)
    if (isStaleChunkError(error)) reloadForNewVersion()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>UpSkillOS hit an error</h1>
          <p style={{ color: '#94a3b8', marginBottom: 16 }}>{String(this.state.error?.message ?? this.state.error)}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '8px 18px', borderRadius: 999, border: 0, background: '#38bdf8', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
