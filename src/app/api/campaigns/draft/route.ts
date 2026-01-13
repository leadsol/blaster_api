import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Save campaign as draft
export async function POST(request: NextRequest) {
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

    // Create draft campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
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
        new_list_name: new_list_name || null,
        existing_list_id: existing_list_id || null,
        multi_device: multi_device || false,
        device_ids: device_ids.length > 0 ? device_ids : (finalConnectionId ? [finalConnectionId] : []),
        message_variations: message_variations || [],
        poll_question: poll_question || null,
        poll_options: poll_options || null,
        poll_multiple_answers: poll_multiple_answers || false,
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating draft campaign:', campaignError)
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
        const campaignMessages = filteredRecipients.map((recipient: { phone: string; name?: string; variables?: Record<string, string> }) => {
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
          console.error('Error creating draft campaign messages:', messagesError)
          // Don't rollback - draft is still saved, just without messages
        }
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
