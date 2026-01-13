import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Get single campaign with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        connection:connections(session_name, phone_number, display_name),
        messages:campaign_messages(*)
      `)
      .eq('id', campaignId)
      .single()

    if (error) {
      console.error('Error fetching campaign:', error)
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Campaign GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update campaign (pause/resume/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Get current campaign status
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    let newStatus: string
    let message: string

    switch (action) {
      case 'pause':
        if (campaign.status !== 'running') {
          return NextResponse.json({ error: 'Can only pause running campaigns' }, { status: 400 })
        }
        newStatus = 'paused'
        message = 'Campaign paused'
        break

      case 'resume':
        if (campaign.status !== 'paused') {
          return NextResponse.json({ error: 'Can only resume paused campaigns' }, { status: 400 })
        }
        newStatus = 'running'
        message = 'Campaign resumed'

        // Trigger processing again
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/campaigns/${campaignId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(err => console.error('Failed to trigger campaign processing:', err))
        break

      case 'cancel':
        if (!['scheduled', 'running', 'paused'].includes(campaign.status)) {
          return NextResponse.json({ error: 'Cannot cancel this campaign' }, { status: 400 })
        }
        newStatus = 'cancelled'
        message = 'Campaign cancelled'

        // Also update all pending messages to cancelled
        const { error: messagesUpdateError } = await supabase
          .from('campaign_messages')
          .update({ status: 'cancelled' })
          .eq('campaign_id', campaignId)
          .eq('status', 'pending')

        if (messagesUpdateError) {
          console.error('Error updating messages to cancelled:', messagesUpdateError)
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message, status: newStatus })
  } catch (error) {
    console.error('Campaign PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update campaign (full update for editing)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params
  console.log('=== PUT /api/campaigns/[id] called ===')
  console.log('Campaign ID:', campaignId)

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if campaign exists and can be edited (only draft campaigns)
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (existingCampaign.status !== 'draft') {
      return NextResponse.json({
        error: 'ניתן לערוך רק קמפיינים בסטטוס טיוטה'
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      connection_id,
      message_template,
      media_url,
      media_type,
      scheduled_at,
      delay_min = 3,
      delay_max = 10,
      pause_after_messages,
      pause_seconds,
      recipients,
      exclusion_list,
      new_list_name,
      existing_list_id,
      multi_device,
      device_ids,
      // Message variations
      message_variations,
      // Poll data
      poll_question,
      poll_options,
      poll_multiple_answers,
    } = body

    // Validation - allow empty message if poll is present
    if (!name) {
      return NextResponse.json({
        error: 'Missing required field: name'
      }, { status: 400 })
    }

    // Must have either message_template, poll, or media
    if (!message_template && !poll_question && !media_url) {
      return NextResponse.json({
        error: 'נדרש תוכן הודעה, סקר, או מדיה'
      }, { status: 400 })
    }

    // Get the device IDs to use
    const connectionIds = multi_device && device_ids?.length > 0 ? device_ids : [connection_id]

    if (!connectionIds || connectionIds.length === 0) {
      return NextResponse.json({
        error: 'At least one connection is required'
      }, { status: 400 })
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({
        error: 'At least one recipient is required'
      }, { status: 400 })
    }

    // Verify all connections belong to user and are connected
    const { data: connections, error: connError } = await supabase
      .from('connections')
      .select('id, status, session_name')
      .in('id', connectionIds)

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json({ error: 'Connections not found' }, { status: 404 })
    }

    const connectedDevices = connections.filter(c => c.status === 'connected')
    if (connectedDevices.length === 0) {
      return NextResponse.json({
        error: 'No active WhatsApp connections. Please reconnect first.'
      }, { status: 400 })
    }

    const primaryConnectionId = connectedDevices[0].id

    // Filter out excluded phones
    const exclusionSet = new Set((exclusion_list || []).map((p: string) => p.replace(/\D/g, '')))
    const filteredRecipients = recipients.filter((r: { phone: string }) => {
      const cleanPhone = r.phone.replace(/\D/g, '')
      return !exclusionSet.has(cleanPhone)
    })

    if (filteredRecipients.length === 0) {
      return NextResponse.json({
        error: 'All recipients are in the exclusion list'
      }, { status: 400 })
    }

    // Update campaign
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        connection_id: primaryConnectionId,
        name,
        message_template: message_template || '',
        media_url: media_url || null,
        media_type: media_type || null,
        scheduled_at: scheduled_at || null,
        total_recipients: filteredRecipients.length,
        delay_min,
        delay_max,
        pause_after_messages: pause_after_messages || null,
        pause_seconds: pause_seconds || null,
        new_list_name: new_list_name || null,
        existing_list_id: existing_list_id || null,
        multi_device: multi_device || false,
        device_ids: connectedDevices.map(c => c.id),
        // Message variations
        message_variations: message_variations || [],
        // Poll data
        poll_question: poll_question || null,
        poll_options: poll_options || null,
        poll_multiple_answers: poll_multiple_answers || false,
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    // Delete old messages - first count how many exist
    const { data: existingMessages } = await supabase
      .from('campaign_messages')
      .select('id')
      .eq('campaign_id', campaignId)

    console.log('Found', existingMessages?.length || 0, 'existing messages to delete for campaign:', campaignId)

    if (existingMessages && existingMessages.length > 0) {
      const messageIds = existingMessages.map(m => m.id)
      const { error: deleteError } = await supabase
        .from('campaign_messages')
        .delete()
        .in('id', messageIds)

      if (deleteError) {
        console.error('Error deleting old messages:', deleteError)
        return NextResponse.json({ error: 'Failed to delete old messages' }, { status: 500 })
      }
      console.log('Successfully deleted', messageIds.length, 'messages')
    }

    // Create new campaign messages with pre-calculated delays
    // Constants for timing
    const MESSAGES_PER_BULK = 30
    const BULK_PAUSE_SECONDS = [
      30 * 60,    // After 1st bulk (30 messages): 30 minutes
      60 * 60,    // After 2nd bulk (60 messages): 1 hour
      90 * 60,    // After 3rd bulk (90 messages): 1.5 hours - and this repeats
    ]

    let cumulativeDelaySeconds = 0
    const campaignMessages = filteredRecipients.map((recipient: { phone: string; name?: string; variables?: Record<string, string> }, index: number) => {
      let messageContent = message_template
      messageContent = messageContent.replace(/\{שם\}/g, recipient.name || '')
      messageContent = messageContent.replace(/\{טלפון\}/g, recipient.phone)

      if (recipient.variables) {
        Object.entries(recipient.variables).forEach(([key, value]) => {
          messageContent = messageContent.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
        })
      }

      // Calculate random delay for this message
      const messageDelay = Math.floor(Math.random() * (delay_max - delay_min + 1)) + delay_min
      cumulativeDelaySeconds += messageDelay

      // Add bulk pause if this message completes a bulk (every 30 messages)
      const messageNumber = index + 1
      if (messageNumber > 0 && messageNumber % MESSAGES_PER_BULK === 0) {
        const bulkIndex = Math.floor(messageNumber / MESSAGES_PER_BULK) - 1
        const pauseIndex = Math.min(bulkIndex, BULK_PAUSE_SECONDS.length - 1)
        cumulativeDelaySeconds += BULK_PAUSE_SECONDS[pauseIndex]
      }

      return {
        campaign_id: campaignId,
        phone: recipient.phone,
        name: recipient.name || null,
        message_content: messageContent.trim(),
        variables: recipient.variables || {},
        status: 'pending',
        scheduled_delay_seconds: cumulativeDelaySeconds,
      }
    })

    console.log('Inserting', campaignMessages.length, 'new messages')
    const { error: messagesError } = await supabase
      .from('campaign_messages')
      .insert(campaignMessages)

    if (messagesError) {
      console.error('Error creating campaign messages:', messagesError)
      return NextResponse.json({ error: 'Failed to update campaign messages' }, { status: 500 })
    }

    // Verify message count after insert
    const { data: finalMessages, count: finalCount } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId)
    console.log('Final message count after insert:', finalCount, 'rows:', finalMessages?.length)

    // Get updated campaign
    const { data: updatedCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: 'הקמפיין עודכן בהצלחה'
    })

  } catch (error) {
    console.error('Campaign PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if campaign can be deleted (not running)
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'running') {
      return NextResponse.json({
        error: 'Cannot delete running campaign. Pause or cancel it first.'
      }, { status: 400 })
    }

    // Delete campaign (messages will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Campaign deleted' })
  } catch (error) {
    console.error('Campaign DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
