import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { scheduleMessage, scheduleNextBatch, isQStashConfigured } from '@/lib/qstash'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

// Constants
const BATCH_SIZE = 5 // Messages to schedule per batch call
const BASE_MESSAGES_PER_DAY_PER_DEVICE = 90
const VARIATION_BONUS = 10

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

    // If campaign is draft/scheduled/paused, update to running
    // IMPORTANT: When resuming a paused campaign, we need to recalculate scheduled_delay_seconds
    // to maintain proper spacing from NOW, not from the original start time
    if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      await supabase
        .from('campaigns')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      // Update campaign object with new started_at
      campaign.started_at = new Date().toISOString()
    } else if (campaign.status === 'paused' || campaign.status === 'running') {
      // For resumed campaigns, reset started_at to NOW so delays are calculated from current time
      const newStartedAt = new Date().toISOString()
      await supabase
        .from('campaigns')
        .update({
          status: 'running',
          started_at: newStartedAt
        })
        .eq('id', campaignId)

      // Also recalculate scheduled_delay_seconds for remaining pending messages
      // Get the first pending message to use as baseline
      const { data: firstPending } = await supabase
        .from('campaign_messages')
        .select('scheduled_delay_seconds')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('scheduled_delay_seconds', { ascending: true })
        .limit(1)
        .single()

      if (firstPending) {
        const baselineDelay = firstPending.scheduled_delay_seconds || 0

        // Get all pending messages to recalculate their delays
        const { data: allPending } = await supabase
          .from('campaign_messages')
          .select('id, scheduled_delay_seconds')
          .eq('campaign_id', campaignId)
          .eq('status', 'pending')
          .order('scheduled_delay_seconds', { ascending: true })

        if (allPending && allPending.length > 0) {
          // Update each message's scheduled_delay_seconds to be relative to the first one
          // This preserves the spacing pattern while starting from 0 (NOW)
          for (const msg of allPending) {
            const originalDelay = msg.scheduled_delay_seconds || 0
            const newDelay = originalDelay - baselineDelay

            await supabase
              .from('campaign_messages')
              .update({ scheduled_delay_seconds: newDelay })
              .eq('id', msg.id)
          }

          console.log(`[PROCESS-BATCH] Recalculated delays for ${allPending.length} pending messages (baseline was ${baselineDelay}s)`)
        }
      }

      campaign.started_at = newStartedAt
    }

    // Calculate daily limit
    const messageVariations: string[] = campaign.message_variations || []
    const variationCount = messageVariations.length > 1 ? messageVariations.length : 0
    const extraVariationBonus = variationCount > 1 ? (variationCount - 1) * VARIATION_BONUS : 0
    const deviceCount = campaign.multi_device && campaign.device_ids ? campaign.device_ids.length : 1
    const maxMessagesPerDay = (BASE_MESSAGES_PER_DAY_PER_DEVICE + extraVariationBonus) * deviceCount

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

    // Check if daily limit reached
    if (messagesTodayCount >= maxMessagesPerDay) {
      console.log(`[PROCESS-BATCH] Daily limit reached (${messagesTodayCount}/${maxMessagesPerDay})`)

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
        .update({ status: 'paused' })
        .eq('id', campaignId)

      return NextResponse.json({
        success: true,
        paused: true,
        reason: 'Daily limit reached',
        resumeAt: midnight.toISOString()
      })
    }

    // Get pending messages (limited to batch size)
    const { data: pendingMessages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('id, scheduled_delay_seconds')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
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

    // Get the campaign start time to calculate relative delays
    // After recalculation above, started_at is set to NOW for resumed campaigns
    const campaignStartTime = campaign.started_at ? new Date(campaign.started_at).getTime() : Date.now()
    const now = Date.now()

    // Schedule each message using the pre-calculated scheduled_delay_seconds
    let scheduledCount = 0
    let lastScheduledDelay = 0

    for (const message of pendingMessages) {
      // Use the pre-calculated delay from campaign creation (or recalculated for resumed campaigns)
      // This includes the 10-60 second random delays AND the 30min/1hr/1.5hr bulk pauses
      const scheduledDelaySeconds = message.scheduled_delay_seconds || 0

      // Calculate when this message should be sent relative to campaign start
      const targetTime = campaignStartTime + (scheduledDelaySeconds * 1000)

      // Calculate delay from NOW
      let delayFromNow = Math.max(1, Math.ceil((targetTime - now) / 1000))

      // Add small randomness (0-3 seconds) to avoid exact patterns
      delayFromNow += Math.floor(Math.random() * 3)

      lastScheduledDelay = delayFromNow

      console.log(`[PROCESS-BATCH] Scheduling message ${message.id} with ${delayFromNow}s delay from now (scheduled_delay: ${scheduledDelaySeconds}s)`)

      const result = await scheduleMessage(campaignId, message.id, delayFromNow)
      if (result) {
        scheduledCount++
      }
    }

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
      await scheduleNextBatch(campaignId, nextBatchDelay)
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
