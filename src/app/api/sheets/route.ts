import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'יש להזין קישור' }, { status: 400 })
    }

    // Extract spreadsheet ID from URL
    // Formats:
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      return NextResponse.json({ error: 'קישור לא תקין. אנא הדבק קישור מלא ל-Google Sheets' }, { status: 400 })
    }

    const spreadsheetId = match[1]

    // Use Google Sheets API to get data (public sheets only)
    // Format: https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:json
    const apiUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      return NextResponse.json({
        error: 'החיבור ל-Google Sheets לא צלח.<br/>אנא וודא שהגישה היא<br/><b>"כל מי שקיבל את הקישור הזה"</b>'
      }, { status: 400 })
    }

    const text = await response.text()

    // The response is wrapped in google.visualization.Query.setResponse({...})
    // We need to extract the JSON part
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'החיבור ל-Google Sheets לא צלח.<br/>אנא וודא שהגישה היא<br/><b>"כל מי שקיבל את הקישור הזה"</b>' }, { status: 400 })
    }

    const data = JSON.parse(jsonMatch[1])

    if (data.status === 'error') {
      return NextResponse.json({ error: 'החיבור ל-Google Sheets לא צלח.<br/>אנא וודא שהגישה היא<br/><b>"כל מי שקיבל את הקישור הזה"</b>' }, { status: 400 })
    }

    // Extract rows from the table
    const table = data.table
    const cols = table.cols || []
    const rows = table.rows || []

    // Get headers from column labels
    const headers = cols.map((col: any, idx: number) => col.label || `Column ${idx + 1}`)

    // Get data rows
    const dataRows = rows.map((row: any) => {
      return row.c.map((cell: any) => {
        if (!cell) return ''
        return cell.v !== null && cell.v !== undefined ? String(cell.v) : ''
      })
    })

    return NextResponse.json({
      success: true,
      headers,
      rows: dataRows,
      totalRows: dataRows.length
    })

  } catch (error) {
    console.error('Google Sheets API error:', error)
    return NextResponse.json({ error: 'החיבור ל-Google Sheets לא צלח.<br/>אנא וודא שהגישה היא<br/><b>"כל מי שקיבל את הקישור הזה"</b>' }, { status: 500 })
  }
}
