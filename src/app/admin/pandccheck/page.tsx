'use client'

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format, eachDayOfInterval } from 'date-fns'
import { CalendarIcon, ChevronDown, ChevronUp, X } from "lucide-react"
import { supabase } from '@/lib/supabase'

const formatHoursAndMinutes = (hours: number): string => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

interface TimeEntry {
  user_id: string
  confirmed_hours: number
  unconfirmed_hours: number
  user: {
    nominative: string
    email: string
  }
  activities?: {
    title: string
    start_time: number
    end_time: number
    duration: number
    completed: boolean
  }[]
}


interface DayStats {
  date: Date
  underTimeUsers: number
  noTimeUsers: number
  entries: TimeEntry[]
  usersWithNoTime: Array<{ nominative: string; email: string }>
  isExpanded: boolean
}

interface SidebarState {
  isOpen: boolean
  userData: TimeEntry | null
  date: Date | null
}

export default function AdminDashboard() {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [timeStats, setTimeStats] = useState<DayStats[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sidebar, setSidebar] = useState<SidebarState>({
    isOpen: false,
    userData: null,
    date: null
  })

  const fetchTimeTrackingData = async (start: Date, end: Date) => {
    setIsLoading(true)
    
    const days = eachDayOfInterval({ start, end })
    const statsPromises = days.map(async (day) => {
      const dayStart = new Date(day)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)

      // Fetch all active users
      const { data: activeUsers, error: userError } = await supabase
        .from('users')
        .select('uid, nominative, email')
        .eq('status', 'active')

      console.log('Active users:', activeUsers)
      if (userError) {
        console.error('Error fetching users:', userError)
        return null
      }

      const { data: timeEntries, error } = await supabase
        .from('time_blocking_events')
        .select(`
          user_id,
          user:users!inner(
            nominative,
            email
          ),
          start_time,
          end_time,
          title,
          completed
        `)
        .gte('start_time', dayStart.getTime())
        .lte('start_time', dayEnd.getTime())
        .lte('end_time', dayEnd.getTime())
        .gte('end_time', dayStart.getTime())
        .eq('event_type', 'activity')
        .eq('users.status', 'active')
        //console.log('timeEntries dalla query', timeEntries)

      if (error) {
        console.error('Error fetching time data:', error)
        return null
      }

      const userHours = timeEntries.reduce((acc: { [key: string]: TimeEntry }, entry) => {
        console.log('entry', entry)
        if (!acc[entry.user_id]) {
          acc[entry.user_id] = {
            user_id: entry.user_id,
            user: entry.user as unknown as TimeEntry['user'],
            confirmed_hours: 0,
            unconfirmed_hours: 0,
            activities: []
          }
        }
        const duration = (entry.end_time - entry.start_time) / 3600000
        if (entry.completed) {
          acc[entry.user_id].confirmed_hours += duration
        } else {
          acc[entry.user_id].unconfirmed_hours += duration
        }
        acc[entry.user_id].activities?.push({
          title: entry.title,
          start_time: entry.start_time,
          end_time: entry.end_time,
          duration,
          completed: entry.completed
        })
        return acc
      }, {})
      console.log('userhours', userHours)

      // Find users with no time entries
      const usersWithNoTime = activeUsers.filter(user => 
        !timeEntries.some(entry => entry.user_id === user.uid)
      ).map(user => ({
        nominative: user?.nominative,
        email: user?.email
      }))

      const entries = Object.values(userHours)
      const underTimeUsers = entries.filter(entry => 
        (entry.confirmed_hours + entry.unconfirmed_hours) < 8
      ).length

      return {
        date: day,
        underTimeUsers,
        noTimeUsers: usersWithNoTime.length,
        entries,
        usersWithNoTime,
        isExpanded: false
      }
    })

    const results = await Promise.all(statsPromises)
    setTimeStats(results.filter((stat): stat is DayStats => stat !== null))
    setIsLoading(false)
  }
 console.log('timestastt', timeStats)
  const toggleDayExpansion = (date: Date) => {
    setTimeStats(prevStats =>
      prevStats.map(stat =>
        stat.date.getTime() === date.getTime()
          ? { ...stat, isExpanded: !stat.isExpanded }
          : stat
      )
    )
  }

  const openSidebar = (userData: TimeEntry, date: Date) => {
    setSidebar({
      isOpen: true,
      userData,
      date
    })
  }

  const closeSidebar = () => {
    setSidebar({
      isOpen: false,
      userData: null,
      date: null
    })
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <main className="flex-1 p-8">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">🎯 P&C Check ore</h1>
          </div>
          
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button 
                  className="mt-6"
                  onClick={() => startDate && endDate && fetchTimeTrackingData(startDate, endDate)}
                  disabled={isLoading || !startDate || !endDate}
                >
                  {isLoading ? 'Loading...' : 'Analyze'}
                </Button>
              </div>

              <div className="space-y-2">
                {timeStats.map((dayStat) => (
                  <div key={dayStat.date.toISOString()} className="border rounded-lg">
                    <div 
                      className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleDayExpansion(dayStat.date)}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          {format(dayStat.date, 'dd/MM/yyyy')}
                        </span>
                        <span className="text-red-500 font-medium">
                          {dayStat.underTimeUsers || 0} 🤪 under 8 hh
                        </span>
                        <span className="text-orange-500 font-medium">
                          {dayStat.noTimeUsers || 0} 😴 no hours
                        </span>
                      </div>
                      {dayStat.isExpanded ? <ChevronUp /> : <ChevronDown />}
                    </div>

                    {dayStat.isExpanded && (
                      <div className="p-4 border-t bg-gray-50">
                        {dayStat.usersWithNoTime && dayStat.usersWithNoTime.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-2">Users with No Hours:</h3>
                            <div className="bg-orange-50 p-4 rounded-lg">
                              {dayStat.usersWithNoTime.map((user, index) => (
                                <div key={index} className="mb-2">
                                  <span className="font-medium">{user?.nominative}</span>
                                  <span className="text-gray-600 ml-2">({user?.email})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">User</th>
                              <th className="text-left p-2">Email</th>
                              <th className="text-right p-2">Unconfirmed</th>
                              <th className="text-right p-2">Confirmed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayStat.entries?.map((entry) => (
                              <tr 
                                key={entry.user_id}
                                className={`border-b cursor-pointer transition-colors ${
                                  entry.confirmed_hours + entry.unconfirmed_hours < 8 ? 'bg-red-50' : ''
                                } hover:bg-gray-800 hover:text-white`}
                                onClick={() => openSidebar(entry, dayStat.date)}
                              >
                                <td className="p-2">{entry.user?.nominative}</td>
                                <td className="p-2">{entry.user?.email}</td>
                                <td className="p-2 text-right">
                                  {formatHoursAndMinutes(entry.unconfirmed_hours)}
                                </td>
                                <td className="p-2 text-right">
                                  {formatHoursAndMinutes(entry.confirmed_hours)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Card>
      </main>

      <div className={`fixed inset-y-0 right-0 w-1/2 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
        sidebar.isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {sidebar.isOpen && sidebar.userData && sidebar.date && (
          <div className="h-full p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {sidebar.userData.user?.nominative}
              </h2>
              <Button variant="ghost" size="icon" onClick={closeSidebar}>
                <X className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600">{format(sidebar.date, 'PPPP')}</p>
              <p className="text-xl font-semibold mt-2">
                Unconfirmed: {formatHoursAndMinutes(sidebar.userData.unconfirmed_hours)}
              </p>
              <p className="text-xl font-semibold mt-2">
                Confirmed: {formatHoursAndMinutes(sidebar.userData.confirmed_hours)}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Activities</h3>
              {sidebar.userData.activities?.sort((a, b) => a.start_time - b.start_time).map((activity, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                  <h4 className="font-medium mb-2">{activity.title}</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>From: {format(activity.start_time, 'HH:mm')}</p>
                    <p>To: {format(activity.end_time, 'HH:mm')}</p>
                    <p className="text-sm font-medium">
                      Duration: {formatHoursAndMinutes(activity.duration)}
                    </p>
                    <p className="text-sm font-medium">
                      Status: {activity.completed ? 'Confirmed' : 'Unconfirmed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}