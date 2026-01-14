import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { waha } from '@/lib/waha'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

// This endpoint is called by QStash to send a single message
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
    }

    // Use admin client since QStash callbacks don't have user session
    const supabase = createAdminClient()

    // Get the message
    const { data: message, error: messageError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      console.error('[SEND-MESSAGE] Message not found:', messageId)
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if message is still pending
    if (message.status !== 'pending') {
      console.log(`[SEND-MESSAGE] Message ${messageId} already processed (status: ${message.status})`)
      return NextResponse.json({ success: true, skipped: true })
    }

    // Get campaign with connection info
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        connection:connections(id, session_name, status, phone_number, display_name)
      `)
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('[SEND-MESSAGE] Campaign not found:', campaignId)
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if campaign is still running
    if (campaign.status !== 'running') {
      console.log(`[SEND-MESSAGE] Campaign ${campaignId} not running (status: ${campaign.status})`)
      return NextResponse.json({ success: true, skipped: true, reason: 'Campaign not running' })
    }

    // Get a connected device
    let deviceConnection = campaign.connection
    if (campaign.multi_device && campaign.device_ids && campaign.device_ids.length > 0) {
      // Get all device connections and pick a random connected one
      const { data: devices } = await supabase
        .from('connections')
        .select('id, session_name, status, phone_number, display_name')
        .in('id', campaign.device_ids)
        .eq('status', 'connected')

      if (devices && devices.length > 0) {
        // Pick random device
        deviceConnection = devices[Math.floor(Math.random() * devices.length)]
      }
    }

    if (!deviceConnection || deviceConnection.status !== 'connected') {
      console.error('[SEND-MESSAGE] No connected device available')
      await supabase
        .from('campaign_messages')
        .update({
          status: 'failed',
          error_message: 'אין מכשיר מחובר',
          failed_at: new Date().toISOString()
        })
        .eq('id', messageId)

      return NextResponse.json({ error: 'No connected device' }, { status: 400 })
    }

    // Format phone number
    const phone = message.phone.replace(/\D/g, '')
    const chatId = `${phone}@c.us`

    // Get message content (use variation if available)
    let messageText = message.message_content
    const messageVariations: string[] = campaign.message_variations || []
    if (messageVariations.length > 0) {
      const validVariations = messageVariations.filter(v => v && v.trim().length > 0)
      if (validVariations.length > 0) {
        messageText = validVariations[Math.floor(Math.random() * validVariations.length)]
        // Replace variables in the variation
        messageText = messageText.replace(/\{שם\}/g, message.name || '')
        messageText = messageText.replace(/\{טלפון\}/g, message.phone)
        if (message.variables) {
          Object.entries(message.variables).forEach(([key, value]) => {
            messageText = messageText.replace(new RegExp(`\\{${key}\\}`, 'g'), value as string)
          })
        }
      }
    }

    console.log(`[SEND-MESSAGE] Sending to ${phone} via ${deviceConnection.session_name}`)

    try {
      let response: { id: string } = { id: `msg_${Date.now()}` }
      let textSent = false
      let mediaSent = false
      let pollSent = false

      // Send text message
      if (messageText && messageText.trim()) {
        response = await waha.messages.sendText({
          session: deviceConnection.session_name,
          chatId,
          text: messageText
        })
        textSent = true
      }

      // Send media if configured
      if (campaign.media_url && campaign.media_type) {
        try {
          console.log(`[SEND-MESSAGE] Sending ${campaign.media_type} to ${phone}`)
          if (campaign.media_type === 'image') {
            const mediaResponse = await waha.messages.sendImage({
              session: deviceConnection.session_name,
              chatId,
              file: { url: campaign.media_url }
            })
            if (!textSent) response = mediaResponse
          } else if (campaign.media_type === 'video') {
            const mediaResponse = await waha.messages.sendVideo({
              session: deviceConnection.session_name,
              chatId,
              file: { url: campaign.media_url }
            })
            if (!textSent) response = mediaResponse
          } else if (campaign.media_type === 'document') {
            const mediaResponse = await waha.messages.sendFile({
              session: deviceConnection.session_name,
              chatId,
              file: { url: campaign.media_url }
            })
            if (!textSent) response = mediaResponse
          } else if (campaign.media_type === 'audio') {
            const mediaResponse = await waha.messages.sendVoice({
              session: deviceConnection.session_name,
              chatId,
              file: {
                mimetype: 'audio/ogg; codecs=opus',
                url: campaign.media_url
              },
              convert: true
            })
            if (!textSent) response = mediaResponse
          }
          mediaSent = true
        } catch (mediaError) {
          console.error(`[SEND-MESSAGE] Media failed for ${phone}:`, mediaError)
        }
      }

      // Send poll if configured
      if (campaign.poll_question && campaign.poll_options && campaign.poll_options.length >= 2) {
        try {
          await waha.messages.sendPoll({
            session: deviceConnection.session_name,
            chatId,
            name: campaign.poll_question,
            options: campaign.poll_options,
            multipleAnswers: campaign.poll_multiple_answers || false
          })
          pollSent = true
        } catch (pollError) {
          console.error(`[SEND-MESSAGE] Poll failed for ${phone}:`, pollError)
        }
      }

      // Check if anything was sent
      if (!textSent && !mediaSent && !pollSent) {
        throw new Error('לא נשלח תוכן כלשהו')
      }

      // Update message as sent
      await supabase
        .from('campaign_messages')
        .update({
          status: 'sent',
          waha_message_id: response.id,
          sent_at: new Date().toISOString(),
          sent_message_content: messageText,
          sender_session_name: deviceConnection.display_name || deviceConnection.session_name,
          sender_phone: deviceConnection.phone_number
        })
        .eq('id', messageId)

      // Update campaign sent count
      const { data: sentCount } = await supabase
        .from('campaign_messages')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .eq('status', 'sent')

      await supabase
        .from('campaigns')
        .update({ sent_count: sentCount?.length || 0 })
        .eq('id', campaignId)

      console.log(`[SEND-MESSAGE] Successfully sent message ${messageId} to ${phone}`)
      return NextResponse.json({ success: true, messageId: response.id })

    } catch (sendError) {
      console.error(`[SEND-MESSAGE] Failed to send to ${phone}:`, sendError)

      await supabase
        .from('campaign_messages')
        .update({
          status: 'failed',
          error_message: 'שליחה נכשלה',
          failed_at: new Date().toISOString()
        })
        .eq('id', messageId)

      // Update campaign failed count
      const { data: failedCount } = await supabase
        .from('campaign_messages')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')

      await supabase
        .from('campaigns')
        .update({ failed_count: failedCount?.length || 0 })
        .eq('id', campaignId)

      return NextResponse.json({ error: 'Send failed' }, { status: 500 })
    }

  } catch (error) {
    console.error('[SEND-MESSAGE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Verify QStash signature in production
export const POST = process.env.NODE_ENV === 'production'
  ? verifySignatureAppRouter(handler)
  : handler
