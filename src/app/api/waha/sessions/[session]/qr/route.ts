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
    // Use the correct WAHA endpoint: GET /api/{session}/auth/qr?format=image
    // This returns ONLY the QR code image, not a full screenshot
    const response = await fetch(`${WAHA_API_URL}/api/${session}/auth/qr?format=image`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (response.ok) {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('image')) {
        const buffer = await response.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        return NextResponse.json({ qr: base64 })
      }
    }

    // Try raw format as fallback
    const rawResponse = await fetch(`${WAHA_API_URL}/api/${session}/auth/qr?format=raw`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (rawResponse.ok) {
      const data = await rawResponse.json()
      // Raw format returns either base64 file or QR value
      if (data.value) {
        return NextResponse.json({ qr: data.value })
      }
      if (data.data) {
        return NextResponse.json({ qr: data.data })
      }
    }

    // Return appropriate error
    console.log(`QR fetch failed for session ${session}: ${response.status}`)
    return NextResponse.json({
      error: 'QR not available - session may not be ready yet',
      status: response.status
    }, { status: 404 })
  } catch (error) {
    console.error('Error fetching QR:', error)
    return NextResponse.json({ error: 'Failed to fetch QR' }, { status: 500 })
  }
}
