import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface DailyCoverage {
  date: string
  expectedHours: number
  actualHours: number
  coverage: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    const { data: workingDays, error: calendarError } = await supabase
      .from('working_days_calendar')
      .select('calendar_day, is_working_day')
      .gte('calendar_day', startDate)
      .lte('calendar_day', endDate)
      .order('calendar_day')

    if (calendarError) {
      console.error('Calendar fetch error:', calendarError)
      return NextResponse.json(
        { error: 'Error fetching calendar data', details: calendarError }, 
        { status: 500 }
      )
    }

    console.log('Working days calendar entries:', workingDays?.length)

    // Fetch user contracts
    const { data: contracts, error: contractError } = await supabase
      .from('organization_user_contracts')
      .select('*')
      .eq('user_id', userId)
      .lte('from_date', endDate)
      .gte('to_date', startDate)
      .order('from_date', { ascending: false })

    if (contractError) {
      console.error('Contract fetch error:', contractError)
      return NextResponse.json(
        { error: 'Error fetching contract data', details: contractError }, 
        { status: 500 }
      )
    }

    if (!contracts || contracts.length === 0) {
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
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_blocking_events')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .eq('event_type', 'activity')
      .gte('start_time', new Date(startDate).getTime())
      .lt('end_time', extendedEndDate.getTime())

    if (timeError) {
      console.error('Time entries fetch error:', timeError)
      return NextResponse.json(
        { error: 'Error fetching time entries', details: timeError }, 
        { status: 500 }
      )
    }

    console.log('Time entries found:', timeEntries?.length)

    // Process each day
    const dailyCoverage: DailyCoverage[] = []
    const currentDate = new Date(startDate)
    const endDateTime = new Date(endDate)
    
    let totalExpectedHoursForDebug = 0
    let totalActualHoursForDebug = 0

    while (currentDate <= endDateTime) {
      const currentDateStr = currentDate.toISOString().split('T')[0]
      const workingDay = workingDays?.find(wd => wd.calendar_day === currentDateStr)
      
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
      
      const dayEntries = timeEntries?.filter(entry => 
        entry.start_time >= dayStart.getTime() && 
        entry.end_time <= dayEnd.getTime()
      )

      const actualHours = dayEntries?.reduce((total, entry) => 
        total + (entry.end_time - entry.start_time) / 3600000, 0
      ) || 0

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
          timeEntries: dayEntries?.length
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
    const totalActualHours = timeEntries?.reduce((sum, entry) => 
      sum + ((entry.end_time) - entry.start_time) / 3600000, 0
    ) || 0  
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