import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Use primary connection (first one) for the campaign record
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

    // Determine campaign status - always start as draft until user launches
    const status = 'draft'
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
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Create campaign messages for each recipient
    const campaignMessages = filteredRecipients.map((recipient: { phone: string; name?: string; variables?: Record<string, string> }) => {
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

      return {
        campaign_id: campaign.id,
        phone: recipient.phone,
        name: recipient.name || null,
        message_content: messageContent.trim(),
        variables: recipient.variables || {},
        status: 'pending',
      }
    })

    const { error: messagesError } = await supabase
      .from('campaign_messages')
      .insert(campaignMessages)

    if (messagesError) {
      console.error('Error creating campaign messages:', messagesError)
      // Rollback campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: 'Failed to create campaign messages' }, { status: 500 })
    }

    // Campaign is now in draft status - user must launch it from summary page
    return NextResponse.json({
      success: true,
      campaign,
      message: 'הקמפיין נוצר בהצלחה. עבור לדף הסיכום לשיגור.'
    })

  } catch (error) {
    console.error('Campaign POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
