import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface TimeEntryWithDetails {
  uid: string
  user_id: string
  start_time: number
  end_time: number
  completed: boolean
  project_id?: string
  category_id?: string
  project_uid?: string
  project_title?: string
  project_not_billable?: boolean
  category_uid?: string
  category_name?: string
  category_color?: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { startDate, endDate, page = 0, pageSize = 1000 } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const startTime = new Date(startDate).getTime()
    const endTime = new Date(endDate).getTime()
    const offset = page * pageSize

    const result = await query<TimeEntryWithDetails>(`
      SELECT 
        tbe.uid,
        tbe.user_id,
        tbe.start_time,
        tbe.end_time,
        tbe.completed,
        tbe.project_id,
        tbe.category_id,
        p.uid as project_uid,
        p.title as project_title,
        p.not_billable as project_not_billable,
        tc.uid as category_uid,
        tc.name as category_name,
        tc.color as category_color
      FROM time_blocking_events tbe
      LEFT JOIN projects p ON tbe.project_id = p.uid
      LEFT JOIN task_categories tc ON tbe.category_id = tc.uid
      WHERE tbe.start_time >= $1 
        AND tbe.end_time <= $2
        AND tbe.event_type = 'activity'
      ORDER BY tbe.start_time ASC
      LIMIT $3 OFFSET $4
    `, [startTime, endTime, pageSize, offset])

    // Transform to match the expected structure
    const timeEntries = result.rows.map(row => ({
      uid: row.uid,
      user_id: row.user_id,
      start_time: row.start_time,
      end_time: row.end_time,
      completed: row.completed,
      project_id: row.project_id || null,
      category_id: row.category_id || null,
      project: row.project_uid ? {
        uid: row.project_uid,
        title: row.project_title,
        not_billable: row.project_not_billable
      } : null,
      category: row.category_uid ? {
        uid: row.category_uid,
        name: row.category_name,
        color: row.category_color
      } : null
    }))

    // Log project IDs found
    const entriesWithProjects = timeEntries.filter(entry => entry.project_id)
    console.log(`Found ${entriesWithProjects.length} entries with project IDs out of ${timeEntries.length} total entries`)
    
    if (entriesWithProjects.length > 0) {
      console.log('Project IDs found:', entriesWithProjects.map(entry => ({
        entryId: entry.uid,
        projectId: entry.project_id,
        projectTitle: entry.project?.title
      })))
    } else {
      console.log('No entries with project IDs found in this date range')
    }

    return NextResponse.json({
      entries: timeEntries,
      hasMore: result.rows.length === pageSize
    })
  } catch (error) {
    console.error('Error fetching time entries:', error)
    return NextResponse.json(
      { error: 'Error fetching time entries', details: error },
      { status: 500 }
    )
  }
} 