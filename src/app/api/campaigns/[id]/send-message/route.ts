import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { waha } from '@/lib/waha'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { Client as QStashClient } from '@upstash/qstash'

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN || '' })

// Helper function to schedule next pending message immediately (after failure)
async function scheduleNextMessageImmediately(campaignId: string) {
  const supabase = createAdminClient()

  // Get the next pending message
  const { data: nextMessage } = await supabase
    .from('campaign_messages')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('scheduled_delay_seconds', { ascending: true })
    .limit(1)
    .single()

  if (!nextMessage) {
    console.log('[SEND-MESSAGE] No next message to schedule')
    return
  }

  // Schedule it immediately (5 seconds delay to avoid rate limiting)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000'
    ? process.env.NEXT_PUBLIC_APP_URL
    : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const endpoint = `${appUrl}/api/campaigns/${campaignId}/send-message`

  console.log(`⚡ [SEND-MESSAGE] Scheduling next message ${nextMessage.id} IMMEDIATELY (5s delay) after failure`)

  await qstash.publishJSON({
    url: endpoint,
    body: { messageId: nextMessage.id },
    delay: 5 // 5 seconds delay
  })
}

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

    // Get a connected device with available daily capacity
    let deviceConnection = campaign.connection

    // CRITICAL: For single device mode, check if it's busy in another campaign
    if (!campaign.multi_device && deviceConnection) {
      const { data: otherRunningCampaign } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'running')
        .neq('id', campaignId)
        .or(`connection_id.eq.${deviceConnection.id},device_ids.cs.{${deviceConnection.id}}`)
        .limit(1)
        .single()

      if (otherRunningCampaign) {
        console.error(`❌ [SEND-MESSAGE] Device ${deviceConnection.session_name} is busy in campaign "${otherRunningCampaign.name}"`)
        deviceConnection = null // Mark as unavailable
      }
    }

    if (campaign.multi_device && campaign.device_ids && campaign.device_ids.length > 0) {
      // Get all device connections
      const { data: devices } = await supabase
        .from('connections')
        .select('id, session_name, status, phone_number, display_name')
        .in('id', campaign.device_ids)
        .eq('status', 'connected')

      if (devices && devices.length > 0) {
        // Filter devices that haven't reached daily limit
        const BASE_LIMIT = 90
        const VARIATION_BONUS = 10
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const availableDevices = []

        for (const device of devices) {
          if (!device.phone_number) continue

          // CRITICAL: Check if device is busy in another running campaign
          // This prevents race conditions where scheduled campaigns start while device is already busy
          const { data: otherRunningCampaign } = await supabase
            .from('campaigns')
            .select('id, name')
            .eq('status', 'running')
            .neq('id', campaignId) // Exclude current campaign
            .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)
            .limit(1)
            .single()

          if (otherRunningCampaign) {
            console.log(`⚠️ [SEND-MESSAGE] Device ${device.session_name} is busy in campaign "${otherRunningCampaign.name}" - skipping`)
            continue // Skip this device - it's busy
          }

          // Calculate limit for this device
          const messageVariations: string[] = campaign.message_variations || []
          const variationCount = messageVariations.length > 1 ? messageVariations.length : 0
          const extraVariationBonus = variationCount > 1 ? (variationCount - 1) * VARIATION_BONUS : 0
          const deviceLimit = BASE_LIMIT + extraVariationBonus

          // Get all campaigns using this device
          const { data: deviceCampaigns } = await supabase
            .from('campaigns')
            .select('id')
            .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)

          const campaignIds = deviceCampaigns?.map(c => c.id) || []

          if (campaignIds.length === 0) {
            availableDevices.push(device)
            continue
          }

          // Count messages sent today from this device
          const { count: sentToday } = await supabase
            .from('campaign_messages')
            .select('id', { count: 'exact', head: true })
            .in('campaign_id', campaignIds)
            .eq('status', 'sent')
            .eq('sender_phone', device.phone_number)
            .gte('sent_at', todayStart.toISOString())

          const messagesSentToday = sentToday || 0
          console.log(`[SEND-MESSAGE] Device ${device.session_name} (${device.phone_number}): sent ${messagesSentToday}/${deviceLimit} today`)

          // Only include devices that haven't reached their limit
          if (messagesSentToday < deviceLimit) {
            availableDevices.push(device)
          }
        }

        if (availableDevices.length > 0) {
          // Pick random device from available ones
          deviceConnection = availableDevices[Math.floor(Math.random() * availableDevices.length)]
          console.log(`[SEND-MESSAGE] Selected device: ${deviceConnection.session_name} (${availableDevices.length} available)`)
        } else {
          console.error('[SEND-MESSAGE] All devices reached daily limit')
          deviceConnection = null
        }
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

      // Schedule next message immediately after failure
      await scheduleNextMessageImmediately(campaignId)

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

      // Schedule next message immediately after failure
      await scheduleNextMessageImmediately(campaignId)

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
