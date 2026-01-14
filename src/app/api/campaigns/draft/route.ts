import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/phone-utils'

// POST - Save campaign as draft
export async function POST(request: NextRequest) {
  console.log('=== POST /api/campaigns/draft called ===')
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', authError: authError?.message }, { status: 401 })
    }

    // Ensure user profile exists (handle case where trigger didn't create it)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return NextResponse.json({
          error: 'שגיאה ביצירת פרופיל משתמש',
          details: profileError.message
        }, { status: 500 })
      }
    }

    const body = await request.json()
    const {
      campaign_id, // For updating existing draft
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
      recipients = [],
      exclusion_list = [],
      new_list_name,
      existing_list_id,
      multi_device,
      device_ids = [],
      message_variations = [],
      poll_question,
      poll_options,
      poll_multiple_answers,
    } = body

    // Minimal validation - only name is required for draft
    if (!name) {
      return NextResponse.json({
        error: 'נדרש שם לקמפיין'
      }, { status: 400 })
    }

    // Get connection ID - use first available if not specified
    let finalConnectionId = connection_id
    if (!finalConnectionId && device_ids.length > 0) {
      finalConnectionId = device_ids[0]
    }

    // If still no connection, try to get user's first connection
    if (!finalConnectionId) {
      const { data: connections } = await supabase
        .from('connections')
        .select('id')
        .limit(1)

      if (connections && connections.length > 0) {
        finalConnectionId = connections[0].id
      }
    }

    const campaignData = {
      user_id: user.id,
      connection_id: finalConnectionId || null,
      name,
      message_template: message_template || '',
      media_url: media_url || null,
      media_type: media_type || null,
      status: 'draft',
      scheduled_at: scheduled_at || null,
      started_at: null,
      total_recipients: recipients.length,
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
      device_ids: device_ids.length > 0 ? device_ids : (finalConnectionId ? [finalConnectionId] : []),
      message_variations: message_variations || [],
      poll_question: poll_question || null,
      poll_options: poll_options || null,
      poll_multiple_answers: poll_multiple_answers || false,
    }

    let campaign
    let campaignError

    if (campaign_id) {
      // Update existing draft campaign
      const result = await supabase
        .from('campaigns')
        .update(campaignData)
        .eq('id', campaign_id)
        .eq('user_id', user.id) // Ensure user owns this campaign
        .eq('status', 'draft') // Only update drafts
        .select()
        .single()

      campaign = result.data
      campaignError = result.error

      if (campaign) {
        // Delete old campaign messages before inserting new ones
        console.log('Draft: Deleting old messages for campaign:', campaign_id)
        const { error: deleteError, count: deletedCount } = await supabase
          .from('campaign_messages')
          .delete()
          .eq('campaign_id', campaign_id)
        console.log('Draft: Delete result - error:', deleteError, 'count:', deletedCount)
      }
    } else {
      // Create new draft campaign
      const result = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single()

      campaign = result.data
      campaignError = result.error
    }

    if (campaignError) {
      console.error('Error saving draft campaign:', campaignError)
      return NextResponse.json({
        error: 'שגיאה בשמירת הטיוטה',
        details: campaignError.message,
        code: campaignError.code
      }, { status: 500 })
    }

    // If there are recipients, save them too
    if (recipients.length > 0) {
      // Filter out excluded phones
      const exclusionSet = new Set((exclusion_list || []).map((p: string) => p.replace(/\D/g, '')))
      const filteredRecipients = recipients.filter((r: { phone: string }) => {
        const cleanPhone = r.phone.replace(/\D/g, '')
        return !exclusionSet.has(cleanPhone)
      })

      if (filteredRecipients.length > 0) {
        // Constants for timing
        const MESSAGES_PER_BULK = 30
        const BULK_PAUSE_SECONDS = [
          30 * 60,    // After 1st bulk (30 messages): 30 minutes
          60 * 60,    // After 2nd bulk (60 messages): 1 hour
          90 * 60,    // After 3rd bulk (90 messages): 1.5 hours - and this repeats
        ]

        let cumulativeDelaySeconds = 0
        const campaignMessages = filteredRecipients.map((recipient: { phone: string; name?: string; variables?: Record<string, string> }, index: number) => {
          // Replace variables in message template
          let messageContent = message_template || ''
          messageContent = messageContent.replace(/\{שם\}/g, recipient.name || '')
          messageContent = messageContent.replace(/\{טלפון\}/g, recipient.phone)

          // Replace custom variables
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
            campaign_id: campaign.id,
            phone: normalizePhone(recipient.phone),
            name: recipient.name || null,
            message_content: messageContent.trim(),
            variables: recipient.variables || {},
            status: 'pending',
            scheduled_delay_seconds: cumulativeDelaySeconds,
          }
        })

        const { error: messagesError } = await supabase
          .from('campaign_messages')
          .insert(campaignMessages)

        if (messagesError) {
          console.error('Error creating draft campaign messages:', messagesError)
          // Don't rollback - draft is still saved, just without messages
        }

        // Update campaign with estimated duration (total time to send all messages)
        const estimatedDuration = cumulativeDelaySeconds
        await supabase
          .from('campaigns')
          .update({ estimated_duration: estimatedDuration })
          .eq('id', campaign.id)

        campaign.estimated_duration = estimatedDuration
      }
    }

    return NextResponse.json({
      success: true,
      campaign,
      message: 'הטיוטה נשמרה בהצלחה'
    })

  } catch (error) {
    console.error('Draft POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
