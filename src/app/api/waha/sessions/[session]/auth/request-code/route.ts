import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.litbe.co.il'
const WAHA_API_KEY = process.env.WAHA_API_KEY

// POST /api/{session}/auth/request-code - Request pairing code for phone number linking
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

    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Call WAHA API to request pairing code
    // POST /api/{session}/auth/request-code
    const response = await fetch(`${WAHA_API_URL}/api/${session}/auth/request-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber.replace(/[^0-9]/g, ''), // Clean phone number
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`WAHA request-code error: ${response.status}`, errorText)
      return NextResponse.json({
        error: 'Failed to request pairing code',
        details: errorText
      }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      code: data.code,
      ...data
    })
  } catch (error) {
    console.error('Error requesting pairing code:', error)
    return NextResponse.json({ error: 'Failed to request pairing code' }, { status: 500 })
  }
}
