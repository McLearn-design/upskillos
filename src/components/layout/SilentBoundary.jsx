import { Component } from 'react'

// For add-ons that float over the app (video player, tour, laser pointer…)
// and sit outside RootErrorBoundary. The app works without them, so if one
// throws it disappears instead of blanking the whole page.
export default class SilentBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(`${this.props.name ?? 'Add-on'} stopped after an error:`, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
