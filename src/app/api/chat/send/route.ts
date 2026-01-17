import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'
import { waha } from '@/lib/waha'

export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimit = await simpleRateLimit(request, 'message')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { connectionId, chatId, content, mediaUrl, mediaType } = body

    if (!connectionId || !chatId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify connection belongs to user
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('session_name, status')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    if (connection.status !== 'connected') {
      return NextResponse.json({ error: 'Connection not active' }, { status: 400 })
    }

    // Send message via WAHA API using the waha library
    // Retry logic for transient WAHA errors
    let wahaData
    let lastError
    const maxRetries = 3

    // Pre-fetch the chat to ensure it's loaded in WAHA's memory
    // This can help avoid the "markedUnread" error caused by uninitialized chat state
    try {
      await waha.chats.get(connection.session_name, chatId)
    } catch {
      // Ignore errors - chat might not exist yet for new conversations
      console.log('[SEND] Pre-fetching chat failed, continuing anyway')
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (mediaUrl) {
          wahaData = await waha.messages.sendImage({
            session: connection.session_name,
            chatId,
            file: { url: mediaUrl },
            caption: content,
          })
        } else {
          wahaData = await waha.messages.sendText({
            session: connection.session_name,
            chatId,
            text: content,
          })
        }
        break // Success, exit retry loop
      } catch (wahaError) {
        lastError = wahaError
        console.error(`WAHA API error (attempt ${attempt}/${maxRetries}):`, wahaError)

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff: 1s, 2s, 3s)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    if (!wahaData) {
      console.error('WAHA API failed after retries:', lastError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        chat_id: chatId,
        waha_message_id: wahaData.id || (wahaData as any).key?.id || `local_${Date.now()}`,
        content,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        from_me: true,
        timestamp: new Date().toISOString(),
        ack: 1,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving message:', saveError)
      // Still return success since message was sent
      return NextResponse.json({
        success: true,
        message: { id: wahaData.id }
      })
    }

    return NextResponse.json({ success: true, message: savedMessage })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
