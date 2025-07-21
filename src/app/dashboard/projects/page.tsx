'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

// Helper function to safely format numbers
const safeToFixed = (value: any, decimals: number = 1): string => {
  // Convert to number first
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
  
  // Check if it's a valid number
  if (numValue === null || numValue === undefined || isNaN(numValue)) {
    return '0.0'
  }
  
  return numValue.toFixed(decimals)
}

// Helper function to safely get numeric values
const safeNumber = (value: any): number => {
  // Convert to number first
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
  
  // Check if it's a valid number
  if (numValue === null || numValue === undefined || isNaN(numValue)) {
    return 0
  }
  
  return numValue
}

interface CategoryStats {
  count: number
  totalBudget: number
  averageMarginability: number
  actualMargin: number
  remainingBudget: number
}

interface ProjectStats {
  openProjects: number
  openProjectsBudget: number
  averageMarginability: number
  actualMargin: number
  projectsWithNegativeMargin: number
  billableProjects: number
  nonBillableProjects: number
  totalHours: {
    future: number
    pastConfirmed: number
    pastUnconfirmed: number
  }
  remainingBudget: number
  projectsByCategory: Record<string, CategoryStats>
  projectsByArea: Record<string, CategoryStats>
  topBudgetProjects: Array<{
    uid: string
    title: string
    status: string
    budget: number
    marginability_percentage: number
    actualMargin: number
    consumedBudget: number
    remainingBudget: number
    totalHours: {
      future: number
      pastConfirmed: number
      pastUnconfirmed: number
    }
    start_date: string
    end_date: string
  }>
}

export default function ProjectsDashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // TODO: Replace with actual organization ID from your auth context
        const response = await fetch('/api/projects/stats?organizationId=12a7ce28-f179-4555-a883-40ea40ea73ce')
        if (!response.ok) {
          throw new Error('Failed to fetch project statistics')
        }
        const data = await response.json()
        console.log('Fetched stats data:', data) // Debug log to see what data we're getting
        setStats(data)
      } catch (err) {
        console.error('Error fetching stats:', err) // Debug log
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>
  }

  if (!stats) {
    return <div className="p-8">No data available</div>
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Projects Dashboard</h1>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Open Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{safeNumber(stats.openProjects)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Projects Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(safeNumber(stats.openProjectsBudget))}</div>
            <div className="text-sm text-gray-500 mt-1">
              Remaining: {formatCurrency(safeNumber(stats.remainingBudget))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-gray-500">Target Margin</div>
                <div className="text-2xl font-bold">{safeToFixed(stats.averageMarginability, 1)}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Actual Margin</div>
                <div className={`text-2xl font-bold ${safeNumber(stats.actualMargin) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {safeToFixed(stats.actualMargin, 1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects with Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{safeNumber(stats.projectsWithNegativeMargin)}</div>
            <div className="text-sm text-gray-500 mt-1">
              {safeNumber(stats.openProjects) > 0 ? 
                ((safeNumber(stats.projectsWithNegativeMargin) / safeNumber(stats.openProjects)) * 100).toFixed(1) : 
                '0.0'}% of open projects
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hours Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Hours Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Future Hours</div>
              <div className="text-2xl font-bold">{safeToFixed(stats.totalHours?.future, 1)}</div>
              <div className="text-sm text-gray-500">
                {(() => {
                  const future = safeNumber(stats.totalHours?.future)
                  const pastConfirmed = safeNumber(stats.totalHours?.pastConfirmed)
                  const pastUnconfirmed = safeNumber(stats.totalHours?.pastUnconfirmed)
                  const total = future + pastConfirmed + pastUnconfirmed
                  return total > 0 ? ((future / total) * 100).toFixed(1) : '0.0'
                })()}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Past Confirmed Hours</div>
              <div className="text-2xl font-bold text-green-600">{safeToFixed(stats.totalHours?.pastConfirmed, 1)}</div>
              <div className="text-sm text-gray-500">
                {(() => {
                  const future = safeNumber(stats.totalHours?.future)
                  const pastConfirmed = safeNumber(stats.totalHours?.pastConfirmed)
                  const pastUnconfirmed = safeNumber(stats.totalHours?.pastUnconfirmed)
                  const total = future + pastConfirmed + pastUnconfirmed
                  return total > 0 ? ((pastConfirmed / total) * 100).toFixed(1) : '0.0'
                })()}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Past Unconfirmed Hours</div>
              <div className="text-2xl font-bold text-orange-600">{safeToFixed(stats.totalHours?.pastUnconfirmed, 1)}</div>
              <div className="text-sm text-gray-500">
                {(() => {
                  const future = safeNumber(stats.totalHours?.future)
                  const pastConfirmed = safeNumber(stats.totalHours?.pastConfirmed)
                  const pastUnconfirmed = safeNumber(stats.totalHours?.pastUnconfirmed)
                  const total = future + pastConfirmed + pastUnconfirmed
                  return total > 0 ? ((pastUnconfirmed / total) * 100).toFixed(1) : '0.0'
                })()}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billable vs Non-Billable */}
      <Card>
        <CardHeader>
          <CardTitle>Billable vs Non-Billable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Billable Projects</div>
              <div className="text-2xl font-bold text-green-600">{safeNumber(stats.billableProjects)}</div>
              <div className="text-sm text-gray-500">
                {safeNumber(stats.openProjects) > 0 ? 
                  ((safeNumber(stats.billableProjects) / safeNumber(stats.openProjects)) * 100).toFixed(1) : 
                  '0.0'}% of open projects
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Non-Billable Projects</div>
              <div className="text-2xl font-bold text-orange-600">{safeNumber(stats.nonBillableProjects)}</div>
              <div className="text-sm text-gray-500">
                {safeNumber(stats.openProjects) > 0 ? 
                  ((safeNumber(stats.nonBillableProjects) / safeNumber(stats.openProjects)) * 100).toFixed(1) : 
                  '0.0'}% of open projects
              </div>
            </div>
            <Progress 
              value={safeNumber(stats.openProjects) > 0 ? 
                (safeNumber(stats.billableProjects) / safeNumber(stats.openProjects)) * 100 : 
                0} 
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Category (Open Only)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Target Margin</TableHead>
                  <TableHead>Actual Margin</TableHead>
                  <TableHead>Remaining Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.projectsByCategory && Object.entries(stats.projectsByCategory).map(([category, categoryStats]) => (
                  <TableRow key={category}>
                    <TableCell>{category}</TableCell>
                    <TableCell>{safeNumber(categoryStats.count)}</TableCell>
                    <TableCell>{formatCurrency(safeNumber(categoryStats.totalBudget))}</TableCell>
                    <TableCell>{safeToFixed(categoryStats.averageMarginability, 1)}%</TableCell>
                    <TableCell className={safeNumber(categoryStats.actualMargin) < 0 ? 'text-red-500' : ''}>
                      {safeToFixed(categoryStats.actualMargin, 1)}%
                    </TableCell>
                    <TableCell>{formatCurrency(safeNumber(categoryStats.remainingBudget))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects by Area (Open Only)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Target Margin</TableHead>
                  <TableHead>Actual Margin</TableHead>
                  <TableHead>Remaining Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.projectsByArea && Object.entries(stats.projectsByArea).map(([area, areaStats]) => (
                  <TableRow key={area}>
                    <TableCell>{area}</TableCell>
                    <TableCell>{safeNumber(areaStats.count)}</TableCell>
                    <TableCell>{formatCurrency(safeNumber(areaStats.totalBudget))}</TableCell>
                    <TableCell>{safeToFixed(areaStats.averageMarginability, 1)}%</TableCell>
                    <TableCell className={safeNumber(areaStats.actualMargin) < 0 ? 'text-red-500' : ''}>
                      {safeToFixed(areaStats.actualMargin, 1)}%
                    </TableCell>
                    <TableCell>{formatCurrency(safeNumber(areaStats.remainingBudget))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Projects by Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle>Open Projects by Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Consumed</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Target Margin</TableHead>
                <TableHead>Actual Margin</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.topBudgetProjects && stats.topBudgetProjects.map((project) => (
                <TableRow key={project.uid}>
                  <TableCell className="font-medium">{project.title || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(safeNumber(project.budget))}</TableCell>
                  <TableCell>{formatCurrency(safeNumber(project.consumedBudget))}</TableCell>
                  <TableCell>{formatCurrency(safeNumber(project.remainingBudget))}</TableCell>
                  <TableCell>{safeToFixed(project.marginability_percentage, 1)}%</TableCell>
                  <TableCell className={safeNumber(project.actualMargin) < 0 ? 'text-red-500' : ''}>
                    {safeToFixed(project.actualMargin, 1)}%
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Future: {safeToFixed(project.totalHours?.future, 1)}h</div>
                      <div>Past Confirmed: {safeToFixed(project.totalHours?.pastConfirmed, 1)}h</div>
                      <div>Past Unconfirmed: {safeToFixed(project.totalHours?.pastUnconfirmed, 1)}h</div>
                    </div>
                  </TableCell>
                  <TableCell>{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>{project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 