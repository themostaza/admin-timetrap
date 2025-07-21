import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface WorkingDay {
  id: number
  calendar_day: string
  is_working_day: boolean
  description: string | null
  organization_id: string | null
}

// PUT - Update working day
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { is_working_day, description } = body
    const { id } = await params
    const dayId = parseInt(id)

    const result = await query<WorkingDay>(`
      UPDATE working_days_calendar 
      SET is_working_day = $1, description = $2
      WHERE id = $3
      RETURNING *
    `, [is_working_day, description || null, dayId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Working day not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating working day:', error)
    return NextResponse.json(
      { error: 'Error updating working day', details: error },
      { status: 500 }
    )
  }
}

// DELETE - Delete working day
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const dayId = parseInt(id)

    const result = await query<WorkingDay>(`
      DELETE FROM working_days_calendar 
      WHERE id = $1
      RETURNING *
    `, [dayId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Working day not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Working day deleted successfully' })
  } catch (error) {
    console.error('Error deleting working day:', error)
    return NextResponse.json(
      { error: 'Error deleting working day', details: error },
      { status: 500 }
    )
  }
} 