'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Notification {
  id: string
  type: 'message' | 'campaign' | 'connection' | 'system' | 'alert'
  title: string
  description: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

interface UseRealtimeNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

export function useRealtimeNotifications(): UseRealtimeNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const setupRealtime = async () => {
      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch initial notifications
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setNotifications(data)
      }
      setLoading(false)

      // Subscribe to real-time changes
      channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification
            setNotifications((prev) => [newNotification, ...prev])

            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              new Notification(newNotification.title, {
                body: newNotification.description || undefined,
                icon: '/favicon.ico',
              })
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as Notification
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            )
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const deleted = payload.old as { id: string }
            setNotifications((prev) => prev.filter((n) => n.id !== deleted.id))
          }
        )
        .subscribe()
    }

    setupRealtime()

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('notifications').delete().eq('user_id', user.id)
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  }
}
