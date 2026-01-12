'use client'

import { MainLayout } from '@/components/layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary>
      <MainLayout>{children}</MainLayout>
    </ErrorBoundary>
  )
}
