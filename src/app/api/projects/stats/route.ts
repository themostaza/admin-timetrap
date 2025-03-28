import { supabase } from '@/lib/supabase'
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
  status: string
  start_date: string
  end_date: string
  not_billable: boolean
}

interface TimeEntry {
  project_id: string
  user_id: string
  start_time: number
  end_time: number
  completed: boolean
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

    // Fetch all projects for the organization
    console.log('Fetching projects for organization:', organizationId)
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        *,
        project_categories (name),
        project_areas (name)
      `)
      .eq('organization_id', organizationId)

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json(
        { error: 'Error fetching projects', details: projectsError },
        { status: 500 }
      )
    }

    console.log('Projects fetched:', projects?.length || 0, 'projects found')

    // Fetch user-project links
    console.log('Fetching user-project links')
    const { data: userProjectLinks, error: linksError } = await supabase
      .from('user_project_link')
      .select('*')
      .eq('organization_id', organizationId)

    if (linksError) {
      console.error('Error fetching user-project links:', linksError)
      return NextResponse.json(
        { error: 'Error fetching user-project links', details: linksError },
        { status: 500 }
      )
    }

    console.log('User-project links fetched:', userProjectLinks?.length || 0, 'links found')

    // Fetch time entries for all projects
    let timeEntries: TimeEntry[] = []
    let timeEntriesError = null

    if (projects && projects.length > 0) {
      console.log('Starting time entries fetch for', projects.length, 'projects')
      // Split projects into chunks to avoid query size limits
      const chunkSize = 100
      const projectChunks = []
      for (let i = 0; i < projects.length; i += chunkSize) {
        projectChunks.push(projects.slice(i, i + chunkSize))
      }

      console.log('Split into', projectChunks.length, 'chunks')

      // Fetch time entries for each chunk
      for (const chunk of projectChunks) {
        const projectIds = chunk.map(p => p.uid).filter(Boolean)
        console.log('Processing chunk with', projectIds.length, 'valid project IDs')
        
        if (projectIds.length === 0) {
          console.log('Skipping empty chunk')
          continue
        }

        console.log('Fetching time entries for project IDs:', projectIds)
        const { data: chunkData, error: chunkError } = await supabase
          .from('time_blocking_events')
          .select('*')
          .in('project_id', projectIds)

        if (chunkError) {
          console.error('Error fetching time entries chunk:', chunkError)
          console.error('Failed project IDs:', projectIds)
          timeEntriesError = chunkError
          break
        }

        if (chunkData) {
          console.log('Chunk data received:', chunkData.length, 'entries')
          timeEntries = timeEntries.concat(chunkData)
        }
      }
    } else {
      console.log('No projects found, skipping time entries fetch')
    }

    if (timeEntriesError) {
      console.error('Error fetching time entries:', timeEntriesError)
      return NextResponse.json(
        { error: 'Error fetching time entries', details: timeEntriesError },
        { status: 500 }
      )
    }

    console.log('Total time entries fetched:', timeEntries.length)

    // Fetch user contracts
    console.log('Fetching user contracts')
    const { data: userContracts, error: contractsError } = await supabase
      .from('organization_user_contracts')
      .select('*')
      .eq('organization_id', organizationId)
      .lte('from_date', new Date().toISOString())
      .gte('to_date', new Date().toISOString())

    if (contractsError) {
      console.error('Error fetching user contracts:', contractsError)
      return NextResponse.json(
        { error: 'Error fetching user contracts', details: contractsError },
        { status: 500 }
      )
    }

    console.log('User contracts fetched:', userContracts?.length || 0, 'contracts found')

    // Fetch overheads
    console.log('Fetching overheads')
    const { data: overheads, error: overheadsError } = await supabase
      .from('overheads')
      .select('*')
      .eq('organization_id', organizationId)
      .lte('from_date', new Date().toISOString())
      .gte('to_date', new Date().toISOString())

    if (overheadsError) {
      console.error('Error fetching overheads:', overheadsError)
      return NextResponse.json(
        { error: 'Error fetching overheads', details: overheadsError },
        { status: 500 }
      )
    }

    console.log('Overheads fetched:', overheads?.length || 0, 'overheads found')

    // Fetch project expenses
    console.log('Fetching project expenses')
    const validProjectIds = projects.map(p => p.uid).filter(Boolean)
    console.log('Valid project IDs for expenses:', validProjectIds.length)
    console.log('First few project IDs:', validProjectIds.slice(0, 5))
    
    let expenses = []
    let expensesError = null
    
    if (validProjectIds.length > 0) {
      console.log('Attempting to fetch expenses with organizationId:', organizationId)
      const { data: expensesData, error: expensesErrorData } = await supabase
        .from('expenses')
        .select('*')
        .eq('organization_id', organizationId)
        

      if (expensesErrorData) {
        console.error('Error fetching expenses:', expensesErrorData)
        console.error('Error details:', {
          message: expensesErrorData.message,
          details: expensesErrorData.details,
          hint: expensesErrorData.hint,
          code: expensesErrorData.code
        })
        expensesError = expensesErrorData
      } else {
        expenses = expensesData || []
        console.log('Successfully fetched expenses:', expenses.length)
      }
    } else {
      console.log('No valid project IDs found for expenses query')
    }

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError)
      return NextResponse.json(
        { error: 'Error fetching expenses', details: expensesError },
        { status: 500 }
      )
    }

    console.log('Expenses fetched:', expenses?.length || 0, 'expenses found')

    // Filter open projects
    const openProjects = projects.filter(p => p.status === 'open')
    
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
      averageMarginability: openProjects.reduce((sum, p) => sum + (p.marginability_percentage || 0), 0) / openProjects.length || 0,
      actualMargin: 0,
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

    // Calculate project costs and hours
    const projectCosts = new Map<string, {
      totalCost: number
      hours: {
        future: number
        pastConfirmed: number
        pastUnconfirmed: number
      }
    }>()

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

    // Process expenses
    expenses.forEach(expense => {
      const projectId = expense.project_id
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
      // Use confirmed_amount if available, otherwise use estimated_amount
      const expenseAmount = expense.confirmed_amount !== null ? expense.confirmed_amount : expense.estimated_amount || 0
      projectCost.totalCost += expenseAmount
    })

    // Calculate category statistics (only for open projects)
    const categoryProjects = new Map<string, Array<Project>>()
    openProjects.forEach(project => {
      const categoryName = project.project_categories?.name || 'Uncategorized'
      if (!categoryProjects.has(categoryName)) {
        categoryProjects.set(categoryName, [])
      }
      categoryProjects.get(categoryName)?.push(project)
    })

    categoryProjects.forEach((projects, category) => {
      const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
      const avgMarginability = projects.reduce((sum, p) => sum + (p.marginability_percentage || 0), 0) / projects.length
      
      // Calculate actual costs and margins for category
      let totalCost = 0
      const categoryTotalHours = {
        future: 0,
        pastConfirmed: 0,
        pastUnconfirmed: 0
      }

      projects.forEach(project => {
        const projectCost = projectCosts.get(project.uid)
        if (projectCost) {
          totalCost += projectCost.totalCost
          categoryTotalHours.future += projectCost.hours.future
          categoryTotalHours.pastConfirmed += projectCost.hours.pastConfirmed
          categoryTotalHours.pastUnconfirmed += projectCost.hours.pastUnconfirmed
        }
      })

      const actualMargin = totalBudget > 0 ? ((totalBudget - totalCost) / totalBudget) * 100 : 0
      
      stats.projectsByCategory[category] = {
        count: projects.length,
        totalBudget,
        averageMarginability: avgMarginability,
        actualMargin,
        totalHours: categoryTotalHours,
        remainingBudget: totalBudget - totalCost
      }
    })

    // Calculate area statistics (only for open projects)
    const areaProjects = new Map<string, Array<Project>>()
    openProjects.forEach(project => {
      const areaName = project.project_areas?.name || 'No Area'
      if (!areaProjects.has(areaName)) {
        areaProjects.set(areaName, [])
      }
      areaProjects.get(areaName)?.push(project)
    })

    areaProjects.forEach((projects, area) => {
      const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
      const avgMarginability = projects.reduce((sum, p) => sum + (p.marginability_percentage || 0), 0) / projects.length
      
      // Calculate actual costs and margins for area
      let totalCost = 0
      const areaTotalHours = {
        future: 0,
        pastConfirmed: 0,
        pastUnconfirmed: 0
      }

      projects.forEach(project => {
        const projectCost = projectCosts.get(project.uid)
        if (projectCost) {
          totalCost += projectCost.totalCost
          areaTotalHours.future += projectCost.hours.future
          areaTotalHours.pastConfirmed += projectCost.hours.pastConfirmed
          areaTotalHours.pastUnconfirmed += projectCost.hours.pastUnconfirmed
        }
      })

      const actualMargin = totalBudget > 0 ? ((totalBudget - totalCost) / totalBudget) * 100 : 0
      
      stats.projectsByArea[area] = {
        count: projects.length,
        totalBudget,
        averageMarginability: avgMarginability,
        actualMargin,
        totalHours: areaTotalHours,
        remainingBudget: totalBudget - totalCost
      }
    })

    // Calculate overall stats
    let totalCost = 0
    const overallTotalHours = {
      future: 0,
      pastConfirmed: 0,
      pastUnconfirmed: 0
    }

    openProjects.forEach(project => {
      const projectCost = projectCosts.get(project.uid)
      if (projectCost) {
        totalCost += projectCost.totalCost
        overallTotalHours.future += projectCost.hours.future
        overallTotalHours.pastConfirmed += projectCost.hours.pastConfirmed
        overallTotalHours.pastUnconfirmed += projectCost.hours.pastUnconfirmed
      }
    })

    stats.actualMargin = stats.openProjectsBudget > 0 ? 
      ((stats.openProjectsBudget - totalCost) / stats.openProjectsBudget) * 100 : 0
    stats.totalHours = overallTotalHours
    stats.remainingBudget = stats.openProjectsBudget - totalCost

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
          status: project.status,
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