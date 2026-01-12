import { FileQuestion, Home, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          404
        </h1>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
          הדף לא נמצא
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          מצטערים, הדף שחיפשת לא קיים או שהוסר. בדוק את הכתובת או חזור לדף הבית.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0043E0] text-white rounded-lg hover:bg-[#0035b0] transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            חזרה לדשבורד
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            <ArrowRight className="w-4 h-4" />
            לדף הראשי
          </Link>
        </div>
      </div>
    </div>
  )
}
