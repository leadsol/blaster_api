import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { WebhookEvent } from '@/lib/waha'
import { simpleRateLimit } from '@/lib/api-utils'

// Environment variables with validation
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.WAHA_WEBHOOK_SECRET

// Create supabase client lazily to avoid errors during build
function getSupabaseClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase configuration')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

// Webhook payload types
interface WebhookBody {
  event: WebhookEvent
  session: string
  engine?: string
  payload: unknown
}

interface MessagePayload {
  id: string
  body?: string
  type: string
  timestamp: number
  from: string
  to: string
  fromMe: boolean
  hasMedia: boolean
  ack?: number
  participant?: string
  author?: string
  media?: {
    url?: string
    mimetype: string
    filename?: string
  }
  quotedMsg?: MessagePayload
  location?: {
    latitude: number
    longitude: number
    description?: string
  }
}

interface MessageAckPayload {
  id: string
  ack: number
  chatId: string
}

interface MessageReactionPayload {
  id: string
  reaction: {
    text: string
    messageId: string
  }
  chatId: string
  from: string
  timestamp: number
}

interface SessionStatusPayload {
  status: 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'STOPPED' | 'AUTHENTICATED' | string
  me?: {
    id: string
    pushName?: string
  }
}

interface GroupPayload {
  chatId: string
  participant: string
  by?: string
  timestamp: number
}

interface PresencePayload {
  chatId: string
  presence: 'available' | 'unavailable' | 'composing' | 'recording'
  lastSeen?: number
}

interface ChatArchivePayload {
  id: string
  archived: boolean
  timestamp: number
}

interface LabelPayload {
  id: string
  name?: string
  color?: number
  chatId?: string
}

interface PollVotePayload {
  chatId: string
  messageId: string
  voter: string
  selectedOptions: string[]
  timestamp: number
}

interface CallPayload {
  id: string
  from: string
  timestamp: number
  isGroup: boolean
  isVideo: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const rateLimit = await simpleRateLimit(request, 'webhook')
    if (!rateLimit.allowed) {
      return rateLimit.response
    }

    // Get the request body
    const rawBody = await request.text()

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get('x-webhook-hmac-sha512')
      if (!signature) {
        console.error('Missing webhook signature')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      // Verify HMAC signature
      const crypto = await import('crypto')
      const expectedSignature = crypto
        .createHmac('sha512', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Parse body
    const body: WebhookBody = JSON.parse(rawBody)
    const { event, session, payload } = body

    switch (event) {
      // Message Events
      case 'message':
        await handleIncomingMessage(session, payload as MessagePayload)
        break

      case 'message.any':
        await handleAnyMessage(session, payload as MessagePayload)
        break

      case 'message.ack':
        await handleMessageAck(session, payload as MessageAckPayload)
        break

      case 'message.reaction':
        await handleMessageReaction(session, payload as MessageReactionPayload)
        break

      case 'message.revoked':
        await handleMessageRevoked(session, payload as { id: string; chatId: string })
        break

      case 'message.waiting':
        await handleMessageWaiting(session, payload as MessagePayload)
        break

      // Session Events
      case 'session.status':
        await handleSessionStatus(session, payload as SessionStatusPayload)
        break

      // Group Events
      case 'group.join':
        await handleGroupJoin(session, payload as GroupPayload)
        break

      case 'group.leave':
        await handleGroupLeave(session, payload as GroupPayload)
        break

      // Chat Events
      case 'chat.archive':
        await handleChatArchive(session, payload as ChatArchivePayload)
        break

      // Presence Events
      case 'presence.update':
        await handlePresenceUpdate(session, payload as PresencePayload)
        break

      // Label Events
      case 'label.upsert':
        await handleLabelUpsert(session, payload as LabelPayload)
        break

      case 'label.deleted':
        await handleLabelDeleted(session, payload as LabelPayload)
        break

      case 'label.chat.added':
        await handleLabelChatAdded(session, payload as LabelPayload)
        break

      case 'label.chat.deleted':
        await handleLabelChatDeleted(session, payload as LabelPayload)
        break

      // Poll Events
      case 'poll.vote':
        await handlePollVote(session, payload as PollVotePayload)
        break

      case 'poll.vote.failed':
        await handlePollVoteFailed(session, payload as PollVotePayload)
        break

      // Call Events
      case 'call.received':
        await handleCallReceived(session, payload as CallPayload)
        break

      case 'call.accepted':
        await handleCallAccepted(session, payload as CallPayload)
        break

      case 'call.rejected':
        await handleCallRejected(session, payload as CallPayload)
        break

      default:
        // Unhandled event type - no action needed
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

async function handleIncomingMessage(sessionName: string, payload: MessagePayload) {
  const supabase = getSupabaseClient()

  // Find the connection
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  // Prepare message data
  const messageData: Record<string, unknown> = {
    user_id: connection.user_id,
    connection_id: connection.id,
    chat_id: payload.from,
    waha_message_id: payload.id,
    content: payload.body || '',
    message_type: payload.type,
    from_me: payload.fromMe,
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
    ack: payload.ack || 0,
    has_media: payload.hasMedia,
  }

  // Add media info if present
  if (payload.media) {
    messageData.media_url = payload.media.url
    messageData.media_mimetype = payload.media.mimetype
    messageData.media_filename = payload.media.filename
  }

  // Add location if present
  if (payload.location) {
    messageData.location_latitude = payload.location.latitude
    messageData.location_longitude = payload.location.longitude
    messageData.location_description = payload.location.description
  }

  // Add quoted message reference if present
  if (payload.quotedMsg) {
    messageData.quoted_message_id = payload.quotedMsg.id
  }

  // Save message to database
  await supabase.from('chat_messages').insert(messageData)

  // Update chat last message timestamp
  await supabase
    .from('chats')
    .upsert({
      user_id: connection.user_id,
      connection_id: connection.id,
      chat_id: payload.from,
      last_message_at: new Date(payload.timestamp * 1000).toISOString(),
      last_message_preview: (payload.body || '').substring(0, 100),
    }, { onConflict: 'connection_id,chat_id' })
}

async function handleAnyMessage(_sessionName: string, _payload: MessagePayload) {
  // Handle all messages including outgoing ones
  // This can be used for logging or syncing sent messages
  // Currently no-op - implement when message sync feature is needed
}

async function handleMessageAck(sessionName: string, payload: MessageAckPayload) {
  const supabase = getSupabaseClient()

  // Update message ack status in chat_messages
  await supabase
    .from('chat_messages')
    .update({ ack: payload.ack })
    .eq('waha_message_id', payload.id)

  // Update campaign message status if applicable
  const status = payload.ack >= 3 ? 'read' : payload.ack >= 2 ? 'delivered' : 'sent'

  await supabase
    .from('campaign_messages')
    .update({
      status,
      delivered_at: payload.ack >= 2 ? new Date().toISOString() : null,
      read_at: payload.ack >= 3 ? new Date().toISOString() : null,
    })
    .eq('waha_message_id', payload.id)
}

async function handleMessageReaction(sessionName: string, payload: MessageReactionPayload) {
  const supabase = getSupabaseClient()

  // Find the connection
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  // Store reaction
  if (payload.reaction.text) {
    // Add reaction
    await supabase.from('message_reactions').upsert({
      user_id: connection.user_id,
      message_id: payload.reaction.messageId,
      reactor_id: payload.from,
      reaction: payload.reaction.text,
      timestamp: new Date(payload.timestamp * 1000).toISOString(),
    }, { onConflict: 'message_id,reactor_id' })
  } else {
    // Remove reaction
    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', payload.reaction.messageId)
      .eq('reactor_id', payload.from)
  }
}

async function handleMessageRevoked(sessionName: string, payload: { id: string; chatId: string }) {
  const supabase = getSupabaseClient()

  // Mark message as revoked
  await supabase
    .from('chat_messages')
    .update({
      is_revoked: true,
      content: '', // Clear content
    })
    .eq('waha_message_id', payload.id)
}

async function handleMessageWaiting(_sessionName: string, _payload: MessagePayload) {
  // Handle messages waiting to be sent (offline queue)
  // Currently no-op - implement when offline queue feature is needed
}

// ============================================================================
// Session Handlers
// ============================================================================

async function handleSessionStatus(sessionName: string, payload: SessionStatusPayload) {
  const supabase = getSupabaseClient()

  // First, get the current connection to check status and display_name
  const { data: existingConnection } = await supabase
    .from('connections')
    .select('display_name, first_connected_at, status')
    .eq('session_name', sessionName)
    .single()

  // Map WAHA status to our status
  // WAHA statuses: STARTING, SCAN_QR_CODE, WORKING, FAILED, STOPPED, AUTHENTICATED
  // Important: Only mark as disconnected if explicitly FAILED or STOPPED
  // Unknown statuses should be logged but not cause disconnection
  let status: 'connected' | 'qr_pending' | 'connecting' | 'disconnected'

  switch (payload.status) {
    case 'WORKING':
      status = 'connected'
      break
    case 'SCAN_QR_CODE':
      status = 'qr_pending'
      break
    case 'STARTING':
    case 'AUTHENTICATED': // After QR scan, before fully working
      status = 'connecting'
      break
    case 'FAILED':
      status = 'disconnected'
      break
    case 'STOPPED':
      // If currently connected and we get STOPPED, it might be a temporary restart
      // (e.g., from updating metadata). Only mark as disconnected if we weren't connected.
      if (existingConnection?.status === 'connected') {
        return // Don't update - it's probably a metadata update causing temporary restart
      }
      status = 'disconnected'
      break
    default:
      // For unknown statuses, don't update to disconnected to prevent false disconnections
      return // Exit early, don't update database
  }

  const updateData: Record<string, unknown> = {
    status,
    last_seen_at: new Date().toISOString(),
  }

  if (status === 'connected') {
    // Only set first_connected_at if not already set
    if (!existingConnection?.first_connected_at) {
      updateData.first_connected_at = new Date().toISOString()
    }
    if (payload.me) {
      updateData.phone_number = payload.me.id?.split('@')[0]
      // Only update display_name if it's currently empty (preserve user's custom name)
      if (!existingConnection?.display_name && payload.me.pushName) {
        updateData.display_name = payload.me.pushName
      }
    }
  }

  const { error: updateError } = await supabase
    .from('connections')
    .update(updateData)
    .eq('session_name', sessionName)
    .select()

  if (updateError) {
    console.error('Update error:', updateError)
  }
}

// ============================================================================
// Group Handlers
// ============================================================================

async function handleGroupJoin(sessionName: string, payload: GroupPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  // Log group join event
  await supabase.from('group_events').insert({
    user_id: connection.user_id,
    connection_id: connection.id,
    group_id: payload.chatId,
    event_type: 'join',
    participant: payload.participant,
    added_by: payload.by,
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
  })
}

async function handleGroupLeave(sessionName: string, payload: GroupPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  // Log group leave event
  await supabase.from('group_events').insert({
    user_id: connection.user_id,
    connection_id: connection.id,
    group_id: payload.chatId,
    event_type: 'leave',
    participant: payload.participant,
    removed_by: payload.by,
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
  })
}

// ============================================================================
// Chat Handlers
// ============================================================================

async function handleChatArchive(sessionName: string, payload: ChatArchivePayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase
    .from('chats')
    .update({ is_archived: payload.archived })
    .eq('connection_id', connection.id)
    .eq('chat_id', payload.id)
}

// ============================================================================
// Presence Handlers
// ============================================================================

async function handlePresenceUpdate(sessionName: string, payload: PresencePayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase
    .from('contact_presence')
    .upsert({
      user_id: connection.user_id,
      connection_id: connection.id,
      chat_id: payload.chatId,
      presence: payload.presence,
      last_seen: payload.lastSeen ? new Date(payload.lastSeen * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id,chat_id' })
}

// ============================================================================
// Label Handlers
// ============================================================================

async function handleLabelUpsert(sessionName: string, payload: LabelPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase.from('labels').upsert({
    user_id: connection.user_id,
    connection_id: connection.id,
    waha_label_id: payload.id,
    name: payload.name,
    color: payload.color,
  }, { onConflict: 'connection_id,waha_label_id' })
}

async function handleLabelDeleted(sessionName: string, payload: LabelPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase
    .from('labels')
    .delete()
    .eq('connection_id', connection.id)
    .eq('waha_label_id', payload.id)
}

async function handleLabelChatAdded(sessionName: string, payload: LabelPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase.from('chat_labels').insert({
    user_id: connection.user_id,
    connection_id: connection.id,
    chat_id: payload.chatId,
    label_id: payload.id,
  })
}

async function handleLabelChatDeleted(sessionName: string, payload: LabelPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase
    .from('chat_labels')
    .delete()
    .eq('connection_id', connection.id)
    .eq('chat_id', payload.chatId)
    .eq('label_id', payload.id)
}

// ============================================================================
// Poll Handlers
// ============================================================================

async function handlePollVote(sessionName: string, payload: PollVotePayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase.from('poll_votes').upsert({
    user_id: connection.user_id,
    connection_id: connection.id,
    message_id: payload.messageId,
    chat_id: payload.chatId,
    voter: payload.voter,
    selected_options: payload.selectedOptions,
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
  }, { onConflict: 'message_id,voter' })
}

async function handlePollVoteFailed(_sessionName: string, _payload: PollVotePayload) {
  // Poll vote failed - currently no-op
  // Implement error handling/retry if needed
}

// ============================================================================
// Call Handlers
// ============================================================================

async function handleCallReceived(sessionName: string, payload: CallPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id, user_id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase.from('call_logs').insert({
    user_id: connection.user_id,
    connection_id: connection.id,
    call_id: payload.id,
    from: payload.from,
    is_group: payload.isGroup,
    is_video: payload.isVideo,
    status: 'received',
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
  })
}

async function handleCallAccepted(sessionName: string, payload: CallPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase
    .from('call_logs')
    .update({ status: 'accepted' })
    .eq('connection_id', connection.id)
    .eq('call_id', payload.id)
}

async function handleCallRejected(sessionName: string, payload: CallPayload) {
  const supabase = getSupabaseClient()
  const { data: connection } = await supabase
    .from('connections')
    .select('id')
    .eq('session_name', sessionName)
    .single()

  if (!connection) return

  await supabase
    .from('call_logs')
    .update({ status: 'rejected' })
    .eq('connection_id', connection.id)
    .eq('call_id', payload.id)
}
