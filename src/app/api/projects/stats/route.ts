import { query } from '@/lib/database'
import { NextResponse } from 'next/server'

interface CategoryStats {
  count: number
  totalBudget: number
  averageMarginability: number
  actualMargin: number
  totalHours: {
    future: number
    pastConfirmed: number
    pastUnconfirmed: number
  }
  remainingBudget: number
}

interface Project {
  budget: number | null
  marginability_percentage: number | null
  project_categories?: { name: string }
  project_areas?: { name: string }
  uid: string
  title: string
  status_id: string | null
  projects_workflows?: { name: string }
  start_date: string
  end_date: string
  not_billable: boolean
  organization_id: string
}

interface TimeEntry {
  project_id: string
  user_id: string
  start_time: number
  end_time: number
  completed: boolean
}

interface UserContract {
  user_id: string
  hourly_cost: number
  organization_id: string
  from_date: string
  to_date: string
}

interface Overhead {
  amount: number
  organization_id: string
  from_date: string
  to_date: string
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    console.log('Request received with organizationId:', organizationId)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Fetch all projects for the organization with joins
    console.log('Fetching projects for organization:', organizationId)
    const projectsResult = await query<Project & {
      category_name: string | null
      area_name: string | null
      workflow_name: string | null
    }>(`
      SELECT 
        p.*,
        pc.name as category_name,
        pa.name as area_name,
        pw.name as workflow_name
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.uid
      LEFT JOIN project_areas pa ON p.area_id = pa.uid
      LEFT JOIN projects_workflows pw ON p.status_id = pw.uid
      WHERE p.organization_id = $1
    `, [organizationId])

    console.log('Projects fetched:', projectsResult.rows.length, 'projects found')

    // Transform the results to match the expected structure
    const projects = projectsResult.rows.map(project => ({
      ...project,
      project_categories: project.category_name ? { name: project.category_name } : null,
      project_areas: project.area_name ? { name: project.area_name } : null,
      projects_workflows: project.workflow_name ? { name: project.workflow_name } : null
    }))

    // Fetch user-project links
    console.log('Fetching user-project links')
    const userProjectLinksResult = await query(`
      SELECT * FROM user_project_link 
      WHERE organization_id = $1
    `, [organizationId])

    console.log('User-project links fetched:', userProjectLinksResult.rows.length, 'links found')
    //const userProjectLinks = userProjectLinksResult.rows

    // Fetch time entries for all projects
    let timeEntries: TimeEntry[] = []

    if (projects.length > 0) {
      console.log('Starting time entries fetch for', projects.length, 'projects')
      
      const projectIds = projects.map(p => p.uid).filter(Boolean)
      
      if (projectIds.length > 0) {
        console.log('Fetching time entries for', projectIds.length, 'project IDs')
        
        // Create placeholders for IN clause
        const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
        
        const timeEntriesResult = await query<TimeEntry>(`
          SELECT * FROM time_blocking_events 
          WHERE project_id IN (${placeholders})
        `, projectIds)

        timeEntries = timeEntriesResult.rows
        console.log('Total time entries fetched:', timeEntries.length)
      }
    } else {
      console.log('No projects found, skipping time entries fetch')
    }

    // Fetch user contracts
    console.log('Fetching user contracts')
    const userContractsResult = await query<UserContract>(`
      SELECT * FROM organization_user_contracts 
      WHERE organization_id = $1 
        AND from_date <= $2 
        AND to_date >= $3
    `, [organizationId, new Date().toISOString(), new Date().toISOString()])

    const userContracts = userContractsResult.rows
    console.log('User contracts fetched:', userContracts.length, 'contracts found')

    // Fetch overheads
    console.log('Fetching overheads')
    const overheadsResult = await query<Overhead>(`
      SELECT * FROM overheads 
      WHERE organization_id = $1 
        AND from_date <= $2 
        AND to_date >= $3
    `, [organizationId, new Date().toISOString(), new Date().toISOString()])

    const overheads = overheadsResult.rows
    console.log('Overheads fetched:', overheads.length, 'overheads found')

    // Fetch project expenses
    console.log('Fetching project expenses')
    const expensesResult = await query(`
      SELECT * FROM expenses 
      WHERE organization_id = $1
    `, [organizationId])

    const expenses = expensesResult.rows
    console.log('Expenses fetched:', expenses.length, 'expenses found')

    // Filter open projects
    const openProjects = projects.filter(p => p.projects_workflows?.name === 'Aperto')
    
    // Calculate projects with negative margin
    const projectsWithNegativeMargin = openProjects.filter(
      p => (p.marginability_percentage || 0) < 0
    ).length

    // Calculate billable/non-billable projects
    const billableProjects = openProjects.filter(p => !p.not_billable).length
    const nonBillableProjects = openProjects.filter(p => p.not_billable).length

    // Initialize stats
    const stats: ProjectStats = {
      openProjects: openProjects.length,
      openProjectsBudget: openProjects.reduce((sum, p) => sum + (p.budget || 0), 0),
      averageMarginability: openProjects.length > 0 
        ? openProjects.reduce((sum, p) => sum + (p.marginability_percentage || 0), 0) / openProjects.length 
        : 0,
      actualMargin: 0, // Will be calculated later
      projectsWithNegativeMargin,
      billableProjects,
      nonBillableProjects,
      totalHours: {
        future: 0,
        pastConfirmed: 0,
        pastUnconfirmed: 0
      },
      remainingBudget: 0,
      projectsByCategory: {},
      projectsByArea: {},
      topBudgetProjects: []
    }

    // Calculate project costs
    const projectCosts = new Map<string, {
      totalCost: number
      hours: {
        future: number
        pastConfirmed: number
        pastUnconfirmed: number
      }
    }>()

    // Initialize project costs
    projects.forEach(project => {
      if (project.uid) {
        projectCosts.set(project.uid, {
          totalCost: 0,
          hours: {
            future: 0,
            pastConfirmed: 0,
            pastUnconfirmed: 0
          }
        })
      }
    })

    // Process time entries
    timeEntries.forEach(entry => {
      const projectId = entry.project_id
      if (!projectId) return

      const duration = (entry.end_time - entry.start_time) / 3600000 // Convert to hours
      const now = Date.now()
      const isFuture = entry.start_time > now
      const isPast = entry.start_time <= now

      if (!projectCosts.has(projectId)) {
        projectCosts.set(projectId, {
          totalCost: 0,
          hours: {
            future: 0,
            pastConfirmed: 0,
            pastUnconfirmed: 0
          }
        })
      }

      const projectCost = projectCosts.get(projectId)!
      
      // Update hours
      if (isFuture) {
        projectCost.hours.future += duration
      } else if (isPast) {
        if (entry.completed) {
          projectCost.hours.pastConfirmed += duration
        } else {
          projectCost.hours.pastUnconfirmed += duration
        }
      }

      // Calculate cost based on user contract
      const userContract = userContracts.find(c => c.user_id === entry.user_id)
      const hourlyCost = userContract?.hourly_cost || 1 // Default to 1 if no contract found
      const overhead = overheads[0]?.amount || 0 // Use first active overhead or 0
      const totalHourlyCost = hourlyCost * (1 + overhead)

      projectCost.totalCost += duration * totalHourlyCost
    })

    // Aggregate total hours
    projectCosts.forEach(cost => {
      stats.totalHours.future += cost.hours.future
      stats.totalHours.pastConfirmed += cost.hours.pastConfirmed
      stats.totalHours.pastUnconfirmed += cost.hours.pastUnconfirmed
    })

    // Calculate total cost and actual margin
    let totalCost = 0
    projectCosts.forEach(cost => {
      totalCost += cost.totalCost
    })

    stats.actualMargin = stats.openProjectsBudget > 0 
      ? ((stats.openProjectsBudget - totalCost) / stats.openProjectsBudget) * 100 
      : 0
    stats.remainingBudget = stats.openProjectsBudget - totalCost

    // Calculate statistics by category
    openProjects.forEach(project => {
      const categoryName = project.project_categories?.name || 'Uncategorized'
      
      if (!stats.projectsByCategory[categoryName]) {
        stats.projectsByCategory[categoryName] = {
          count: 0,
          totalBudget: 0,
          averageMarginability: 0,
          actualMargin: 0,
          totalHours: { future: 0, pastConfirmed: 0, pastUnconfirmed: 0 },
          remainingBudget: 0
        }
      }

      const categoryStats = stats.projectsByCategory[categoryName]
      const projectCost = projectCosts.get(project.uid) || {
        totalCost: 0,
        hours: { future: 0, pastConfirmed: 0, pastUnconfirmed: 0 }
      }

      categoryStats.count++
      categoryStats.totalBudget += project.budget || 0
      categoryStats.totalHours.future += projectCost.hours.future
      categoryStats.totalHours.pastConfirmed += projectCost.hours.pastConfirmed
      categoryStats.totalHours.pastUnconfirmed += projectCost.hours.pastUnconfirmed
      categoryStats.remainingBudget += (project.budget || 0) - projectCost.totalCost
    })

    // Calculate average marginability by category
    Object.keys(stats.projectsByCategory).forEach(categoryName => {
      const categoryProjects = openProjects.filter(p => 
        (p.project_categories?.name || 'Uncategorized') === categoryName
      )
      const categoryStats = stats.projectsByCategory[categoryName]
      
      categoryStats.averageMarginability = categoryProjects.length > 0
        ? categoryProjects.reduce((sum, p) => sum + (p.marginability_percentage || 0), 0) / categoryProjects.length
        : 0

      categoryStats.actualMargin = categoryStats.totalBudget > 0
        ? ((categoryStats.totalBudget - categoryStats.remainingBudget) / categoryStats.totalBudget) * 100
        : 0
    })

    // Calculate statistics by area (similar logic)
    openProjects.forEach(project => {
      const areaName = project.project_areas?.name || 'Uncategorized'
      
      if (!stats.projectsByArea[areaName]) {
        stats.projectsByArea[areaName] = {
          count: 0,
          totalBudget: 0,
          averageMarginability: 0,
          actualMargin: 0,
          totalHours: { future: 0, pastConfirmed: 0, pastUnconfirmed: 0 },
          remainingBudget: 0
        }
      }

      const areaStats = stats.projectsByArea[areaName]
      const projectCost = projectCosts.get(project.uid) || {
        totalCost: 0,
        hours: { future: 0, pastConfirmed: 0, pastUnconfirmed: 0 }
      }

      areaStats.count++
      areaStats.totalBudget += project.budget || 0
      areaStats.totalHours.future += projectCost.hours.future
      areaStats.totalHours.pastConfirmed += projectCost.hours.pastConfirmed
      areaStats.totalHours.pastUnconfirmed += projectCost.hours.pastUnconfirmed
      areaStats.remainingBudget += (project.budget || 0) - projectCost.totalCost
    })

    // Calculate average marginability by area
    Object.keys(stats.projectsByArea).forEach(areaName => {
      const areaProjects = openProjects.filter(p => 
        (p.project_areas?.name || 'Uncategorized') === areaName
      )
      const areaStats = stats.projectsByArea[areaName]
      
      areaStats.averageMarginability = areaProjects.length > 0
        ? areaProjects.reduce((sum, p) => sum + (p.marginability_percentage || 0), 0) / areaProjects.length
        : 0

      areaStats.actualMargin = areaStats.totalBudget > 0
        ? ((areaStats.totalBudget - areaStats.remainingBudget) / areaStats.totalBudget) * 100
        : 0
    })

    // Get open projects sorted by budget (highest first)
    stats.topBudgetProjects = openProjects
      .sort((a, b) => (b.budget || 0) - (a.budget || 0))
      .map(project => {
        const projectCost = projectCosts.get(project.uid) || {
          totalCost: 0,
          hours: {
            future: 0,
            pastConfirmed: 0,
            pastUnconfirmed: 0
          }
        }

        const actualMargin = (project.budget || 0) > 0 ? 
          (((project.budget || 0) - projectCost.totalCost) / (project.budget || 0)) * 100 : 0

        return {
          uid: project.uid,
          title: project.title,
          status: project.projects_workflows?.name || 'Unknown',
          budget: project.budget || 0,
          marginability_percentage: project.marginability_percentage || 0,
          actualMargin,
          consumedBudget: projectCost.totalCost,
          remainingBudget: (project.budget || 0) - projectCost.totalCost,
          totalHours: projectCost.hours,
          start_date: project.start_date,
          end_date: project.end_date
        }
      })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error calculating project statistics:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error },
      { status: 500 }
    )
  }
} 