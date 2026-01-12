import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'

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
    const offset = parseInt(searchParams.get('offset') || '0')

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

    // Build query
    let query = supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('connection_id', connectionId)

    if (chatId) {
      query = query.eq('chat_id', chatId)
    }

    const { data: messages, error: msgError, count } = await query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (msgError) {
      console.error('Error fetching messages:', msgError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({
      messages: messages?.reverse() || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
