'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-8" dir="rtl">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              משהו השתבש
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              אירעה שגיאה בלתי צפויה. נסה לרענן את הדף או לחזור מאוחר יותר.
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0043E0] text-white rounded-lg hover:bg-[#0035b0] transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              נסה שוב
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left text-sm">
                <p className="text-red-600 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper for use with hooks
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
