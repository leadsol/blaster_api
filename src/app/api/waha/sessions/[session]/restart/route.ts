import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.litbe.co.il'
const WAHA_API_KEY = process.env.WAHA_API_KEY

// POST /api/waha/sessions/{session}/restart - Restart a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ session: string }> }
) {
  const { session } = await params

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

    // Call WAHA API to restart the session
    // POST /api/sessions/{session}/restart
    const response = await fetch(`${WAHA_API_URL}/api/sessions/${session}/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`WAHA restart error: ${response.status}`, errorText)
      return NextResponse.json({
        error: 'Failed to restart session',
        details: errorText
      }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('Error restarting session:', error)
    return NextResponse.json({ error: 'Failed to restart session' }, { status: 500 })
  }
}
