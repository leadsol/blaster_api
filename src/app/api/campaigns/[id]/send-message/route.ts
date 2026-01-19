import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { waha } from '@/lib/waha'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { Client as QStashClient } from '@upstash/qstash'
import { isQStashConfigured } from '@/lib/qstash'
import { logger } from '@/lib/logger'
import { getAppUrl } from '@/lib/app-url'

// QStash client - only initialize if token is configured
const qstashToken = process.env.QSTASH_TOKEN
const qstash = qstashToken ? new QStashClient({ token: qstashToken }) : null

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
    logger.debug('[SEND-MESSAGE] No next message to schedule')
    return
  }

  // Schedule it immediately (5 seconds delay to avoid rate limiting)
  const appUrl = getAppUrl()

  const endpoint = `${appUrl}/api/campaigns/${campaignId}/send-message`

  logger.debug(`[SEND-MESSAGE] Scheduling next message ${nextMessage.id} IMMEDIATELY (5s delay) after failure`)

  // Check if QStash is configured, otherwise use setTimeout fallback
  if (isQStashConfigured() && qstash) {
    await qstash.publishJSON({
      url: endpoint,
      body: { messageId: nextMessage.id },
      delay: 5 // 5 seconds delay
    })
  } else {
    // Localhost fallback - use setTimeout
    logger.debug(`[FALLBACK] Scheduling immediate retry for message ${nextMessage.id} with 5s delay`)
    setTimeout(async () => {
      try {
        logger.debug(`[FALLBACK] Retrying message ${nextMessage.id} now`)
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.CRON_SECRET || '',
          },
          body: JSON.stringify({ messageId: nextMessage.id })
        })
      } catch (err) {
        logger.error(`[FALLBACK] Failed to retry message ${nextMessage.id}:`, err)
      }
    }, 5000)
  }
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
      logger.error('[SEND-MESSAGE] Message not found:', messageId)
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if message is still pending
    if (message.status !== 'pending') {
      logger.debug(`[SEND-MESSAGE] Message ${messageId} already processed (status: ${message.status})`)
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
      logger.error('[SEND-MESSAGE] Campaign not found:', campaignId)
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if campaign is still running
    if (campaign.status !== 'running') {
      logger.debug(`[SEND-MESSAGE] Campaign ${campaignId} not running (status: ${campaign.status})`)
      return NextResponse.json({ success: true, skipped: true, reason: 'Campaign not running' })
    }

    // Check if campaign is active (is_active toggle)
    if (campaign.is_active === false) {
      logger.debug(`[SEND-MESSAGE] Campaign ${campaignId} is deactivated (is_active: false)`)
      return NextResponse.json({ success: true, skipped: true, reason: 'Campaign is deactivated' })
    }

    // Check if we're within active hours (if enabled)
    if (campaign.respect_active_hours && campaign.active_hours_start && campaign.active_hours_end) {
      const now = new Date()
      const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

      const startTime = campaign.active_hours_start.slice(0, 5) // Extract HH:MM from TIME
      const endTime = campaign.active_hours_end.slice(0, 5)

      // Check if current time is within active hours
      const isWithinActiveHours = currentTime >= startTime && currentTime <= endTime

      if (!isWithinActiveHours) {
        logger.debug(`[SEND-MESSAGE] Outside active hours (${startTime}-${endTime}, current: ${currentTime}). Rescheduling message ${messageId}`)

        // Calculate delay until next active hours start
        const [startHour, startMinute] = startTime.split(':').map(Number)
        const nextActiveStart = new Date(now)
        nextActiveStart.setHours(startHour, startMinute, 0, 0)

        // If we're past today's active hours, schedule for tomorrow
        if (currentTime > endTime) {
          nextActiveStart.setDate(nextActiveStart.getDate() + 1)
        }

        const delaySeconds = Math.floor((nextActiveStart.getTime() - now.getTime()) / 1000)

        // Reschedule the message for next active hours
        const appUrl = getAppUrl()

        const endpoint = `${appUrl}/api/campaigns/${campaignId}/send-message`

        // Use QStash if available, otherwise fallback to setTimeout for localhost
        if (isQStashConfigured() && qstash) {
          await qstash.publishJSON({
            url: endpoint,
            body: { messageId },
            delay: delaySeconds
          })
          logger.debug(`[SEND-MESSAGE] Rescheduled message via QStash for ${nextActiveStart.toISOString()} (in ${delaySeconds}s)`)
        } else {
          // Fallback: pause campaign when outside active hours on localhost
          // This is safer than trying to use setTimeout for potentially hours
          logger.debug(`[SEND-MESSAGE] Outside active hours on localhost - auto-pausing campaign`)

          await supabase
            .from('campaigns')
            .update({
              status: 'paused',
              paused_at: new Date().toISOString()
            })
            .eq('id', campaignId)

          logger.debug(`[SEND-MESSAGE] Campaign paused until active hours resume at ${nextActiveStart.toISOString()}`)
        }

        return NextResponse.json({ success: true, rescheduled: true, nextAttempt: nextActiveStart.toISOString() })
      }
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
        logger.error(`[SEND-MESSAGE] Device ${deviceConnection.session_name} is busy in campaign "${otherRunningCampaign.name}"`)
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
        const { DEVICE_BASE_LIMIT: BASE_LIMIT, DEVICE_VARIATION_BONUS: VARIATION_BONUS } = await import('@/lib/constants')
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
            logger.debug(`[SEND-MESSAGE] Device ${device.session_name} is busy in campaign "${otherRunningCampaign.name}" - skipping`)
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
          logger.debug(`[SEND-MESSAGE] Device ${device.session_name} (${device.phone_number}): sent ${messagesSentToday}/${deviceLimit} today`)

          // Only include devices that haven't reached their limit
          if (messagesSentToday < deviceLimit) {
            availableDevices.push(device)
          }
        }

        if (availableDevices.length > 0) {
          // Pick random device from available ones
          deviceConnection = availableDevices[Math.floor(Math.random() * availableDevices.length)]
          logger.debug(`[SEND-MESSAGE] Selected device: ${deviceConnection.session_name} (${availableDevices.length} available)`)
        } else {
          logger.error('[SEND-MESSAGE] All devices reached daily limit')
          deviceConnection = null
        }
      }
    }

    if (!deviceConnection || deviceConnection.status !== 'connected') {
      logger.error('[SEND-MESSAGE] No connected device available')
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

    logger.debug(`[SEND-MESSAGE] Sending to ${phone} via ${deviceConnection.session_name}`)

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
          logger.debug(`[SEND-MESSAGE] Sending ${campaign.media_type} to ${phone}`)
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
          logger.error(`[SEND-MESSAGE] Media failed for ${phone}:`, mediaError)
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
          logger.error(`[SEND-MESSAGE] Poll failed for ${phone}:`, pollError)
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

      logger.debug(`[SEND-MESSAGE] Successfully sent message ${messageId} to ${phone}`)
      return NextResponse.json({ success: true, messageId: response.id })

    } catch (sendError) {
      logger.error(`[SEND-MESSAGE] Failed to send to ${phone}:`, sendError)

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
    logger.error('[SEND-MESSAGE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Verify QStash signature in production
export const POST = process.env.NODE_ENV === 'production'
  ? verifySignatureAppRouter(handler)
  : handler
