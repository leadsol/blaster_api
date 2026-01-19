import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { scheduleMessage, scheduleNextBatch, isQStashConfigured } from '@/lib/qstash'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

// Constants
const BATCH_SIZE = 5 // Messages to schedule per batch call
const BASE_MESSAGES_PER_DAY_PER_DEVICE = 90
const EXEMPT_MESSAGES_PER_VARIATION = 10 // Extra messages per variation that don't count towards daily limit

// This endpoint processes a batch of messages and schedules them via QStash
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    // Use admin client since QStash callbacks don't have user session
    const supabase = createAdminClient()

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('[PROCESS-BATCH] Campaign not found:', campaignId)
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if campaign should be running
    if (!['running', 'draft', 'scheduled'].includes(campaign.status)) {
      console.log(`[PROCESS-BATCH] Campaign ${campaignId} not in runnable state (${campaign.status})`)
      return NextResponse.json({ success: true, skipped: true, reason: `Campaign status is ${campaign.status}` })
    }

    // Check if campaign is active (is_active toggle)
    if (campaign.is_active === false) {
      console.log(`[PROCESS-BATCH] Campaign ${campaignId} is deactivated (is_active: false)`)
      return NextResponse.json({ success: true, skipped: true, reason: 'Campaign is deactivated' })
    }

    // If campaign is draft/scheduled, update to running and set started_at
    if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      await supabase
        .from('campaigns')
        .update({
          status: 'running',
          started_at: campaign.started_at || new Date().toISOString()
        })
        .eq('id', campaignId)
    }

    // Calculate daily limit
    // Base limit is 90 messages per device
    // Exempt messages from variations don't count towards the limit
    const messageVariations: string[] = campaign.message_variations || []
    const variationCount = messageVariations.filter(v => v && v.trim().length > 0).length
    const exemptMessages = variationCount > 1 ? (variationCount - 1) * EXEMPT_MESSAGES_PER_VARIATION : 0
    const deviceCount = campaign.multi_device && campaign.device_ids ? campaign.device_ids.length : 1
    const baseLimit = BASE_MESSAGES_PER_DAY_PER_DEVICE * deviceCount

    // Count messages sent today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: sentToday } = await supabase
      .from('campaign_messages')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')
      .gte('sent_at', todayStart.toISOString())

    const messagesTodayCount = sentToday || 0

    // Calculate effective count - subtract exempt messages from count
    // This means the first X exempt messages "don't count" against the limit
    const effectiveCount = Math.max(0, messagesTodayCount - exemptMessages)

    // Check if daily limit reached (comparing effective count to base limit)
    if (effectiveCount >= baseLimit) {
      console.log(`[PROCESS-BATCH] Daily limit reached (sent: ${messagesTodayCount}, exempt: ${exemptMessages}, effective: ${effectiveCount}/${baseLimit})`)

      // Calculate time until midnight
      const now = new Date()
      const midnight = new Date()
      midnight.setDate(midnight.getDate() + 1)
      midnight.setHours(0, 0, 0, 0)
      const secondsUntilMidnight = Math.ceil((midnight.getTime() - now.getTime()) / 1000)

      // Schedule next batch for tomorrow
      await scheduleNextBatch(campaignId, secondsUntilMidnight)

      await supabase
        .from('campaigns')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      return NextResponse.json({
        success: true,
        paused: true,
        reason: 'Daily limit reached',
        resumeAt: midnight.toISOString()
      })
    }

    // Get pending messages (limited to batch size)
    // IMPORTANT: Order by scheduled_delay_seconds to ensure proper spacing calculation
    // (created_at may have identical timestamps for batch-inserted messages)
    const { data: pendingMessages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('id, scheduled_delay_seconds')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('scheduled_delay_seconds', { ascending: true })
      .limit(BATCH_SIZE)

    if (messagesError) {
      console.error('[PROCESS-BATCH] Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      // No more pending messages - campaign complete
      console.log(`[PROCESS-BATCH] Campaign ${campaignId} completed - no pending messages`)

      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      return NextResponse.json({ success: true, completed: true })
    }

    // Count how many messages have been successfully sent so far (for bulk pause calculation)
    const { count: totalSentCount } = await supabase
      .from('campaign_messages')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')

    const sentSoFar = totalSentCount || 0
    console.log(`[PROCESS-BATCH] Total sent messages so far: ${sentSoFar}`)

    // Schedule messages using their pre-calculated scheduled_delay_seconds
    // The bulk pauses are ALREADY included in scheduled_delay_seconds when the campaign was created
    // DO NOT add bulk pauses again here - that would cause double pauses!
    let scheduledCount = 0
    let cumulativeDelay = 10 // Start with initial delay of 10 seconds
    const MIN_DELAY = 10 // Minimum delay between messages
    const MAX_DELAY = 60 // Maximum delay between messages

    for (let i = 0; i < pendingMessages.length; i++) {
      const message = pendingMessages[i]
      const currentDelay = message.scheduled_delay_seconds || 0

      let delayFromNow: number

      if (i === 0) {
        // First message: send after initial delay (10-20 seconds)
        delayFromNow = MIN_DELAY + Math.floor(Math.random() * 10)
        cumulativeDelay = delayFromNow
      } else {
        // Calculate the spacing between this message and the previous one from stored values
        // This spacing ALREADY includes any bulk pauses that were calculated at campaign creation
        const prevDelay = pendingMessages[i - 1].scheduled_delay_seconds || 0
        let spacing = currentDelay - prevDelay

        // If spacing is invalid (< 10 seconds), generate random spacing between 10-60 seconds
        // This handles legacy campaigns that may not have proper scheduled_delay_seconds
        if (spacing < MIN_DELAY) {
          spacing = MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1))
          console.log(`[PROCESS-BATCH] Generated random spacing: ${spacing}s (original was ${currentDelay - prevDelay}s)`)
        }

        // Accumulate the spacing (which already includes bulk pauses from scheduled_delay_seconds)
        cumulativeDelay += spacing
        delayFromNow = cumulativeDelay
      }

      console.log(`[PROCESS-BATCH] Scheduling message ${message.id} with ${delayFromNow}s total delay from now (scheduled_delay: ${currentDelay}s)`)

      // Check if QStash is available for scheduling
      if (isQStashConfigured()) {
        const result = await scheduleMessage(campaignId, message.id, delayFromNow)
        if (result) {
          scheduledCount++
        }
      } else {
        // FALLBACK: Direct send without QStash (localhost mode)
        // Schedule direct HTTP call after delay using fire-and-forget
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const CRON_SECRET = process.env.CRON_SECRET

        // Use setTimeout to delay the direct call
        setTimeout(async () => {
          try {
            console.log(`[FALLBACK] Sending message ${message.id} now`)
            await fetch(`${appUrl}/api/campaigns/${campaignId}/send-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': CRON_SECRET || ''
              },
              body: JSON.stringify({ messageId: message.id })
            })
          } catch (err) {
            console.error(`[FALLBACK] Failed to send message ${message.id}:`, err)
          }
        }, delayFromNow * 1000)

        scheduledCount++
        console.log(`[FALLBACK] Scheduled message ${message.id} with ${delayFromNow}s delay (setTimeout)`)
      }
    }

    const lastScheduledDelay = cumulativeDelay

    // Check if there are more messages to process
    const { count: remainingCount } = await supabase
      .from('campaign_messages')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    const remaining = (remainingCount || 0) - scheduledCount

    if (remaining > 0) {
      // Schedule next batch after the last message in this batch should be sent
      // Add 10 seconds buffer after the last scheduled message
      const nextBatchDelay = lastScheduledDelay + 10

      console.log(`[PROCESS-BATCH] Scheduling next batch in ${nextBatchDelay}s (${remaining} messages remaining)`)

      if (isQStashConfigured()) {
        await scheduleNextBatch(campaignId, nextBatchDelay)
      } else {
        // FALLBACK: Schedule next batch directly
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const CRON_SECRET = process.env.CRON_SECRET

        setTimeout(async () => {
          try {
            console.log(`[FALLBACK] Triggering next batch for campaign ${campaignId}`)
            await fetch(`${appUrl}/api/campaigns/${campaignId}/process-batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': CRON_SECRET || ''
              }
            })
          } catch (err) {
            console.error(`[FALLBACK] Failed to trigger next batch:`, err)
          }
        }, nextBatchDelay * 1000)

        console.log(`[FALLBACK] Scheduled next batch in ${nextBatchDelay}s (setTimeout)`)
      }
    } else {
      // No more pending messages - schedule a final check to mark campaign as completed
      // This will run after the last message is sent
      const finalCheckDelay = lastScheduledDelay + 15
      console.log(`[PROCESS-BATCH] Scheduling final check in ${finalCheckDelay}s to mark campaign as completed`)

      if (isQStashConfigured()) {
        await scheduleNextBatch(campaignId, finalCheckDelay)
      } else {
        // FALLBACK: Schedule final check directly
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const CRON_SECRET = process.env.CRON_SECRET

        setTimeout(async () => {
          try {
            console.log(`[FALLBACK] Final check for campaign ${campaignId}`)
            await fetch(`${appUrl}/api/campaigns/${campaignId}/process-batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': CRON_SECRET || ''
              }
            })
          } catch (err) {
            console.error(`[FALLBACK] Failed to trigger final check:`, err)
          }
        }, finalCheckDelay * 1000)

        console.log(`[FALLBACK] Scheduled final check in ${finalCheckDelay}s (setTimeout)`)
      }
    }

    return NextResponse.json({
      success: true,
      scheduled: scheduledCount,
      remaining: remaining
    })

  } catch (error) {
    console.error('[PROCESS-BATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Verify QStash signature in production (but allow direct calls too for initial launch)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Check if this is a QStash callback (has signature header)
  const hasQStashSignature = request.headers.get('upstash-signature')

  if (hasQStashSignature && process.env.NODE_ENV === 'production') {
    // Verify signature for QStash callbacks
    return verifySignatureAppRouter(handler)(request, context)
  }

  // For direct calls (initial launch), verify user authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    // Also allow internal secret for cron jobs
    const internalSecret = request.headers.get('x-internal-secret')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || internalSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return handler(request, context)
}
