'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        className
      )}
    />
  )
}

// Pre-built skeleton patterns
export function CardSkeleton() {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 p-6 space-y-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="py-4 px-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-6 w-16 rounded-full" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-8 w-8 rounded" />
      </td>
    </tr>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Skeleton className="h-6 w-40" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-3 px-4 text-right">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="py-3 px-4 text-right">
              <Skeleton className="h-4 w-20" />
            </th>
            <th className="py-3 px-4 text-right">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="py-3 px-4 text-right">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="py-3 px-4">
              <Skeleton className="h-4 w-12" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white dark:bg-gray-800 p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            <Skeleton className="h-8 w-20 mt-4" />
            <Skeleton className="h-4 w-28 mt-2" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* Table */}
      <TableSkeleton />
    </div>
  )
}
