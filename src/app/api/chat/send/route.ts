import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'

const WAHA_API_URL = process.env.WAHA_API_URL || 'http://localhost:3001'
const WAHA_API_KEY = process.env.WAHA_API_KEY

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

    // Send message via WAHA API
    const wahaEndpoint = mediaUrl
      ? `${WAHA_API_URL}/api/sendImage`
      : `${WAHA_API_URL}/api/sendText`

    const wahaPayload = mediaUrl
      ? {
          session: connection.session_name,
          chatId,
          file: { url: mediaUrl },
          caption: content,
        }
      : {
          session: connection.session_name,
          chatId,
          text: content,
        }

    const wahaHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (WAHA_API_KEY) {
      wahaHeaders['X-Api-Key'] = WAHA_API_KEY
    }

    const wahaResponse = await fetch(wahaEndpoint, {
      method: 'POST',
      headers: wahaHeaders,
      body: JSON.stringify(wahaPayload),
    })

    if (!wahaResponse.ok) {
      const errorText = await wahaResponse.text()
      console.error('WAHA API error:', errorText)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    const wahaData = await wahaResponse.json()

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        chat_id: chatId,
        waha_message_id: wahaData.id || wahaData.key?.id || `local_${Date.now()}`,
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
