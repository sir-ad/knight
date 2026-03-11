import React from "react"

interface ErrorBoundaryProps {
  tabName: string
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string | null
}

export class TabErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : "An unexpected error occurred."
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[Knight] ${this.props.tabName} tab crashed:`, error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Something went wrong in the {this.props.tabName} tab.</p>
          {this.state.message && (
            <p className="mt-1 text-xs text-slate-500 max-w-xs break-words">{this.state.message}</p>
          )}
          <button
            className="mt-4 rounded-lg border border-sky-300 px-4 py-2 text-sm text-sky-700 hover:bg-sky-50"
            onClick={this.handleReset}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
