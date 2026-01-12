import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, description, category, priority } = body

    if (!subject || !description || !category) {
      return NextResponse.json(
        { error: 'Subject, description, and category are required' },
        { status: 400 }
      )
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject,
        description,
        category,
        priority: priority || 'medium',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating support ticket:', error)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error('Error in support API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get user's support tickets
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching support tickets:', error)
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Error in support API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
