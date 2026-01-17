import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH - Update campaign active hours
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'לא מורשה' }, { status: 401 })
    }

    const body = await request.json()
    const { active_hours_start, active_hours_end, remove_active_hours } = body

    // Get current campaign to verify ownership
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    // Only allow editing active hours for paused or running campaigns
    if (!['paused', 'running', 'scheduled', 'draft'].includes(campaign.status)) {
      return NextResponse.json({ error: 'לא ניתן לעדכן שעות פעילות לקמפיין זה' }, { status: 400 })
    }

    // Handle removal of active hours
    if (remove_active_hours) {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          respect_active_hours: false,
          active_hours_start: null,
          active_hours_end: null
        })
        .eq('id', campaignId)

      if (updateError) {
        console.error('Error removing active hours:', updateError)
        return NextResponse.json({ error: 'שגיאה בהסרת שעות הפעילות' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'שעות הפעילות הוסרו בהצלחה' })
    }

    // Validate time format for update
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(active_hours_start) || !timeRegex.test(active_hours_end)) {
      return NextResponse.json({ error: 'פורמט שעה לא תקין' }, { status: 400 })
    }

    // Update active hours (also set respect_active_hours to true in case it's being added)
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        respect_active_hours: true,
        active_hours_start,
        active_hours_end
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating active hours:', updateError)
      return NextResponse.json({ error: 'שגיאה בעדכון שעות הפעילות' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'שעות הפעילות עודכנו בהצלחה' })
  } catch (error) {
    console.error('Active hours PATCH error:', error)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
