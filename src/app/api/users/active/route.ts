import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface User {
  uid: string
  nominative: string
  email: string
}

export async function GET() {
  try {
    const result = await query<User>(`
      SELECT uid, nominative, email 
      FROM users 
      WHERE status = 'active'
      ORDER BY nominative
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching active users:', error)
    return NextResponse.json(
      { error: 'Error fetching active users', details: error },
      { status: 500 }
    )
  }
} 