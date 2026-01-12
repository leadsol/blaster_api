import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { waha } from '@/lib/waha'

const CRON_SECRET = process.env.CRON_SECRET

// Constants for sending limits (per device)
const MIN_DELAY_SECONDS = 10 // Minimum delay between messages
const MAX_DELAY_SECONDS = 60 // Maximum delay between messages
const MESSAGES_PER_BATCH = 30 // Messages before taking a break
const BASE_MESSAGES_PER_DAY_PER_DEVICE = 90 // Base messages per day per device
const VARIATION_BONUS = 10 // Extra messages per additional variation
const BATCH_BREAKS = [
  30 * 60 * 1000,  // 30 minutes after first 30 messages
  60 * 60 * 1000,  // 1 hour after second 30 messages
  90 * 60 * 1000,  // 1.5 hours after third 30 messages
]

// Helper function for random delay with human-like variation
const getRandomDelay = (min: number, max: number): number => {
  // Add some "human" randomness - sometimes quicker, sometimes slower
  const baseDelay = Math.floor(Math.random() * (max - min + 1) + min)

  // 20% chance of a slightly longer pause (human distraction simulation)
  const extraPause = Math.random() < 0.2 ? Math.floor(Math.random() * 15) : 0

  // 10% chance of a quick response
  const quickResponse = Math.random() < 0.1 ? -Math.floor(baseDelay * 0.3) : 0

  return Math.max(min, baseDelay + extraPause + quickResponse) * 1000
}

// Helper function to randomly select a device (not round-robin)
const getRandomDevice = (devices: DeviceState[], maxMessagesPerDay: number): DeviceState | null => {
  // Filter available devices that haven't reached daily limit
  const availableDevices = devices.filter(
    d => d.isAvailable && d.messagesToday < maxMessagesPerDay
  )

  if (availableDevices.length === 0) return null

  // Random selection from available devices
  const randomIndex = Math.floor(Math.random() * availableDevices.length)
  return availableDevices[randomIndex]
}

// Helper function to get random message variation
const getRandomVariation = (variations: string[], baseMessage: string): string => {
  if (!variations || variations.length === 0) {
    return baseMessage
  }

  // Filter out empty variations
  const validVariations = variations.filter(v => v && v.trim().length > 0)

  if (validVariations.length === 0) {
    return baseMessage
  }

  // Random selection
  const randomIndex = Math.floor(Math.random() * validVariations.length)
  return validVariations[randomIndex]
}

// Interface for device state tracking
interface DeviceState {
  connectionId: string
  sessionName: string
  phoneNumber: string | null
  displayName: string | null
  messagesInBatch: number
  batchIndex: number
  messagesToday: number
  isAvailable: boolean
}

// POST - Process/run a campaign (send messages)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const supabase = await createClient()

    // Check authentication: either user session or internal cron secret
    const internalSecret = request.headers.get('x-internal-secret')
    const isInternalCall = CRON_SECRET && internalSecret === CRON_SECRET

    if (!isInternalCall) {
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get campaign with connection info
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        connection:connections(id, session_name, status)
      `)
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError)
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if campaign is in valid state
    if (!['draft', 'scheduled', 'running', 'paused'].includes(campaign.status)) {
      return NextResponse.json({
        error: `Campaign is ${campaign.status}, cannot process`
      }, { status: 400 })
    }

    // Get all devices for this campaign
    let deviceIds: string[] = []
    if (campaign.multi_device && campaign.device_ids && campaign.device_ids.length > 0) {
      deviceIds = campaign.device_ids
    } else {
      deviceIds = [campaign.connection_id]
    }

    // Get all device connections (including phone_number for sender info)
    const { data: deviceConnections, error: devicesError } = await supabase
      .from('connections')
      .select('id, session_name, status, phone_number, display_name')
      .in('id', deviceIds)

    if (devicesError || !deviceConnections || deviceConnections.length === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', campaignId)

      return NextResponse.json({
        error: 'No connections found for this campaign'
      }, { status: 400 })
    }

    // Filter only connected devices
    const connectedDevices = deviceConnections.filter(d => d.status === 'connected')
    if (connectedDevices.length === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', campaignId)

      return NextResponse.json({
        error: 'No active WhatsApp connections'
      }, { status: 400 })
    }

    console.log(`[MULTI-DEVICE] Using ${connectedDevices.length} devices for campaign`)

    // Update campaign status to running
    await supabase
      .from('campaigns')
      .update({
        status: 'running',
        started_at: campaign.started_at || new Date().toISOString()
      })
      .eq('id', campaignId)

    // Get pending messages
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      // No pending messages, mark campaign as completed
      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      return NextResponse.json({
        success: true,
        message: 'Campaign completed - no pending messages'
      })
    }

    // Initialize device states
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const deviceStates: DeviceState[] = await Promise.all(
      connectedDevices.map(async (device) => {
        // Count messages sent today by this device (approximation - we track per campaign for now)
        const { count } = await supabase
          .from('campaign_messages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'sent')
          .gte('sent_at', todayStart.toISOString())

        return {
          connectionId: device.id,
          sessionName: device.session_name,
          phoneNumber: device.phone_number || null,
          displayName: device.display_name || null,
          messagesInBatch: 0,
          batchIndex: 0,
          messagesToday: Math.floor((count || 0) / connectedDevices.length), // Distribute count estimate
          isAvailable: true,
        }
      })
    )

    // Calculate daily limit with variation bonus
    const messageVariations: string[] = campaign.message_variations || []
    const variationCount = messageVariations.length > 1 ? messageVariations.length : 0
    const extraVariationBonus = variationCount > 1 ? (variationCount - 1) * VARIATION_BONUS : 0
    const maxMessagesPerDayPerDevice = BASE_MESSAGES_PER_DAY_PER_DEVICE + extraVariationBonus

    console.log(`[VARIATIONS] ${variationCount} variations, daily limit: ${maxMessagesPerDayPerDevice} per device`)

    // Process messages with RANDOM distribution across devices (human-like behavior)
    let sentCount = 0
    let failedCount = 0

    for (const message of messages) {
      // Find a RANDOM available device (not round-robin for human-like behavior)
      const deviceState = getRandomDevice(deviceStates, maxMessagesPerDayPerDevice)

      // If no device available (all reached daily limit), pause campaign
      if (!deviceState) {
        const totalDailyLimit = connectedDevices.length * maxMessagesPerDayPerDevice
        console.log(`All devices reached daily limit (${totalDailyLimit} total). Pausing until tomorrow.`)

        const midnight = new Date()
        midnight.setDate(midnight.getDate() + 1)
        midnight.setHours(0, 0, 0, 0)

        await supabase
          .from('campaigns')
          .update({ status: 'paused' })
          .eq('id', campaignId)

        return NextResponse.json({
          success: true,
          message: `כל המכשירים הגיעו למגבלה היומית (${totalDailyLimit} הודעות). הקמפיין יחודש מחר.`,
          sent: sentCount,
          failed: failedCount,
          pausedUntil: midnight.toISOString()
        })
      }

      // Check if current device needs a batch break
      if (deviceState.messagesInBatch >= MESSAGES_PER_BATCH && deviceState.batchIndex < BATCH_BREAKS.length) {
        const breakDuration = BATCH_BREAKS[deviceState.batchIndex]
        // Add randomness to break duration (±10%)
        const randomizedBreak = breakDuration * (0.9 + Math.random() * 0.2)
        const breakMinutes = Math.round(randomizedBreak / 60000)
        console.log(`[SYSTEM] Device ${deviceState.sessionName} taking ~${breakMinutes} min break after batch ${deviceState.batchIndex + 1}`)

        // Mark device as unavailable during break
        deviceState.isAvailable = false

        // Schedule device to become available after break (non-blocking)
        setTimeout(() => {
          deviceState!.messagesInBatch = 0
          deviceState!.batchIndex++
          deviceState!.isAvailable = true
        }, randomizedBreak)

        // Try another device randomly instead of sequential
        continue
      }

      // Check if we need a USER-DEFINED pause
      if (campaign.pause_after_messages && campaign.pause_seconds) {
        const totalSent = sentCount + failedCount
        if (totalSent > 0 && totalSent % campaign.pause_after_messages === 0) {
          const userPauseMs = campaign.pause_seconds * 1000
          const userPauseMinutes = Math.round(campaign.pause_seconds / 60)
          console.log(`[USER] Taking ${userPauseMinutes > 0 ? userPauseMinutes + ' min' : campaign.pause_seconds + ' sec'} break after ${totalSent} messages`)

          await new Promise(resolve => setTimeout(resolve, userPauseMs))
        }
      }

      try {
        // Format phone number for WhatsApp
        const phone = message.phone.replace(/\D/g, '')
        const chatId = `${phone}@c.us`

        // Select random variation or use base message
        const messageText = getRandomVariation(messageVariations, message.message_content)
        const variationIndex = messageVariations.indexOf(messageText) + 1
        const variationInfo = messageVariations.length > 1 ? ` [Var ${variationIndex}]` : ''

        console.log(`[SEND] Device: ${deviceState.sessionName}, Phone: ${phone}${variationInfo}`)

        let response: { id: string } = { id: `msg_${Date.now()}` }
        let textSent = false
        let mediaSent = false
        let pollSent = false

        // Send text message if there's content (with random variation if enabled)
        if (messageText && messageText.trim()) {
          response = await waha.messages.sendText({
            session: deviceState.sessionName,
            chatId,
            text: messageText
          })
          textSent = true
        }

        // Send media if configured
        let mediaSuccess = true
        let mediaErrorMessage = ''
        if (campaign.media_url && campaign.media_type) {
          try {
            console.log(`[MEDIA] Sending ${campaign.media_type} to ${phone}`)
            if (campaign.media_type === 'image') {
              const mediaResponse = await waha.messages.sendImage({
                session: deviceState.sessionName,
                chatId,
                file: { url: campaign.media_url }
              })
              if (!textSent) response = mediaResponse
            } else if (campaign.media_type === 'video') {
              const mediaResponse = await waha.messages.sendVideo({
                session: deviceState.sessionName,
                chatId,
                file: { url: campaign.media_url }
              })
              if (!textSent) response = mediaResponse
            } else if (campaign.media_type === 'document') {
              const mediaResponse = await waha.messages.sendFile({
                session: deviceState.sessionName,
                chatId,
                file: { url: campaign.media_url }
              })
              if (!textSent) response = mediaResponse
            } else if (campaign.media_type === 'audio') {
              // Send voice message (PTT) - use sendVoice endpoint
              console.log(`[AUDIO] Attempting to send voice message to ${phone}`)
              console.log(`[AUDIO] Media URL: ${campaign.media_url}`)

              // Use exact format from WAHA documentation:
              // { chatId, file: { mimetype, url }, convert: true, session }
              const mediaResponse = await waha.messages.sendVoice({
                session: deviceState.sessionName,
                chatId,
                file: {
                  mimetype: 'audio/ogg; codecs=opus',
                  url: campaign.media_url
                },
                convert: true
              })
              if (!textSent) response = mediaResponse
              console.log(`[AUDIO] SUCCESS: Voice message sent to ${phone}`)
            }
            mediaSent = true
            console.log(`[MEDIA] Successfully sent ${campaign.media_type} to ${phone}`)
          } catch (mediaError) {
            mediaSuccess = false
            mediaErrorMessage = mediaError instanceof Error ? mediaError.message : 'Media sending failed'
            console.error(`[MEDIA] Failed to send ${campaign.media_type} to ${phone}:`, mediaError)
          }
        }

        // Send poll if configured
        let pollSuccess = true
        let pollErrorMessage = ''
        if (campaign.poll_question && campaign.poll_options && campaign.poll_options.length >= 2) {
          try {
            console.log(`[POLL] Sending poll: "${campaign.poll_question}" to ${phone}`)
            await waha.messages.sendPoll({
              session: deviceState.sessionName,
              chatId,
              name: campaign.poll_question,
              options: campaign.poll_options,
              multipleAnswers: campaign.poll_multiple_answers || false
            })
            pollSent = true
            console.log(`[POLL] Successfully sent poll to ${phone}`)
          } catch (pollError) {
            pollSuccess = false
            pollErrorMessage = pollError instanceof Error ? pollError.message : 'Poll sending failed'
            console.error(`[POLL] Failed to send poll to ${phone}:`, pollError)
          }
        }

        // Check if this was a media-only or poll-only message and nothing was sent successfully
        const hasText = messageText && messageText.trim()
        const hasMedia = campaign.media_url && campaign.media_type
        const hasPoll = campaign.poll_question && campaign.poll_options && campaign.poll_options.length >= 2

        // If it's a media-only message and media failed, mark as failed
        if (!hasText && !hasPoll && hasMedia && !mediaSuccess) {
          throw new Error('שליחת מדיה נכשלה')
        }

        // If it's a poll-only message and poll failed, mark as failed
        if (!hasText && !hasMedia && hasPoll && !pollSuccess) {
          throw new Error('שליחת סקר נכשלה')
        }

        // If nothing was sent at all (shouldn't happen), mark as failed
        if (!textSent && !mediaSent && !pollSent) {
          throw new Error('לא נשלח תוכן כלשהו')
        }

        // Update message status - include poll error info, sender info, and actual sent message
        const updateData: {
          status: string
          waha_message_id: string
          sent_at: string
          sent_message_content: string
          sender_session_name: string
          sender_phone: string | null
          error_message?: string
        } = {
          status: 'sent',
          waha_message_id: response.id,
          sent_at: new Date().toISOString(),
          sent_message_content: messageText, // The actual message that was sent (after variation selection)
          sender_session_name: deviceState.displayName || deviceState.sessionName, // Use display name or session name
          sender_phone: deviceState.phoneNumber // The phone number of the sending device
        }

        // Build partial error message if some parts failed but message was still sent
        const partialErrors: string[] = []
        if (!pollSuccess) {
          partialErrors.push('סקר נכשל')
        }
        if (!mediaSuccess) {
          partialErrors.push('מדיה נכשלה')
        }
        if (partialErrors.length > 0) {
          updateData.error_message = `הודעה נשלחה, אך: ${partialErrors.join(', ')}`
        }

        await supabase
          .from('campaign_messages')
          .update(updateData)
          .eq('id', message.id)

        sentCount++
        deviceState.messagesInBatch++
        deviceState.messagesToday++

        // Update campaign sent count
        await supabase
          .from('campaigns')
          .update({ sent_count: sentCount })
          .eq('id', campaignId)

      } catch (sendError: unknown) {
        console.error(`Failed to send message to ${message.phone}:`, sendError)

        // Update message as failed with user-friendly error message
        // Keep technical details in console log only
        let userFriendlyError = 'שליחה נכשלה'
        if (sendError instanceof Error) {
          // Check for known error patterns and show friendly message
          if (sendError.message.includes('מדיה')) {
            userFriendlyError = 'שליחת מדיה נכשלה'
          } else if (sendError.message.includes('סקר')) {
            userFriendlyError = 'שליחת סקר נכשלה'
          } else if (sendError.message.includes('תוכן')) {
            userFriendlyError = 'לא נשלח תוכן'
          }
        }

        await supabase
          .from('campaign_messages')
          .update({
            status: 'failed',
            error_message: userFriendlyError
          })
          .eq('id', message.id)

        failedCount++

        // Update campaign failed count
        await supabase
          .from('campaigns')
          .update({ failed_count: failedCount })
          .eq('id', campaignId)
      }

      // Random delay between messages (10-60 seconds) with human-like variation
      const delayMs = getRandomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS)
      console.log(`Waiting ${delayMs / 1000} seconds before next message...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))

      // Check if campaign was paused
      const { data: currentCampaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single()

      if (currentCampaign?.status === 'paused') {
        return NextResponse.json({
          success: true,
          message: 'Campaign paused',
          sent: sentCount,
          failed: failedCount
        })
      }
    }

    // Mark campaign as completed
    await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    return NextResponse.json({
      success: true,
      message: 'Campaign completed',
      sent: sentCount,
      failed: failedCount,
      total: messages.length,
      devicesUsed: connectedDevices.length
    })

  } catch (error) {
    console.error('Campaign process error:', error)

    // Mark campaign as failed
    const supabase = await createClient()
    await supabase
      .from('campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId)

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
