import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'
import { waha } from '@/lib/waha'
import { logger } from '@/lib/logger'

// WAHA chat object interface for NOWEB engine
interface WAHAChat {
  id: string | { _serialized?: string; user?: string }
  name?: string
  lastMessage?: { body?: string }
  conversationTimestamp?: number
  timestamp?: number
  unreadCount?: number
  pinned?: boolean
  archived?: boolean
  picture?: string | null
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

    // Get connection details including session_name
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('id, session_name, status')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    if (connection.status !== 'connected') {
      return NextResponse.json({ error: 'Connection is not active', status: connection.status, chats: [] }, { status: 200 })
    }

    // Fetch chats directly from WAHA
    // Note: NOWEB engine uses 'conversationTimestamp' not 'timestamp' for sortBy
    logger.debug('[WAHA-CHATS] Fetching chats for session:', connection.session_name)
    const chats = await waha.chats.list(connection.session_name, {
      limit: 100,
      // @ts-expect-error NOWEB engine uses 'conversationTimestamp' which isn't in SDK types
      sortBy: 'conversationTimestamp',
      sortOrder: 'desc'
    })
    logger.debug('[WAHA-CHATS] Got', chats?.length || 0, 'chats')

    // Format chats for frontend
    const formattedChats = chats.map((chat: WAHAChat) => {
      // Handle chat.id - could be string or object with _serialized
      const chatId = typeof chat.id === 'string' ? chat.id : (chat.id?._serialized || chat.id?.user || String(chat.id))

      // NOWEB uses @g.us for groups and @s.whatsapp.net or @c.us for private chats
      const isGroup = chatId.includes('@g.us')

      // NOWEB uses conversationTimestamp (seconds), WEBJS uses timestamp
      const timestamp = chat.conversationTimestamp || chat.timestamp

      return {
        chat_id: chatId,
        name: chat.name || chatId.replace('@c.us', '').replace('@g.us', '').replace('@s.whatsapp.net', ''),
        last_message: chat.lastMessage?.body || '',
        last_message_time: timestamp ? new Date(timestamp * 1000).toISOString() : null,
        unread_count: chat.unreadCount || 0,
        is_group: isGroup,
        pinned: chat.pinned || false,
        archived: chat.archived || false,
        picture: chat.picture || null,
      }
    })

    return NextResponse.json({ chats: formattedChats })
  } catch (error) {
    console.error('[WAHA-CHATS] Error fetching chats:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      error: 'Failed to fetch chats from WhatsApp',
      details: errorMessage,
      chats: []
    }, { status: 500 })
  }
}
