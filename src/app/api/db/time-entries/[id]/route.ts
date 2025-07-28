import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entryId } = await params

    if (!entryId) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      )
    }

    // First check if the entry exists
    const checkResult = await query(`
      SELECT uid FROM time_blocking_events 
      WHERE uid = $1
    `, [entryId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      )
    }

    // Delete the time entry
    const result = await query(`
      DELETE FROM time_blocking_events 
      WHERE uid = $1 
      RETURNING *
    `, [entryId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete time entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Time entry deleted successfully',
      deletedEntry: result.rows[0]
    })

  } catch (error) {
    console.error('Error deleting time entry:', error)
    return NextResponse.json(
      { error: 'Error deleting time entry', details: error },
      { status: 500 }
    )
  }
} 