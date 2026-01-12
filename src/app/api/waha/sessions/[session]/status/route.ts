import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.litbe.co.il'
const WAHA_API_KEY = process.env.WAHA_API_KEY

export async function GET(
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

    const response = await fetch(`${WAHA_API_URL}/api/sessions/${session}`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (!response.ok) {
      console.error(`WAHA API error: ${response.status}`)
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching session status:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
