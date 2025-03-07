'use client'

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from 'date-fns'
import { CalendarIcon, ChevronDown, ChevronUp, X, Clock } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

const formatHoursAndMinutes = (hours: number): string => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

interface CategorySummary {
  categoryId: string;
  name: string;
  color: string;
  totalHours: number;
  percentage: number;
}

interface ProjectSummary {
  projectId: string
  title: string
  totalHours: number
  isBillable: boolean
  percentage: number 
}

interface DailyEntry {
  date: number
  totalHours: number
  confirmedHours: number
  unconfirmedHours: number
  billablePercentage: number
  unassignedPercentage: number
  projectSummaries: ProjectSummary[]
  isExpanded?: boolean
  billableHours: number
}

interface UserTimeData {
  userId: string
  nominative: string
  email: string
  confirmedHours: number
  unconfirmedHours: number
  billablePercentage: number
  unassignedPercentage: number
  projectSummaries: ProjectSummary[]
  dailyEntries: DailyEntry[]
  isExpanded: boolean
  categorySummaries: CategorySummary[]
  coveragePercentage: number
  coverageData?: CoverageData;
}

interface SidebarState {
  isOpen: boolean
  userData: UserTimeData | null
}

interface TimeEntry{
  uid: string;
  user_id: string;
  start_time: number;
  end_time: number;
  completed: boolean;
  project: {
      uid: string;
      title: string;
      not_billable: boolean;
  };
  category: {
    uid: string
    name: string
    color: string
  }
}

interface DailyCoverage {
  date: string;
  expectedHours: number;
  actualHours: number;
  coverage: number;
}

interface CoverageData {
  dailyCoverage: DailyCoverage[];
  overallCoverage: number;
  totalExpectedHours: number;
  totalActualHours: number;
}

export default function AdminDashboard() {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [userTimeData, setUserTimeData] = useState<UserTimeData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sidebar, setSidebar] = useState<SidebarState>({
    isOpen: false,
    userData: null
  })

  

  

  const fetchTimeTrackingData = async (start: Date, end: Date) => {
    setIsLoading(true)
  
    try {
      const dayStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0))
      const dayEnd = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999))
  
      // 1. Fetch all active users
      const { data: activeUsers, error: userError } = await supabase
        .from('users')
        .select('uid, nominative, email')
        .eq('status', 'active')
  
      if (userError) {
        console.error('Error fetching users:', userError)
        return
      }
  
      // 2. Fetch coverage data for all users in parallel
      const coveragePromises = activeUsers.map(async (user) => {
        try {
          const response = await fetch(`${window.location.origin}/api/coverage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate: dayStart.toISOString().split('T')[0],
              endDate: dayEnd.toISOString().split('T')[0],
              userId: user.uid
            }),
          })
      
          if (!response.ok) {
            console.error('Coverage API error for user:', user.uid, await response.text())
            return { userId: user.uid, coverageData: null }
          }
          
          const data = await response.json()
          return {
            userId: user.uid,
            coverageData: data
          }
        } catch (error) {
          console.error('Coverage request error for user:', user.uid, error)
          return { userId: user.uid, coverageData: null }
        }
      })
  
      // 3. Fetch all time entries in paginated form
      let allTimeEntries: TimeEntry[] = []
      let hasMore = true
      let currentPage = 0
      const PAGE_SIZE = 1000
  
      while (hasMore) {
        const { data: timeEntries, error } = await supabase
          .from('time_blocking_events')
          .select(`
            uid,
            user_id,
            start_time,
            end_time,
            completed,
            project:projects (
              uid,
              title,
              not_billable
            ),
            category:task_categories (
              uid,
              name,
              color
            )
          `)
          .gte('start_time', dayStart.getTime())
          .lte('end_time', dayEnd.getTime())
          .eq('event_type', 'activity')
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)
          .order('start_time', { ascending: true })
  
        if (error) {
          console.error('Query error:', error)
          break
        }
  
        if (timeEntries.length > 0) {
          allTimeEntries = [...allTimeEntries, ...timeEntries as unknown as TimeEntry[]]
        }
  
        hasMore = timeEntries.length === PAGE_SIZE
        currentPage++
      }
  
      // 4. Wait for coverage data
      const coverageResults = await Promise.all(coveragePromises)
  
      // 5. Process data for each user
      const processedData: UserTimeData[] = activeUsers.map(user => {
        const userEntries = allTimeEntries.filter(entry => entry.user_id === user.uid)
        const userCoverage = coverageResults.find(cr => cr.userId === user.uid)
        
        // Initialize maps for aggregation
        const projectMap = new Map<string, ProjectSummary>()
        const categoryMap = new Map<string, CategorySummary>()
        const dailyEntriesMap = new Map<number, DailyEntry>()
        
        // Tracking totals
        let totalBillableHours = 0
        let totalHours = 0
        let totalUnassignedHours = 0
        let uncategorizedHours = 0
  
        // Process each time entry
        userEntries.forEach(entry => {
          const duration = (entry.end_time - entry.start_time) / 3600000
          totalHours += duration
  
          // Process categories
          if (entry.category) {
            const categoryId = entry.category.uid
            if (!categoryMap.has(categoryId)) {
              categoryMap.set(categoryId, {
                categoryId,
                name: entry.category.name,
                color: entry.category.color || '#808080',
                totalHours: 0,
                percentage: 0
              })
            }
            const categorySummary = categoryMap.get(categoryId)!
            categorySummary.totalHours += duration
          } else {
            uncategorizedHours += duration
          }
  
          // Process daily entries
          const entryDate = new Date(entry.start_time)
          const dayStartUTC = Date.UTC(
            entryDate.getUTCFullYear(),
            entryDate.getUTCMonth(),
            entryDate.getUTCDate(),
            0, 0, 0, 0
          )

          if (!dailyEntriesMap.has(dayStartUTC)) {
            dailyEntriesMap.set(dayStartUTC, {
              date: dayStartUTC,
              totalHours: 0,
              confirmedHours: 0,
              unconfirmedHours: 0,
              billablePercentage: 0,
              unassignedPercentage: 0,
              projectSummaries: [],
              billableHours: 0
            })
          }

          const dailyEntry = dailyEntriesMap.get(dayStartUTC)!
          dailyEntry.totalHours += duration
  
          if (entry.completed) {
            dailyEntry.confirmedHours += duration
          } else {
            dailyEntry.unconfirmedHours += duration
          }
  
          // Process projects
          if (entry.project) {
            const projectId = entry.project.uid
            const isBillable = !entry.project.not_billable
  
            if (!projectMap.has(projectId)) {
              projectMap.set(projectId, {
                projectId,
                title: entry.project.title,
                totalHours: 0,
                isBillable,
                percentage: 0
              })
            }
            const projectSummary = projectMap.get(projectId)!
            projectSummary.totalHours += duration
  
            if (isBillable) {
              totalBillableHours += duration
              dailyEntry.billableHours += duration
            }
  
            let dailyProjectSummary = dailyEntry.projectSummaries.find(p => p.projectId === projectId)
            if (!dailyProjectSummary) {
              dailyProjectSummary = {
                projectId,
                title: entry.project.title,
                totalHours: 0,
                isBillable,
                percentage: 0
              }
              dailyEntry.projectSummaries.push(dailyProjectSummary)
            }
            dailyProjectSummary.totalHours += duration
          } else {
            totalUnassignedHours += duration
            dailyEntry.unassignedPercentage = (duration / dailyEntry.totalHours) * 100
          }
  
          // Update daily percentages
          dailyEntry.billablePercentage = (dailyEntry.billableHours / dailyEntry.totalHours) * 100
          dailyEntry.projectSummaries.forEach(project => {
            project.percentage = (project.totalHours / dailyEntry.totalHours) * 100
          })
        })
  
        // Calculate final percentages
        projectMap.forEach(project => {
          project.percentage = (project.totalHours / totalHours) * 100
        })
  
        categoryMap.forEach(category => {
          category.percentage = (category.totalHours / totalHours) * 100
        })
  
        // Process category summaries
        let categorySummaries = Array.from(categoryMap.values())
        if (uncategorizedHours > 0) {
          categorySummaries.push({
            categoryId: 'uncategorized',
            name: 'Uncategorized',
            color: '#E0E0E0',
            totalHours: uncategorizedHours,
            percentage: (uncategorizedHours / totalHours) * 100
          })
        }
        categorySummaries = categorySummaries.sort((a, b) => b.totalHours - a.totalHours)
  
        const confirmedHours = userEntries
          .filter(entry => entry.completed)
          .reduce((sum, entry) => sum + (entry.end_time - entry.start_time) / 3600000, 0)
  
        const unconfirmedHours = userEntries
          .filter(entry => !entry.completed)
          .reduce((sum, entry) => sum + (entry.end_time - entry.start_time) / 3600000, 0)
  
        return {
          userId: user.uid,
          nominative: user.nominative,
          email: user.email,
          confirmedHours,
          unconfirmedHours,
          billablePercentage: totalHours ? (totalBillableHours / totalHours) * 100 : 0,
          unassignedPercentage: totalHours ? (totalUnassignedHours / totalHours) * 100 : 0,
          projectSummaries: Array.from(projectMap.values()),
          categorySummaries,
          dailyEntries: Array.from(dailyEntriesMap.values()),
          coverageData: userCoverage?.coverageData,
          coveragePercentage: userCoverage?.coverageData?.overallCoverage || 0,
          isExpanded: false
        }
      })
  
      // Sort users alphabetically by nominative
      const sortedData = processedData.sort((a, b) => 
        a.nominative.localeCompare(b.nominative)
      )
  
      setUserTimeData(sortedData)
    } catch (error) {
      console.error('Error processing data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleUserExpansion = (userId: string) => {
    setUserTimeData(prevData =>
      prevData.map(userData =>
        userData.userId === userId
          ? { ...userData, isExpanded: !userData.isExpanded }
          : userData
      )
    )
  }

  const toggleDailyEntryExpansion = (userData: UserTimeData, date: number) => {
    setSidebar(prevSidebar => ({
      ...prevSidebar,
      userData: prevSidebar.userData ? {
        ...prevSidebar.userData,
        dailyEntries: prevSidebar.userData.dailyEntries.map(entry =>
          entry.date === date
            ? { ...entry, isExpanded: !entry.isExpanded }
            : entry
        )
      } : null
    }))
  }

  const openSidebar = (userData: UserTimeData) => {
    setSidebar({
      isOpen: true,
      userData: {
        ...userData,
        dailyEntries: userData.dailyEntries.map(entry => ({
          ...entry,
          isExpanded: false
        }))
      }
    })
  }

  const closeSidebar = () => {
    setSidebar({
      isOpen: false,
      userData: null
    })
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <main className="flex-1 p-8">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">⏱ Time Analysis</h1>
          </div>
          
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
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
                        variant="outline"
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
                {userTimeData.map((userData) => (
                  <div key={userData.userId} className="border rounded-lg">
                    <div className="flex justify-between items-center p-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium mr-4">{userData.nominative}</span>
                            <span className="text-gray-500">{userData.email}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-600">
                              Total: {formatHoursAndMinutes(userData.unconfirmedHours + userData.confirmedHours)}
                            </span>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openSidebar(userData)}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleUserExpansion(userData.userId)}
                            >
                              {userData.isExpanded ? <ChevronUp /> : <ChevronDown />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {userData.isExpanded && (
                      
                      <div className="p-4 border-t bg-gray-50">

                        {/* KPI */}
                        <div className="mb-4">
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                              <div className="text-sm text-gray-500">Unconfirmed</div>
                              <div className="text-lg font-medium">
                                {formatHoursAndMinutes(userData.unconfirmedHours)}
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                            <div className="text-sm text-gray-500">Confirmed</div>
                              <div className="text-lg font-medium">
                                {formatHoursAndMinutes(userData.confirmedHours)}
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                              <div className="text-sm text-gray-500">Billable %</div>
                              <div className="text-lg font-medium">
                                {userData.billablePercentage.toFixed(1)}%
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                              <div className="text-sm text-gray-500">Non-Billable %</div>
                              <div className="text-lg font-medium">
                                {(100 - userData.billablePercentage).toFixed(1)}%
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                              <div className="text-sm text-gray-500">Coverage %</div>
                              <div className="text-lg font-medium">
                                {userData.coveragePercentage.toFixed(1)}% [{userData.coverageData?.totalActualHours}/{userData.coverageData?.totalExpectedHours}]
                              </div>
                            </div>
                          </div>
                        </div>

                        

                        {/* grafico a torta */}
                        <div className="mb-4">
                          <h3 className="font-medium mb-2">Time by Category</h3>
                          <div className="bg-white p-4 rounded-lg shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-shrink-0">
                                <PieChart width={300} height={300}>
                                  <Pie
                                    data={userData.categorySummaries}
                                    dataKey="totalHours"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    innerRadius={60}
                                    paddingAngle={2}
                                  >
                                    {userData.categorySummaries.map((category) => (
                                      <Cell key={category.categoryId} fill={category.color} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="bg-white p-2 shadow rounded border">
                                            <p className="font-medium">{data.name}</p>
                                            <p className="text-sm text-gray-600">
                                              {formatHoursAndMinutes(data.totalHours)}
                                              {' '}({data.percentage.toFixed(1)}%)
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                </PieChart>
                              </div>
                              
                              <div className="flex-1 ml-8">
                                <div className="max-h-[300px] overflow-y-auto pr-2">
                                  <div className="grid grid-cols-1 gap-3">
                                    {userData.categorySummaries.map((category) => (
                                      <div 
                                        key={category.categoryId} 
                                        className="flex items-center gap-2 border rounded p-2 hover:bg-gray-50"
                                      >
                                        <div 
                                          className="w-4 h-4 rounded-full flex-shrink-0" 
                                          style={{ backgroundColor: category.color }}
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">{category.name}</div>
                                          <div className="text-sm text-gray-500">
                                            {formatHoursAndMinutes(category.totalHours)} • {category.percentage.toFixed(1)}%
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>


                        <div>
                          <h3 className="font-medium mb-2">Projects</h3>
                          <div className="space-y-2">
                            {userData.projectSummaries.map((project) => (
                              <div
                                key={project.projectId}
                                className="bg-white p-4 rounded-lg shadow-sm"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-medium">{project.title}</span>
                                    <span className={`ml-2 text-sm ${
                                      project.isBillable ? 'text-green-500' : 'text-orange-500'
                                    }`}>
                                      {project.isBillable ? 'Billable' : 'Non-billable'}
                                    </span>
                                  </div>
                                  <div className="text-gray-600 flex items-center gap-4">
                                    <span>{formatHoursAndMinutes(project.totalHours)}</span>
                                    <span className="text-sm">({project.percentage.toFixed(1)}%)</span>
                                  </div>
                                </div>
                                <div className="mt-2 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      project.isBillable ? 'bg-green-500' : 'bg-orange-500'
                                    }`}
                                    style={{ width: `${project.percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                            
                            {userData.unassignedPercentage > 0 && (
                              <div className="bg-white p-4 rounded-lg shadow-sm border-2 border-dashed border-gray-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-medium text-gray-500">Unassigned Time</span>
                                  </div>
                                  <div className="text-gray-600 flex items-center gap-4">
                                    <span>{formatHoursAndMinutes(
                                      (userData.confirmedHours + userData.unconfirmedHours) * 
                                      (userData.unassignedPercentage / 100)
                                    )}</span>
                                    <span className="text-sm">({userData.unassignedPercentage.toFixed(1)}%)</span>
                                  </div>
                                </div>
                                <div className="mt-2 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full bg-gray-400"
                                    style={{ width: `${userData.unassignedPercentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Card>
      </main>
      
      {sidebar.isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 transition-opacity"
          onClick={closeSidebar}
        />
      )}
      
      <div className={`fixed inset-y-0 right-0 w-3/4 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
        sidebar.isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {sidebar.isOpen && sidebar.userData && (
          <div className="h-full p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{sidebar.userData.nominative}</h2>
              <Button variant="ghost" size="icon" onClick={closeSidebar}>
                <X className="h-6 w-6" />
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Daily Hours</h3>
              {sidebar.userData.dailyEntries
                .sort((a, b) => b.date - a.date)
                .map((entry) => (
                  <div key={entry.date} className="border rounded-lg hover:bg-gray-50">
                    <button
                      className="w-full p-4 flex justify-between items-center"
                      onClick={() => toggleDailyEntryExpansion(sidebar.userData!, entry.date)}
                    >
                      <span className="font-medium">
                        {format(entry.date, 'EEEE, MMMM d, yyyy')}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">
                          {formatHoursAndMinutes(entry.totalHours)}
                        </span>
                        {entry.isExpanded ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </button>
                    
                    {entry.isExpanded && (
                      <div className="p-4 border-t bg-gray-50">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Summary</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="text-sm text-gray-500">Unconfirmed</div>
                                <div className="text-lg font-medium">
                                  {formatHoursAndMinutes(entry.unconfirmedHours)}
                                </div>
                              </div>
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="text-sm text-gray-500">Confirmed</div>
                                <div className="text-lg font-medium">
                                  {formatHoursAndMinutes(entry.confirmedHours)}
                                </div>
                              </div>
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="text-sm text-gray-500">Billable %</div>
                                <div className="text-lg font-medium">
                                  {entry.billablePercentage.toFixed(1)}%
                                </div>
                              </div>
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="text-sm text-gray-500">Non-Billable %</div>
                                <div className="text-lg font-medium">
                                  {(100 - entry.billablePercentage).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Projects</h4>
                            <div className="space-y-2">
                              {entry.projectSummaries.map((project) => (
                                <div
                                  key={project.projectId}
                                  className="bg-white p-4 rounded-lg shadow-sm"
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-medium">{project.title}</span>
                                      <span className={`ml-2 text-sm ${
                                        project.isBillable ? 'text-green-500' : 'text-orange-500'
                                      }`}>
                                        {project.isBillable ? 'Billable' : 'Non-billable'}
                                      </span>
                                    </div>
                                    <div className="text-gray-600 flex items-center gap-4">
                                      <span>{formatHoursAndMinutes(project.totalHours)}</span>
                                      <span className="text-sm">({project.percentage.toFixed(1)}%)</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        project.isBillable ? 'bg-green-500' : 'bg-orange-500'
                                      }`}
                                      style={{ width: `${project.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}

                              {entry.unassignedPercentage > 0 && (
                                <div className="bg-white p-4 rounded-lg shadow-sm border-2 border-dashed border-gray-200">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-medium text-gray-500">Unassigned Time</span>
                                    </div>
                                    <div className="text-gray-600 flex items-center gap-4">
                                      <span>{formatHoursAndMinutes(
                                        entry.totalHours * (entry.unassignedPercentage / 100)
                                      )}</span>
                                      <span className="text-sm">({entry.unassignedPercentage.toFixed(1)}%)</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full bg-gray-400"
                                      style={{ width: `${entry.unassignedPercentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}