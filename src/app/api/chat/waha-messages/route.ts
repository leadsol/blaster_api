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
    const chatId = searchParams.get('chatId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
    }

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 })
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
      return NextResponse.json({ error: 'Connection is not active', messages: [] }, { status: 200 })
    }

    // Fetch messages directly from WAHA
    const messages = await waha.chats.getMessages(connection.session_name, chatId, {
      limit: limit,
      downloadMedia: false
    })

    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.body || '',
      from_me: msg.fromMe,
      timestamp: msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString(),
      ack: msg.ack || 0,
      type: msg.type,
      has_media: msg.hasMedia,
    }))

    // Reverse to get chronological order (oldest first)
    formattedMessages.reverse()

    return NextResponse.json({ messages: formattedMessages })
  } catch (error) {
    console.error('WAHA messages error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages from WhatsApp', messages: [] }, { status: 200 })
  }
}
