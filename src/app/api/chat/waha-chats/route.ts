import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'
import { waha } from '@/lib/waha'

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
    const chats = await waha.chats.list(connection.session_name, {
      limit: 100,
      sortBy: 'timestamp' as any,
      sortOrder: 'desc'
    })

    // Format chats for frontend
    const formattedChats = chats.map(chat => {
      // Handle chat.id - could be string or object with _serialized
      const chatId = typeof chat.id === 'string' ? chat.id : (chat.id?._serialized || chat.id?.user || String(chat.id))

      return {
        chat_id: chatId,
        name: chat.name || chatId.replace('@c.us', '').replace('@g.us', ''),
        last_message: chat.lastMessage?.body || '',
        last_message_time: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : null,
        unread_count: chat.unreadCount || 0,
        is_group: chat.isGroup,
        pinned: chat.pinned || false,
        archived: chat.archived || false,
        picture: chat.picture || null,
      }
    })

    return NextResponse.json({ chats: formattedChats })
  } catch (error) {
    console.error('WAHA chats error:', error)
    return NextResponse.json({ error: 'Failed to fetch chats from WhatsApp', chats: [] }, { status: 200 })
  }
}
