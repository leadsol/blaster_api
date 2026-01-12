import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint should be called by a cron job (e.g., every minute)
// Vercel Cron: https://vercel.com/docs/cron-jobs
// Or use external service like cron-job.org

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('Invalid cron secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find campaigns that are scheduled and should start now
    const now = new Date().toISOString()

    const { data: scheduledCampaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (error) {
      console.error('Error fetching scheduled campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return NextResponse.json({ message: 'No campaigns to process' })
    }

    // Process each scheduled campaign
    const results = await Promise.allSettled(
      scheduledCampaigns.map(async (campaign) => {
        console.log(`Starting scheduled campaign: ${campaign.name} (${campaign.id})`)

        // Trigger campaign processing with internal secret
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (CRON_SECRET) {
          headers['x-internal-secret'] = CRON_SECRET
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/campaigns/${campaign.id}/process`,
          {
            method: 'POST',
            headers,
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to start campaign ${campaign.id}`)
        }

        return { campaignId: campaign.id, status: 'started' }
      })
    )

    const started = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      message: `Processed ${scheduledCampaigns.length} campaigns`,
      started,
      failed
    })

  } catch (error) {
    console.error('Scheduler error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Vercel Cron config (add to vercel.json):
// {
//   "crons": [{
//     "path": "/api/campaigns/scheduler",
//     "schedule": "* * * * *"
//   }]
// }
