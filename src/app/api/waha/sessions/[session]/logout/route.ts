import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.litbe.co.il'
const WAHA_API_KEY = process.env.WAHA_API_KEY

// POST /api/waha/sessions/{session}/logout - Logout (disconnect) a session without deleting it
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

    // Call WAHA API to logout
    // POST /api/{session}/auth/logout
    const response = await fetch(`${WAHA_API_URL}/api/${session}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`WAHA logout error: ${response.status}`, errorText)
      return NextResponse.json({
        error: 'Failed to logout session',
        details: errorText
      }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging out session:', error)
    return NextResponse.json({ error: 'Failed to logout session' }, { status: 500 })
  }
}
