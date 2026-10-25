import { Component, type ReactNode } from 'react'

// Fängt Abstürze beim Anzeigen ab. Statt einer weißen Seite sieht man, was passiert ist, und kann neu laden.
export class Guard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen">
        <main className="view">
          <div className="s-title">Da ist etwas schiefgegangen.</div>
          <p>Tippe auf „Neu laden“. Deine Daten bleiben erhalten.</p>
          <p className="mini">Für Eltern: {String(this.state.error.message || this.state.error)}</p>
        </main>
        <footer className="foot">
          <button className="btn" onClick={() => location.reload()}>
            Neu laden
          </button>
        </footer>
      </div>
    )
  }
}
