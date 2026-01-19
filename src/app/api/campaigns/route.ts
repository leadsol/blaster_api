import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone-utils'

// GET - List all campaigns for the current user
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        connection:connections(session_name, phone_number, display_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Campaigns GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new campaign
export async function POST(request: NextRequest) {
  console.log('=== POST /api/campaigns called ===')
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    let {
      name,
      connection_id,
      message_template,
      media_url,
      media_type,
      scheduled_at,
      delay_min,
      delay_max,
      pause_after_messages,
      pause_seconds,
      respect_active_hours,
      active_hours_start,
      active_hours_end,
      recipients, // Array of { phone, name, variables }
      exclusion_list, // Array of phone numbers to exclude
      new_list_name, // Name for new contact list to create
      existing_list_id, // ID of existing list to add contacts to
      multi_device, // Boolean - use multiple devices
      device_ids, // Array of connection IDs to use
      // Message variations
      message_variations,
      // Poll data
      poll_question,
      poll_options,
      poll_multiple_answers,
    } = body

    // Ensure delay values are valid numbers with proper defaults
    delay_min = Number(delay_min) || 10
    delay_max = Number(delay_max) || 60

    // Ensure delay_min is at least 10 seconds
    delay_min = Math.max(10, delay_min)

    // Ensure delay_max is at least 60 and at least delay_min
    delay_max = Math.max(60, delay_max)
    delay_max = Math.max(delay_min, delay_max)

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

    // Check if any of the devices are busy in another running/paused campaign
    for (const device of connectedDevices) {
      const { data: busyCampaign } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .in('status', ['running', 'paused'])
        .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)
        .limit(1)
        .single()

      if (busyCampaign) {
        const deviceDisplayName = device.display_name || device.session_name
        return NextResponse.json({
          error: `המכשיר "${deviceDisplayName}" עסוק בקמפיין "${busyCampaign.name}" (${busyCampaign.status === 'running' ? 'פעיל' : 'מושהה'}). ניתן לשמור כטיוטה, אך לא ניתן לשגר עד שהקמפיין הקודם יסתיים או יבוטל.`,
          canSaveAsDraft: true
        }, { status: 409 })
      }
    }

    // Use primary connection (first one) for the campaign record
    const primaryConnectionId = connectedDevices[0].id

    // Filter out excluded phones
    const exclusionSet = new Set((exclusion_list || []).map((p: string) => p.replace(/\D/g, '')))

    // Get user's blacklist to filter out blacklisted contacts
    const { data: blacklistData } = await supabase
      .from('blacklist')
      .select('phone')
      .eq('user_id', user.id)

    const blacklistSet = new Set((blacklistData || []).map(b => b.phone.replace(/\D/g, '')))
    console.log(`🚫 [CAMPAIGN] Found ${blacklistSet.size} blacklisted phones`)

    // Filter recipients - remove both exclusion list and blacklist
    const filteredRecipients: Array<{ phone: string; name?: string; variables?: Record<string, string> }> = []
    const blacklistedRecipients: Array<{ phone: string; name?: string; variables?: Record<string, string> }> = []

    for (const r of recipients) {
      const cleanPhone = r.phone.replace(/\D/g, '')

      if (exclusionSet.has(cleanPhone)) {
        // Skip - in exclusion list
        continue
      }

      if (blacklistSet.has(cleanPhone)) {
        // Track as blacklisted (will create message with 'blacklisted' status)
        blacklistedRecipients.push(r)
        console.log(`🚫 [CAMPAIGN] Phone ${cleanPhone} is blacklisted`)
      } else {
        // Valid recipient
        filteredRecipients.push(r)
      }
    }

    if (filteredRecipients.length === 0 && blacklistedRecipients.length === 0) {
      return NextResponse.json({
        error: 'All recipients are in the exclusion list'
      }, { status: 400 })
    }

    if (filteredRecipients.length === 0) {
      return NextResponse.json({
        error: 'כל הנמענים נמצאים ברשימה השחורה'
      }, { status: 400 })
    }

    // Add excluded phones to global blacklist
    if (exclusion_list && exclusion_list.length > 0) {
      const blacklistEntries = exclusion_list.map((phone: string) => ({
        user_id: user.id,
        phone: phone.replace(/\D/g, ''),
        reason: 'Campaign exclusion list'
      }))

      // Upsert to avoid duplicates
      await supabase
        .from('blacklist')
        .upsert(blacklistEntries, { onConflict: 'user_id,phone', ignoreDuplicates: true })
    }

    // Determine campaign status based on scheduled_at
    const now = new Date()
    const scheduledDate = scheduled_at ? new Date(scheduled_at) : null
    const status = scheduledDate && scheduledDate > now ? 'scheduled' : 'draft'
    const started_at = null

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        connection_id: primaryConnectionId,
        name,
        message_template: message_template || '',
        media_url: media_url || null,
        media_type: media_type || null,
        status,
        scheduled_at: scheduled_at || null,
        started_at,
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
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      return NextResponse.json({
        error: 'Failed to create campaign',
        details: campaignError.message,
        code: campaignError.code
      }, { status: 500 })
    }

    // Create campaign messages for each recipient with pre-calculated delays
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
    console.log(`🔵 Creating messages for ${filteredRecipients.length} recipients`)
    console.log(`🔵 delay_min: ${delay_min}, delay_max: ${delay_max}`)
    if (hasCustomPause) {
      console.log(`🔵 Custom pause: every ${customPauseAfter} messages, pause for ${customPauseSeconds}s (${customPauseSeconds/60} min)`)
    }

    const campaignMessages = filteredRecipients.map((recipient: { phone: string; name?: string; variables?: Record<string, string> }, index: number) => {
      // Replace variables in message template
      let messageContent = message_template
      messageContent = messageContent.replace(/\{שם\}/g, recipient.name || '')
      messageContent = messageContent.replace(/\{טלפון\}/g, recipient.phone)

      // Replace custom variables
      if (recipient.variables) {
        Object.entries(recipient.variables).forEach(([key, value]) => {
          messageContent = messageContent.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
        })
      }

      // Calculate random delay for this message (10-60 seconds)
      const messageDelay = Math.floor(Math.random() * (delay_max - delay_min + 1)) + delay_min
      cumulativeDelaySeconds += messageDelay

      // Add bulk pause ONLY if there are more messages after this bulk
      // Don't add pause after the last message of a campaign
      const messageNumber = index + 1
      const isLastMessage = messageNumber === filteredRecipients.length

      console.log(`🔵 Message ${messageNumber}/${filteredRecipients.length}: delay=${messageDelay}s, cumulative=${cumulativeDelaySeconds}s, isLast=${isLastMessage}`)

      // DEFAULT bulk pause (every 30 messages)
      if (!isLastMessage && messageNumber % MESSAGES_PER_BULK === 0) {
        const bulkIndex = Math.floor(messageNumber / MESSAGES_PER_BULK) - 1
        const pauseIndex = Math.min(bulkIndex, BULK_PAUSE_SECONDS.length - 1)
        const pauseAmount = BULK_PAUSE_SECONDS[pauseIndex]
        console.log(`⏸️  Adding DEFAULT bulk pause after message ${messageNumber}: ${pauseAmount}s (${pauseAmount/60} minutes)`)
        cumulativeDelaySeconds += pauseAmount
      }

      // CUSTOM pause (user-defined, in addition to default)
      // Only add if not on the same boundary as default bulk pause
      if (hasCustomPause && !isLastMessage && messageNumber % customPauseAfter === 0) {
        // Skip if this is also a default bulk pause boundary (avoid double pause on same message)
        if (messageNumber % MESSAGES_PER_BULK !== 0) {
          console.log(`⏸️  Adding CUSTOM pause after message ${messageNumber}: ${customPauseSeconds}s (${customPauseSeconds/60} minutes)`)
          cumulativeDelaySeconds += customPauseSeconds
        }
      }

      return {
        campaign_id: campaign.id,
        phone: normalizePhone(recipient.phone),
        name: recipient.name || null,
        message_content: messageContent.trim(),
        variables: recipient.variables || {},
        status: 'pending',
        scheduled_delay_seconds: cumulativeDelaySeconds,
      }
    })

    console.log(`✅ Total estimated duration: ${cumulativeDelaySeconds}s (${(cumulativeDelaySeconds/60).toFixed(2)} minutes)`)

    const { error: messagesError } = await supabase
      .from('campaign_messages')
      .insert(campaignMessages)

    if (messagesError) {
      console.error('Error creating campaign messages:', messagesError)
      // Rollback campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: 'Failed to create campaign messages' }, { status: 500 })
    }

    // Create 'blacklisted' status messages for contacts in blacklist
    // These won't be sent but will appear in analytics
    if (blacklistedRecipients.length > 0) {
      const blacklistedMessages = blacklistedRecipients.map((recipient) => {
        let messageContent = message_template
        messageContent = messageContent.replace(/\{שם\}/g, recipient.name || '')
        messageContent = messageContent.replace(/\{טלפון\}/g, recipient.phone)

        if (recipient.variables) {
          Object.entries(recipient.variables).forEach(([key, value]) => {
            messageContent = messageContent.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
          })
        }

        return {
          campaign_id: campaign.id,
          phone: normalizePhone(recipient.phone),
          name: recipient.name || null,
          message_content: messageContent.trim(),
          variables: recipient.variables || {},
          status: 'blacklisted',
          error_message: 'לא נשלח - נמען ברשימה שחורה',
          scheduled_delay_seconds: 0,
        }
      })

      const { error: blacklistMessagesError } = await supabase
        .from('campaign_messages')
        .insert(blacklistedMessages)

      if (blacklistMessagesError) {
        console.error('Error creating blacklisted messages:', blacklistMessagesError)
        // Don't fail the campaign - blacklist messages are optional for display
      } else {
        console.log(`🚫 [CAMPAIGN] Created ${blacklistedMessages.length} blacklisted message records`)
      }
    }

    // Update campaign with estimated duration (total time to send all messages)
    const estimatedDuration = cumulativeDelaySeconds
    await supabase
      .from('campaigns')
      .update({ estimated_duration: estimatedDuration })
      .eq('id', campaign.id)

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
        const listContacts = filteredRecipients.map((r) => ({
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
          campaign_id: campaign.id
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

      const existingPhones = new Set((existingContacts || []).map(c => c.phone))

      // Filter out recipients that already exist in the list
      const newContacts = filteredRecipients.filter(r => {
        const normalizedPhone = normalizePhone(r.phone)
        return !existingPhones.has(normalizedPhone)
      })

      if (newContacts.length > 0) {
        const listContacts = newContacts.map((r) => ({
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
            campaign_id: campaign.id
          })

          console.log(`📋 [CAMPAIGN] Added ${newContacts.length} contacts to existing list "${listData.name}"`)
        }
      } else {
        console.log(`📋 [CAMPAIGN] All recipients already exist in the list, no new contacts added`)
      }
    }

    // Campaign is now in draft status - user must launch it from summary page
    return NextResponse.json({
      success: true,
      campaign: { ...campaign, estimated_duration: estimatedDuration },
      message: 'הקמפיין נוצר בהצלחה. עבור לדף הסיכום לשיגור.'
    })

  } catch (error) {
    console.error('Campaign POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
