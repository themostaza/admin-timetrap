import { Pool, PoolClient } from 'pg'

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('amazonaws.com') || process.env.DATABASE_URL?.includes('heroku') 
    ? { rejectUnauthorized: false } 
    : process.env.DATABASE_URL?.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }, // Default to SSL for remote connections
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close clients after 30 seconds of inactivity
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
})

export interface QueryResult<T = unknown> {
  rows: T[]
  rowCount: number
}

// Database query helper function
export const query = async <T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0
    }
  } finally {
    client.release()
  }
}

// Transaction helper
export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Simple query builder helpers for common operations
export class QueryBuilder {
  static select(table: string, columns = '*') {
    return {
      from: table,
      columns,
      where: (conditions: string) => ({
        async execute<T>(): Promise<QueryResult<T>> {
          const sql = `SELECT ${columns} FROM ${table} WHERE ${conditions}`
          return query<T>(sql)
        }
      }),
      async execute<T>(): Promise<QueryResult<T>> {
        const sql = `SELECT ${columns} FROM ${table}`
        return query<T>(sql)
      }
    }
  }

  static insert(table: string, data: Record<string, unknown>) {
    const columns = Object.keys(data).join(', ')
    const values = Object.values(data)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
    
    return {
      async execute<T>(): Promise<QueryResult<T>> {
        const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`
        return query<T>(sql, values)
      }
    }
  }

  static update(table: string, data: Record<string, unknown>) {
    const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(', ')
    const values = Object.values(data)
    
    return {
      where: (conditions: string, conditionParams: unknown[] = []) => ({
        async execute<T>(): Promise<QueryResult<T>> {
          const sql = `UPDATE ${table} SET ${setClause} WHERE ${conditions} RETURNING *`
          return query<T>(sql, [...values, ...conditionParams])
        }
      })
    }
  }

  static delete(table: string) {
    return {
      where: (conditions: string, conditionParams: unknown[] = []) => ({
        async execute<T>(): Promise<QueryResult<T>> {
          const sql = `DELETE FROM ${table} WHERE ${conditions} RETURNING *`
          return query<T>(sql, conditionParams)
        }
      })
    }
  }
}

// Export the pool for advanced usage
export { pool }

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end()
}) 