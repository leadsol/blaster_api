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
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

// PUT - Update session metadata
export async function PUT(
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
    const { displayName } = body

    // Update session with new metadata
    const response = await fetch(`${WAHA_API_URL}/api/sessions/${session}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
      },
      body: JSON.stringify({
        config: {
          metadata: {
            displayName: displayName,
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    })

    if (!response.ok) {
      console.error(`WAHA API error updating session: ${response.status}`)
      return NextResponse.json({ error: 'Failed to update session' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

export async function DELETE(
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

    // First logout (ignore errors - session might already be logged out)
    await fetch(`${WAHA_API_URL}/api/sessions/${session}/logout`, {
      method: 'POST',
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    }).catch(() => {})

    // Then stop (ignore errors - session might already be stopped)
    await fetch(`${WAHA_API_URL}/api/sessions/${session}/stop`, {
      method: 'POST',
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    }).catch(() => {})

    // Finally delete
    const response = await fetch(`${WAHA_API_URL}/api/sessions/${session}`, {
      method: 'DELETE',
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    })

    if (!response.ok && response.status !== 404) {
      console.error(`WAHA API error: ${response.status}`)
      return NextResponse.json({ error: 'Failed to delete session' }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
