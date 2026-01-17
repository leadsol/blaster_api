import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleRateLimit } from '@/lib/api-utils'
import { waha } from '@/lib/waha'

export async function GET(request: NextRequest) {
  // Rate limit check
  const rateLimit = await simpleRateLimit(request, 'api')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const contactId = searchParams.get('contactId')

    if (!connectionId || !contactId) {
      return NextResponse.json({ error: 'Missing connectionId or contactId' }, { status: 400 })
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('id, session_name, status')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    if (connection.status !== 'connected') {
      return NextResponse.json({ error: 'Connection is not active' }, { status: 400 })
    }

    // Check if it's a group
    const isGroup = contactId.endsWith('@g.us')

    let pictureUrl: string | null = null

    if (isGroup) {
      // Get group picture
      try {
        const result = await waha.groups.getPicture(connection.session_name, contactId)
        pictureUrl = result?.url || null
      } catch {
        pictureUrl = null
      }
    } else {
      // Get contact profile picture
      try {
        const result = await waha.contacts.getProfilePicture(connection.session_name, contactId)
        pictureUrl = result?.profilePictureURL || null
      } catch {
        pictureUrl = null
      }
    }

    return NextResponse.json({ picture: pictureUrl })
  } catch (error) {
    console.error('Profile picture error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile picture', picture: null }, { status: 200 })
  }
}
