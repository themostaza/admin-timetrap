import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface DailyCoverage {
  date: string
  expectedHours: number
  actualHours: number
  coverage: number
}

interface WorkingDay {
  calendar_day: string
  is_working_day: boolean
}

interface Contract {
  contract_type: string
  contractual_hours: number
  contractual_hours_by_day: Record<string, number> | null
}

interface TimeEntry {
  start_time: number
  end_time: number
}

export async function POST(request: Request) {
  try {
    const requestData = await request.json()
    const { startDate, endDate, userId } = requestData

    if (!startDate || !endDate || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters', received: { startDate, endDate, userId } }, 
        { status: 400 }
      )
    }

    console.log('\n--- Coverage Calculation for User:', userId, '---')
    console.log('Period:', startDate, 'to', endDate)

    // Fetch working days calendar
    const workingDaysResult = await query<WorkingDay>(`
      SELECT calendar_day, is_working_day 
      FROM working_days_calendar 
      WHERE calendar_day >= $1 AND calendar_day <= $2 
      ORDER BY calendar_day
    `, [startDate, endDate])

    const workingDays = workingDaysResult.rows
    console.log('Working days calendar entries:', workingDays.length)

    // Fetch user contracts
    const contractsResult = await query<Contract>(`
      SELECT * FROM organization_user_contracts 
      WHERE user_id = $1 
        AND from_date <= $2 
        AND to_date >= $3 
      ORDER BY from_date DESC
    `, [userId, endDate, startDate])

    const contracts = contractsResult.rows

    if (contracts.length === 0) {
      console.log('No contract found for user')
      return NextResponse.json({
        dailyCoverage: [],
        overallCoverage: 0,
        totalExpectedHours: 0,
        totalActualHours: 0
      })
    }

    const contract = contracts[0]
    console.log('Contract found:', {
      type: contract.contract_type,
      contractualHours: contract.contractual_hours,
      contractualHoursByDay: contract.contractual_hours_by_day
    })

    const extendedEndDate = new Date(endDate);
    extendedEndDate.setDate(extendedEndDate.getDate() + 1);
    extendedEndDate.setHours(0, 0, 0, 0);
    
    // Fetch time entries
    const timeEntriesResult = await query<TimeEntry>(`
      SELECT start_time, end_time 
      FROM time_blocking_events 
      WHERE user_id = $1 
        AND event_type = 'activity' 
        AND completed = true 
        AND start_time >= $2 
        AND end_time < $3
    `, [userId, new Date(startDate).getTime(), extendedEndDate.getTime()])

    const timeEntries = timeEntriesResult.rows
    console.log('Time entries found:', timeEntries.length)

    // Process each day
    const dailyCoverage: DailyCoverage[] = []
    const currentDate = new Date(startDate)
    const endDateTime = new Date(endDate)
    
    let totalExpectedHoursForDebug = 0
    let totalActualHoursForDebug = 0

    while (currentDate <= endDateTime) {
      const currentDateStr = currentDate.toISOString().split('T')[0]
      const workingDay = workingDays.find(wd => wd.calendar_day === currentDateStr)
      
      // Calculate expected hours
      let expectedHours = 0
      if (workingDay?.is_working_day) {
        const dayOfWeek = currentDate.getDay().toString()
        
        if (contract.contract_type === 'full-time') {
          if (dayOfWeek !== '0' && dayOfWeek !== '6') {
            // Se è full-time e giorno lavorativo, usa direttamente contractual_hours
            expectedHours = Number(contract.contractual_hours)
          }
        } else {
          const hoursForDay = contract.contractual_hours_by_day?.[dayOfWeek]
          expectedHours = hoursForDay ? Number(hoursForDay) : 0
        }
      }

      // Calculate actual hours
      const dayStart = new Date(currentDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(currentDate)
      dayEnd.setHours(23, 59, 59, 999)
      
      const dayEntries = timeEntries.filter(entry => 
        entry.start_time >= dayStart.getTime() && 
        entry.end_time <= dayEnd.getTime()
      )

      const actualHours = dayEntries.reduce((total, entry) => 
        total + (entry.end_time - entry.start_time) / 3600000, 0
      )

      totalExpectedHoursForDebug += expectedHours
      totalActualHoursForDebug += actualHours

      // Log daily details if there's activity or expected hours
      console.log('Day:', currentDateStr, {
        isWorkingDay: workingDay?.is_working_day,
        dayOfWeek: currentDate.getDay(),
        contractType: contract.contract_type,
        contractualHours: contract.contractual_hours,
        expectedHours,
        actualHours,
        timeEntries: dayEntries.length
      })

      // Calculate coverage
      const coverage = expectedHours > 0 ? (actualHours / expectedHours) * 100 : 0

      dailyCoverage.push({
        date: currentDateStr,
        expectedHours,
        actualHours,
        coverage
      })

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate overall coverage
    const totalExpectedHours = dailyCoverage.reduce((sum, day) => sum + day.expectedHours, 0)
    const totalActualHours = timeEntries.reduce((sum, entry) => 
      sum + ((entry.end_time) - entry.start_time) / 3600000, 0
    )
    const overallCoverage = totalExpectedHours > 0 ? 
      (totalActualHours / totalExpectedHours) * 100 : 0

    console.log('\nSummary for user', userId)
    console.log('Total Expected Hours:', totalExpectedHours)
    console.log('Total Actual Hours:', totalActualHours)
    console.log('Overall Coverage:', overallCoverage.toFixed(2) + '%')
    console.log('Debug Check - Expected:', totalExpectedHoursForDebug)
    console.log('Debug Check - Actual:', totalActualHoursForDebug)
    console.log('----------------------------------------\n')

    return NextResponse.json({
      dailyCoverage,
      overallCoverage,
      totalExpectedHours,
      totalActualHours
    })
  
  } catch (error) {
    console.error('Coverage calculation error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error }, 
      { status: 500 }
    )
  }
}