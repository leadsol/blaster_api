import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'

interface ChatConversation {
  chat_id: string
  last_message: string
  last_message_time: string
  from_me: boolean
  unread_count: number
}

export async function GET(request: NextRequest) {
  // Rate limit check
  const rateLimit = await simpleRateLimit(request, 'api')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
    }

    // Verify connection belongs to user
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('id')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Get unique chat_ids with their latest message
    // Using raw SQL for better performance with grouping
    const { data: conversations, error: convError } = await supabase
      .from('chat_messages')
      .select('chat_id, content, timestamp, from_me, ack')
      .eq('user_id', user.id)
      .eq('connection_id', connectionId)
      .order('timestamp', { ascending: false })

    if (convError) {
      console.error('Error fetching conversations:', convError)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Group by chat_id and get latest message for each
    const chatMap = new Map<string, ChatConversation>()

    for (const msg of conversations || []) {
      if (!chatMap.has(msg.chat_id)) {
        chatMap.set(msg.chat_id, {
          chat_id: msg.chat_id,
          last_message: msg.content || '',
          last_message_time: msg.timestamp,
          from_me: msg.from_me,
          unread_count: 0,
        })
      }

      // Count unread messages (ack < 3 and not from me)
      if (!msg.from_me && msg.ack < 3) {
        const conv = chatMap.get(msg.chat_id)!
        conv.unread_count++
      }
    }

    // Convert to array and sort by last message time
    const result = Array.from(chatMap.values())
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime())

    return NextResponse.json({ conversations: result })
  } catch (error) {
    console.error('Conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
