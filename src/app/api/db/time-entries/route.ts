import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface TimeEntryWithDetails {
  uid: string
  user_id: string
  start_time: number
  end_time: number
  completed: boolean
  event_type: string
  project_id: string | null
  category_id: string | null
  project_uid?: string
  project_title?: string
  project_not_billable?: boolean
  category_uid?: string
  category_name?: string
  category_color?: string
  user_nominative?: string
  user_email?: string
  duration_hours?: number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      page = 0, 
      pageSize = 50,
      sortBy = 'start_time',
      sortOrder = 'DESC',
      filters = {}
    } = body

    const { 
      userId, 
      projectId, 
      categoryId, 
      completed, 
      startDate, 
      endDate,
      searchText 
    } = filters

    const whereConditions = ["tbe.event_type = 'activity'"]
    const queryParams: unknown[] = []
    let paramCount = 0

    // Date range filter
    if (startDate) {
      paramCount++
      whereConditions.push(`tbe.start_time >= $${paramCount}`)
      queryParams.push(new Date(startDate).getTime())
    }
    
    if (endDate) {
      paramCount++
      whereConditions.push(`tbe.end_time <= $${paramCount}`)
      queryParams.push(new Date(endDate).getTime())
    }

    // User filter
    if (userId) {
      paramCount++
      whereConditions.push(`tbe.user_id = $${paramCount}`)
      queryParams.push(userId)
    }

    // Project filter
    if (projectId) {
      paramCount++
      whereConditions.push(`tbe.project_id = $${paramCount}`)
      queryParams.push(projectId)
    }

    // Category filter
    if (categoryId) {
      paramCount++
      whereConditions.push(`tbe.category_id = $${paramCount}`)
      queryParams.push(categoryId)
    }

    // Completion status filter
    if (completed !== undefined) {
      paramCount++
      whereConditions.push(`tbe.completed = $${paramCount}`)
      queryParams.push(completed)
    }

    // Search text filter
    if (searchText) {
      paramCount++
      whereConditions.push(`(
        LOWER(u.nominative) LIKE LOWER($${paramCount}) OR 
        LOWER(u.email) LIKE LOWER($${paramCount}) OR 
        LOWER(p.title) LIKE LOWER($${paramCount}) OR 
        LOWER(tc.name) LIKE LOWER($${paramCount})
      )`)
      queryParams.push(`%${searchText}%`)
    }

    const whereClause = whereConditions.join(' AND ')

    // Validate sort column
    const validSortColumns = ['start_time', 'end_time', 'user_nominative', 'project_title', 'category_name', 'completed', 'duration_hours']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'start_time'
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC'

    // Count total records
    const countResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM time_blocking_events tbe
      LEFT JOIN users u ON tbe.user_id = u.uid
      LEFT JOIN projects p ON tbe.project_id = p.uid
      LEFT JOIN task_categories tc ON tbe.category_id = tc.uid
      WHERE ${whereClause}
    `, queryParams)

    const totalCount = parseInt(countResult.rows[0]?.count || '0')

    // Fetch paginated data
    const offset = page * pageSize
    paramCount += 2
    queryParams.push(pageSize, offset)

    let orderByClause = `ORDER BY tbe.${sortColumn} ${order}`
    if (sortColumn === 'user_nominative') {
      orderByClause = `ORDER BY u.nominative ${order}`
    } else if (sortColumn === 'project_title') {
      orderByClause = `ORDER BY p.title ${order}`
    } else if (sortColumn === 'category_name') {
      orderByClause = `ORDER BY tc.name ${order}`
    } else if (sortColumn === 'duration_hours') {
      orderByClause = `ORDER BY (tbe.end_time - tbe.start_time) ${order}`
    }

    const result = await query<TimeEntryWithDetails>(`
      SELECT 
        tbe.uid,
        tbe.user_id,
        tbe.start_time,
        tbe.end_time,
        tbe.completed,
        tbe.event_type,
        tbe.project_id,
        tbe.category_id,
        p.uid as project_uid,
        p.title as project_title,
        p.not_billable as project_not_billable,
        tc.uid as category_uid,
        tc.name as category_name,
        tc.color as category_color,
        u.nominative as user_nominative,
        u.email as user_email,
        ROUND(CAST((tbe.end_time - tbe.start_time) AS DECIMAL) / 3600000, 2) as duration_hours
      FROM time_blocking_events tbe
      LEFT JOIN projects p ON tbe.project_id = p.uid
      LEFT JOIN task_categories tc ON tbe.category_id = tc.uid
      LEFT JOIN users u ON tbe.user_id = u.uid
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, queryParams)

    // Transform to match the expected structure
    const timeEntries = result.rows.map(row => {
      // Debug logging for timestamps
      console.log('Raw timestamp data:', {
        uid: row.uid,
        start_time: row.start_time,
        start_time_type: typeof row.start_time,
        end_time: row.end_time,
        end_time_type: typeof row.end_time
      })
      
      return {
        uid: row.uid,
        user_id: row.user_id,
        start_time: typeof row.start_time === 'string' ? parseInt(row.start_time) : row.start_time,
        end_time: typeof row.end_time === 'string' ? parseInt(row.end_time) : row.end_time,
        completed: row.completed,
        event_type: row.event_type,
        project_id: row.project_id,
        category_id: row.category_id,
        duration_hours: row.duration_hours,
        project: row.project_uid ? {
          uid: row.project_uid,
          title: row.project_title,
          not_billable: row.project_not_billable
        } : null,
        category: row.category_uid ? {
          uid: row.category_uid,
          name: row.category_name,
          color: row.category_color
        } : null,
        user: {
          nominative: row.user_nominative,
          email: row.user_email
        }
      }
    })

    return NextResponse.json({
      entries: timeEntries,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      pageSize
    })

  } catch (error) {
    console.error('Error fetching time entries:', error)
    return NextResponse.json(
      { error: 'Error fetching time entries', details: error },
      { status: 500 }
    )
  }
} 