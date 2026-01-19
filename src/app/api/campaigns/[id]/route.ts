import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone-utils'

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

    // Get current campaign status and timing info
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('status, started_at, estimated_duration, paused_at')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    let newStatus: string
    let message: string
    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'pause':
        if (campaign.status !== 'running') {
          return NextResponse.json({ error: 'ניתן להשהות רק קמפיינים פעילים' }, { status: 400 })
        }
        newStatus = 'paused'
        message = 'הקמפיין הושהה'
        // Save the time when campaign was paused for countdown calculation
        updateData.paused_at = new Date().toISOString()
        break

      case 'resume':
        if (campaign.status !== 'paused') {
          return NextResponse.json({ error: 'ניתן להמשיך רק קמפיינים מושהים' }, { status: 400 })
        }
        newStatus = 'running'
        message = 'הקמפיין חודש'

        // Get the highest scheduled_delay_seconds from pending messages
        // This represents the remaining time needed to complete the campaign
        const { data: pendingMessages } = await supabase
          .from('campaign_messages')
          .select('scheduled_delay_seconds')
          .eq('campaign_id', campaignId)
          .eq('status', 'pending')
          .order('scheduled_delay_seconds', { ascending: false })
          .limit(1)

        // Update estimated_duration to reflect only remaining messages
        if (pendingMessages && pendingMessages.length > 0) {
          const lastPendingDelay = pendingMessages[0].scheduled_delay_seconds || 0

          // Get the highest scheduled_delay_seconds from sent messages to know where we left off
          const { data: sentMessages } = await supabase
            .from('campaign_messages')
            .select('scheduled_delay_seconds')
            .eq('campaign_id', campaignId)
            .in('status', ['sent', 'failed'])
            .order('scheduled_delay_seconds', { ascending: false })
            .limit(1)

          const lastSentDelay = sentMessages && sentMessages.length > 0
            ? (sentMessages[0].scheduled_delay_seconds || 0)
            : 0

          // Remaining duration = last pending message delay - last sent message delay
          const remainingDuration = lastPendingDelay - lastSentDelay
          updateData.estimated_duration = remainingDuration
        }

        // Set started_at to now since we're calculating remaining duration
        updateData.started_at = new Date().toISOString()
        updateData.paused_at = null // Clear paused_at

        // Trigger processing again - use stable app URL
        const resumeAppUrl = process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000'
          ? process.env.NEXT_PUBLIC_APP_URL
          : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        console.log(`[RESUME] Triggering process at: ${resumeAppUrl}/api/campaigns/${campaignId}/process`)

        fetch(`${resumeAppUrl}/api/campaigns/${campaignId}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.CRON_SECRET || '',
          },
        }).catch(err => console.error('Failed to trigger campaign processing:', err))
        break

      case 'cancel':
        if (!['scheduled', 'running', 'paused'].includes(campaign.status)) {
          return NextResponse.json({ error: 'לא ניתן לבטל קמפיין זה' }, { status: 400 })
        }
        newStatus = 'cancelled'
        message = 'הקמפיין בוטל'

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
        return NextResponse.json({ error: 'פעולה לא חוקית' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: newStatus, ...updateData })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return NextResponse.json({ error: 'שגיאה בעדכון הקמפיין' }, { status: 500 })
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
      delay_min = 10,
      delay_max = 60,
      pause_after_messages,
      pause_seconds,
      respect_active_hours,
      active_hours_start,
      active_hours_end,
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
      .select('id, status, session_name, display_name')
      .in('id', connectionIds)

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json({ error: 'Connections not found' }, { status: 404 })
    }

    const connectedDevices = connections.filter(c => c.status === 'connected')
    if (connectedDevices.length === 0) {
      return NextResponse.json({
        error: 'אין חיבורי WhatsApp פעילים. יש להתחבר מחדש.'
      }, { status: 400 })
    }

    // Check if any of the devices are busy in another running/paused campaign (excluding this campaign)
    for (const device of connectedDevices) {
      const { data: busyCampaign } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .in('status', ['running', 'paused'])
        .neq('id', campaignId) // Exclude current campaign being edited
        .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)
        .limit(1)
        .single()

      if (busyCampaign) {
        const deviceDisplayName = device.display_name || device.session_name
        return NextResponse.json({
          error: `המכשיר "${deviceDisplayName}" עסוק בקמפיין "${busyCampaign.name}" (${busyCampaign.status === 'running' ? 'פעיל' : 'מושהה'}). לא ניתן לשגר את הקמפיין עד שהקמפיין הקודם יסתיים או יבוטל.`,
          canSaveAsDraft: true
        }, { status: 409 })
      }
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
        respect_active_hours: respect_active_hours !== undefined ? respect_active_hours : true,
        active_hours_start: active_hours_start || null,
        active_hours_end: active_hours_end || null,
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
      return NextResponse.json({ error: 'שגיאה בעדכון הקמפיין' }, { status: 500 })
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
    // Constants for timing - DEFAULT bulk pauses (always active)
    const MESSAGES_PER_BULK = 30
    const BULK_PAUSE_SECONDS = [
      30 * 60,    // After 1st bulk (30 messages): 30 minutes
      60 * 60,    // After 2nd bulk (60 messages): 1 hour
      90 * 60,    // After 3rd bulk (90 messages): 1.5 hours - and this repeats
    ]

    // Custom pause settings (user-defined, IN ADDITION to default bulk pauses)
    const customPauseAfter = pause_after_messages || 0
    const customPauseSeconds = pause_seconds || 0
    const hasCustomPause = customPauseAfter > 0 && customPauseSeconds > 0

    let cumulativeDelaySeconds = 0
    console.log(`🟣 [PUT] Creating messages for ${filteredRecipients.length} recipients`)
    console.log(`🟣 [PUT] delay_min: ${delay_min}, delay_max: ${delay_max}`)
    if (hasCustomPause) {
      console.log(`🟣 [PUT] Custom pause: every ${customPauseAfter} messages, pause for ${customPauseSeconds}s (${customPauseSeconds/60} min)`)
    }

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

      // Add bulk pause ONLY if there are more messages after this bulk
      // Don't add pause after the last message of a campaign
      const messageNumber = index + 1
      const isLastMessage = messageNumber === filteredRecipients.length

      console.log(`🟣 [PUT] Message ${messageNumber}/${filteredRecipients.length}: delay=${messageDelay}s, cumulative=${cumulativeDelaySeconds}s, isLast=${isLastMessage}`)

      // DEFAULT bulk pause (every 30 messages)
      if (!isLastMessage && messageNumber % MESSAGES_PER_BULK === 0) {
        const bulkIndex = Math.floor(messageNumber / MESSAGES_PER_BULK) - 1
        const pauseIndex = Math.min(bulkIndex, BULK_PAUSE_SECONDS.length - 1)
        const pauseAmount = BULK_PAUSE_SECONDS[pauseIndex]
        console.log(`⏸️  [PUT] Adding DEFAULT bulk pause after message ${messageNumber}: ${pauseAmount}s (${pauseAmount/60} minutes)`)
        cumulativeDelaySeconds += pauseAmount
      }

      // CUSTOM pause (user-defined, in addition to default)
      // Only add if not on the same boundary as default bulk pause
      if (hasCustomPause && !isLastMessage && messageNumber % customPauseAfter === 0) {
        // Skip if this is also a default bulk pause boundary (avoid double pause on same message)
        if (messageNumber % MESSAGES_PER_BULK !== 0) {
          console.log(`⏸️  [PUT] Adding CUSTOM pause after message ${messageNumber}: ${customPauseSeconds}s (${customPauseSeconds/60} minutes)`)
          cumulativeDelaySeconds += customPauseSeconds
        }
      }

      return {
        campaign_id: campaignId,
        phone: normalizePhone(recipient.phone),
        name: recipient.name || null,
        message_content: messageContent.trim(),
        variables: recipient.variables || {},
        status: 'pending',
        scheduled_delay_seconds: cumulativeDelaySeconds,
      }
    })

    console.log(`✅ [PUT] Total estimated duration: ${cumulativeDelaySeconds}s (${(cumulativeDelaySeconds/60).toFixed(2)} minutes)`)
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

    // Update campaign with estimated duration
    const estimatedDuration = cumulativeDelaySeconds
    await supabase
      .from('campaigns')
      .update({ estimated_duration: estimatedDuration })
      .eq('id', campaignId)

    // Handle contact list creation/assignment
    if (new_list_name && new_list_name.trim()) {
      // Create new contact list from campaign recipients
      const { data: newList, error: listError } = await supabase
        .from('contact_lists')
        .insert({
          user_id: user.id,
          name: new_list_name.trim(),
          description: `נוצר מקמפיין: ${name}`,
          contact_count: filteredRecipients.length
        })
        .select()
        .single()

      if (!listError && newList) {
        // Add all recipients to the new list
        const listContacts = filteredRecipients.map((r: { phone: string; name?: string; variables?: Record<string, string> }) => ({
          list_id: newList.id,
          phone: normalizePhone(r.phone),
          name: r.name || null,
          variables: r.variables || {}
        }))

        await supabase.from('list_contacts').insert(listContacts)

        // Add history entry
        await supabase.from('list_history').insert({
          list_id: newList.id,
          action_type: 'campaign',
          description: `נוצר מקמפיין "${name}" עם ${filteredRecipients.length} אנשי קשר`,
          campaign_id: campaignId
        })

        console.log(`📋 [CAMPAIGN] Created new contact list "${new_list_name}" with ${filteredRecipients.length} contacts`)
      }
    }

    if (existing_list_id) {
      // Add recipients to existing contact list
      // First, get existing contacts to avoid duplicates
      const { data: existingContacts } = await supabase
        .from('list_contacts')
        .select('phone')
        .eq('list_id', existing_list_id)

      const existingPhones = new Set((existingContacts || []).map((c: { phone: string }) => c.phone))

      // Filter out recipients that already exist in the list
      const newContacts = filteredRecipients.filter((r: { phone: string }) => {
        const normalizedPhone = normalizePhone(r.phone)
        return !existingPhones.has(normalizedPhone)
      })

      if (newContacts.length > 0) {
        const listContacts = newContacts.map((r: { phone: string; name?: string; variables?: Record<string, string> }) => ({
          list_id: existing_list_id,
          phone: normalizePhone(r.phone),
          name: r.name || null,
          variables: r.variables || {}
        }))

        await supabase.from('list_contacts').insert(listContacts)

        // Update contact count
        const { data: listData } = await supabase
          .from('contact_lists')
          .select('contact_count, name')
          .eq('id', existing_list_id)
          .single()

        if (listData) {
          await supabase
            .from('contact_lists')
            .update({ contact_count: (listData.contact_count || 0) + newContacts.length })
            .eq('id', existing_list_id)

          // Add history entry
          await supabase.from('list_history').insert({
            list_id: existing_list_id,
            action_type: 'contacts_added',
            description: `נוספו ${newContacts.length} אנשי קשר מקמפיין "${name}"`,
            campaign_id: campaignId
          })

          console.log(`📋 [CAMPAIGN] Added ${newContacts.length} contacts to existing list "${listData.name}"`)
        }
      }
    }

    // Get updated campaign
    const { data: updatedCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    return NextResponse.json({
      success: true,
      campaign: { ...updatedCampaign, estimated_duration: estimatedDuration },
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
