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
        setStats(data)
      } catch (err) {
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
            <div className="text-3xl font-bold">{stats.openProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Projects Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats.openProjectsBudget)}</div>
            <div className="text-sm text-gray-500 mt-1">
              Remaining: {formatCurrency(stats.remainingBudget)}
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
                <div className="text-2xl font-bold">{stats.averageMarginability.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Actual Margin</div>
                <div className={`text-2xl font-bold ${stats.actualMargin < 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {stats.actualMargin.toFixed(1)}%
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
            <div className="text-3xl font-bold text-red-500">{stats.projectsWithNegativeMargin}</div>
            <div className="text-sm text-gray-500 mt-1">
              {((stats.projectsWithNegativeMargin / stats.openProjects) * 100).toFixed(1)}% of open projects
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
              <div className="text-2xl font-bold">{stats.totalHours.future.toFixed(1)}</div>
              <div className="text-sm text-gray-500">
                {((stats.totalHours.future / (stats.totalHours.future + stats.totalHours.pastConfirmed + stats.totalHours.pastUnconfirmed)) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Past Confirmed Hours</div>
              <div className="text-2xl font-bold text-green-600">{stats.totalHours.pastConfirmed.toFixed(1)}</div>
              <div className="text-sm text-gray-500">
                {((stats.totalHours.pastConfirmed / (stats.totalHours.future + stats.totalHours.pastConfirmed + stats.totalHours.pastUnconfirmed)) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Past Unconfirmed Hours</div>
              <div className="text-2xl font-bold text-orange-600">{stats.totalHours.pastUnconfirmed.toFixed(1)}</div>
              <div className="text-sm text-gray-500">
                {((stats.totalHours.pastUnconfirmed / (stats.totalHours.future + stats.totalHours.pastConfirmed + stats.totalHours.pastUnconfirmed)) * 100).toFixed(1)}%
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
              <div className="text-2xl font-bold text-green-600">{stats.billableProjects}</div>
              <div className="text-sm text-gray-500">
                {((stats.billableProjects / stats.openProjects) * 100).toFixed(1)}% of open projects
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Non-Billable Projects</div>
              <div className="text-2xl font-bold text-orange-600">{stats.nonBillableProjects}</div>
              <div className="text-sm text-gray-500">
                {((stats.nonBillableProjects / stats.openProjects) * 100).toFixed(1)}% of open projects
              </div>
            </div>
            <Progress 
              value={(stats.billableProjects / stats.openProjects) * 100} 
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
                {Object.entries(stats.projectsByCategory).map(([category, stats]) => (
                  <TableRow key={category}>
                    <TableCell>{category}</TableCell>
                    <TableCell>{stats.count}</TableCell>
                    <TableCell>{formatCurrency(stats.totalBudget)}</TableCell>
                    <TableCell>{stats.averageMarginability.toFixed(1)}%</TableCell>
                    <TableCell className={stats.actualMargin < 0 ? 'text-red-500' : ''}>
                      {stats.actualMargin.toFixed(1)}%
                    </TableCell>
                    <TableCell>{formatCurrency(stats.remainingBudget)}</TableCell>
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
                {Object.entries(stats.projectsByArea).map(([area, stats]) => (
                  <TableRow key={area}>
                    <TableCell>{area}</TableCell>
                    <TableCell>{stats.count}</TableCell>
                    <TableCell>{formatCurrency(stats.totalBudget)}</TableCell>
                    <TableCell>{stats.averageMarginability.toFixed(1)}%</TableCell>
                    <TableCell className={stats.actualMargin < 0 ? 'text-red-500' : ''}>
                      {stats.actualMargin.toFixed(1)}%
                    </TableCell>
                    <TableCell>{formatCurrency(stats.remainingBudget)}</TableCell>
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
              {stats.topBudgetProjects.map((project) => (
                <TableRow key={project.uid}>
                  <TableCell className="font-medium">{project.title}</TableCell>
                  <TableCell>{formatCurrency(project.budget)}</TableCell>
                  <TableCell>{formatCurrency(project.consumedBudget)}</TableCell>
                  <TableCell>{formatCurrency(project.remainingBudget)}</TableCell>
                  <TableCell>{project.marginability_percentage.toFixed(1)}%</TableCell>
                  <TableCell className={project.actualMargin < 0 ? 'text-red-500' : ''}>
                    {project.actualMargin.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Future: {project.totalHours.future.toFixed(1)}h</div>
                      <div>Past Confirmed: {project.totalHours.pastConfirmed.toFixed(1)}h</div>
                      <div>Past Unconfirmed: {project.totalHours.pastUnconfirmed.toFixed(1)}h</div>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(project.start_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(project.end_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 