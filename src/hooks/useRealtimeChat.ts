'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChatMessage {
  id: string
  user_id: string
  connection_id: string
  chat_id: string
  waha_message_id: string
  content: string
  media_url: string | null
  media_type: string | null
  from_me: boolean
  timestamp: string
  ack: number
  created_at: string
}

interface UseRealtimeChatOptions {
  connectionId: string | null
  chatId: string | null
}

interface UseRealtimeChatReturn {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sendMessage: (content: string, mediaUrl?: string, mediaType?: string) => Promise<boolean>
  loadMoreMessages: () => Promise<void>
  hasMore: boolean
}

export function useRealtimeChat({ connectionId, chatId }: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const offsetRef = useRef(0)
  const MESSAGES_PER_PAGE = 50

  // Load initial messages
  useEffect(() => {
    if (!connectionId || !chatId) {
      setMessages([])
      setLoading(false)
      return
    }

    const loadMessages = async () => {
      setLoading(true)
      setError(null)
      offsetRef.current = 0

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('לא מחובר')
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('connection_id', connectionId)
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: false })
        .limit(MESSAGES_PER_PAGE)

      if (fetchError) {
        setError('שגיאה בטעינת הודעות')
        console.error('Error loading messages:', fetchError)
      } else if (data) {
        // Reverse to show oldest first
        setMessages(data.reverse())
        setHasMore(data.length === MESSAGES_PER_PAGE)
        offsetRef.current = data.length
      }

      setLoading(false)
    }

    loadMessages()
  }, [connectionId, chatId])

  // Setup realtime subscription
  useEffect(() => {
    if (!connectionId || !chatId) return

    const supabase = createClient()

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cleanup previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      // Subscribe to new messages
      channelRef.current = supabase
        .channel(`chat:${chatId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            const newMessage = payload.new as ChatMessage
            // Only add if user_id matches
            if (newMessage.connection_id === connectionId) {
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some(m => m.id === newMessage.id)) return prev
                return [...prev, newMessage]
              })
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            const updated = payload.new as ChatMessage
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            )
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [connectionId, chatId])

  const loadMoreMessages = useCallback(async () => {
    if (!connectionId || !chatId || loading || !hasMore) return

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('connection_id', connectionId)
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: false })
      .range(offsetRef.current, offsetRef.current + MESSAGES_PER_PAGE - 1)

    if (!fetchError && data) {
      // Prepend older messages
      setMessages((prev) => [...data.reverse(), ...prev])
      setHasMore(data.length === MESSAGES_PER_PAGE)
      offsetRef.current += data.length
    }

    setLoading(false)
  }, [connectionId, chatId, loading, hasMore])

  const sendMessage = useCallback(async (
    content: string,
    mediaUrl?: string,
    mediaType?: string
  ): Promise<boolean> => {
    if (!connectionId || !chatId || !content.trim()) return false

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          chatId,
          content: content.trim(),
          mediaUrl,
          mediaType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'שגיאה בשליחת הודעה')
        return false
      }

      return true
    } catch (err) {
      console.error('Error sending message:', err)
      setError('שגיאה בשליחת הודעה')
      return false
    }
  }, [connectionId, chatId])

  return {
    messages,
    loading,
    error,
    sendMessage,
    loadMoreMessages,
    hasMore,
  }
}
