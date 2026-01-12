'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          אופס! משהו השתבש
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          אירעה שגיאה בלתי צפויה. הצוות שלנו קיבל התראה ואנחנו עובדים על פתרון.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0043E0] text-white rounded-lg hover:bg-[#0035b0] transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            נסה שוב
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            חזרה לדשבורד
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left text-xs overflow-auto max-h-40">
            <p className="text-red-600 dark:text-red-400 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-gray-500 mt-2 font-mono">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
