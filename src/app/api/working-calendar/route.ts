import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface WorkingDay {
  id: number
  calendar_day: string
  is_working_day: boolean
  description: string | null
  organization_id: string | null
}

// GET - Fetch all working days
export async function GET() {
  try {
    const result = await query<WorkingDay>(`
      SELECT * FROM working_days_calendar 
      ORDER BY calendar_day DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching working days:', error)
    return NextResponse.json(
      { error: 'Error fetching working days', details: error },
      { status: 500 }
    )
  }
}

// POST - Create new working day
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { calendar_day, is_working_day, description } = body

    const result = await query<WorkingDay>(`
      INSERT INTO working_days_calendar (calendar_day, is_working_day, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [calendar_day, is_working_day, description || null])

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating working day:', error)
    return NextResponse.json(
      { error: 'Error creating working day', details: error },
      { status: 500 }
    )
  }
} 