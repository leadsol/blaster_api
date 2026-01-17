import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH - Toggle campaign is_active status
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
    const { is_active } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'ערך לא תקין' }, { status: 400 })
    }

    // Get current campaign to verify ownership
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    // Only allow toggling for running, paused, or scheduled campaigns
    if (!['running', 'paused', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json({ error: 'לא ניתן לשנות סטטוס לקמפיין זה' }, { status: 400 })
    }

    // Update is_active
    // When deactivating (is_active = false), also pause the campaign if it's running
    const updateData: { is_active: boolean; status?: string; paused_at?: string } = { is_active }

    if (!is_active && campaign.status === 'running') {
      updateData.status = 'paused'
      updateData.paused_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating is_active:', updateError)
      return NextResponse.json({ error: 'שגיאה בעדכון הקמפיין' }, { status: 500 })
    }

    const wasPaused = !is_active && campaign.status === 'running'
    console.log(`[TOGGLE-ACTIVE] Campaign ${campaignId} is_active set to ${is_active}${wasPaused ? ' (also paused)' : ''}`)

    return NextResponse.json({
      success: true,
      is_active,
      status: wasPaused ? 'paused' : campaign.status,
      message: is_active ? 'הקמפיין פעיל' : 'הקמפיין לא פעיל והושהה'
    })
  } catch (error) {
    console.error('Toggle active PATCH error:', error)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
