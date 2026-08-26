import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('React crash:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center bg-bg p-6 text-fg">
        <div className="w-full max-w-lg rounded-2xl bg-cream p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-ember">Terjadi kesalahan</p>
          <h1 className="mt-2 text-xl font-medium">Halaman gagal dimuat</h1>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-surface p-4 text-left font-mono text-xs text-ember">{this.state.error.message}</pre>
          <button
            onClick={() => location.reload()}
            className="mt-6 rounded-full bg-jet px-6 py-3 text-[15px] font-medium text-paper hover:opacity-85"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    )
  }
}