import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isQStashConfigured, scheduleNextBatch } from '@/lib/qstash'

const CRON_SECRET = process.env.CRON_SECRET

// POST - Start campaign processing
// This endpoint now triggers QStash-based processing instead of running a long loop
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    // Check authentication: either user session or internal cron secret
    const internalSecret = request.headers.get('x-internal-secret')
    const isInternalCall = CRON_SECRET && internalSecret === CRON_SECRET

    // Use admin client for internal calls, regular client for user calls
    let supabase
    if (isInternalCall) {
      supabase = createAdminClient()
    } else {
      supabase = await createClient()
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get campaign
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

    // Verify at least one device is connected
    const { data: deviceConnections, error: devicesError } = await supabase
      .from('connections')
      .select('id, session_name, status')
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

    // CRITICAL: Check if any of the devices are already busy in another running campaign
    // This prevents race conditions where multiple campaigns try to use the same device
    for (const device of connectedDevices) {
      const { data: otherRunningCampaign } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'running')
        .neq('id', campaignId) // Exclude current campaign
        .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)
        .limit(1)
        .single()

      if (otherRunningCampaign) {
        console.error(`❌ [PROCESS] Device ${device.session_name} is busy in campaign "${otherRunningCampaign.name}"`)

        // Mark campaign as failed - cannot start because device is busy
        await supabase
          .from('campaigns')
          .update({
            status: 'failed',
            error_message: `המכשיר ${device.session_name} עסוק בקמפיין "${otherRunningCampaign.name}"`
          })
          .eq('id', campaignId)

        return NextResponse.json({
          error: `Device ${device.session_name} is busy in another campaign: "${otherRunningCampaign.name}"`,
          busyCampaign: otherRunningCampaign.name
        }, { status: 409 }) // 409 Conflict
      }
    }

    // Check if there are pending messages
    const { count: pendingCount } = await supabase
      .from('campaign_messages')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    if (!pendingCount || pendingCount === 0) {
      // No pending messages
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

    // Update campaign status to running
    // Only set started_at if this is the first time (was draft/scheduled)
    const updateData: Record<string, string> = { status: 'running' }
    if (!campaign.started_at) {
      updateData.started_at = new Date().toISOString()
    }

    await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)

    console.log(`[PROCESS] Starting campaign ${campaignId} with ${pendingCount} pending messages`)
    console.log(`[PROCESS] Using ${connectedDevices.length} device(s)`)

    // Check if QStash is configured
    if (isQStashConfigured()) {
      // Use QStash for reliable message scheduling
      console.log('[PROCESS] Using QStash for message scheduling')

      // Schedule the first batch immediately
      const result = await scheduleNextBatch(campaignId, 0)

      if (result) {
        return NextResponse.json({
          success: true,
          message: 'Campaign started - messages are being scheduled',
          qstashMessageId: result.messageId,
          pendingMessages: pendingCount,
          devicesUsed: connectedDevices.length
        })
      } else {
        // QStash scheduling failed, fall back to direct call
        console.error('[PROCESS] QStash scheduling failed, attempting direct process')
      }
    }

    // Fallback: Call process-batch directly (will work for small campaigns)
    // This is a backup in case QStash is not configured or fails
    console.log('[PROCESS] Falling back to direct batch processing')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${appUrl}/api/campaigns/${campaignId}/process-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': CRON_SECRET || ''
      }
    }).catch(err => {
      console.error('[PROCESS] Background batch processing error:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign started',
      pendingMessages: pendingCount,
      devicesUsed: connectedDevices.length
    })

  } catch (error) {
    console.error('Campaign process error:', error)

    // Mark campaign as failed - use admin client to bypass RLS
    try {
      const adminSupabase = createAdminClient()
      await adminSupabase
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', campaignId)
    } catch (e) {
      console.error('Failed to update campaign status:', e)
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
