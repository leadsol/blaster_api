import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.litbe.co.il'
const WAHA_API_KEY = process.env.WAHA_API_KEY

// Get webhook URL - always use production URL so WAHA can reach it
function getWebhookBaseUrl(): string {
  // Use dedicated webhook URL if set (for dev environment pointing to production)
  if (process.env.WEBHOOK_URL) {
    return process.env.WEBHOOK_URL
  }
  // Vercel provides this automatically in production
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Use app URL if it's not localhost
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  // Fallback (won't work for webhooks from external WAHA)
  return 'https://blaster-api.vercel.app'
}

export async function GET() {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!WAHA_API_KEY) {
      console.error('WAHA_API_KEY is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const response = await fetch(`${WAHA_API_URL}/api/sessions`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (!response.ok) {
      console.error(`WAHA API error: ${response.status}`)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!WAHA_API_KEY) {
      console.error('WAHA_API_KEY is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const { name, displayName } = body

    const response = await fetch(`${WAHA_API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
      },
      body: JSON.stringify({
        name,
        start: true,
        config: {
          metadata: {
            displayName: displayName || name,
            createdAt: new Date().toISOString(),
          },
          webhooks: [
            {
              url: `${getWebhookBaseUrl()}/api/waha/webhook`,
              events: ['message', 'message.ack', 'session.status'],
            },
          ],
        },
      }),
    })

    if (!response.ok) {
      console.error(`WAHA API error: ${response.status}`)
      return NextResponse.json({ error: 'Failed to create session' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
