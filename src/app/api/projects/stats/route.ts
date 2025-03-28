import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

interface CategoryStats {
  count: number
  totalBudget: number
  averageMarginability: number
}

interface Project {
  budget: number | null
  marginability_percentage: number | null
  project_categories?: { name: string }
  project_areas?: { name: string }
}

interface ProjectStats {
  openProjects: number
  openProjectsBudget: number
  averageMarginability: number
  projectsWithNegativeMargin: number
  billableProjects: number
  nonBillableProjects: number
  projectsByCategory: Record<string, CategoryStats>
  projectsByArea: Record<string, CategoryStats>
  topBudgetProjects: Array<{
    uid: string
    title: string
    status: string
    budget: number
    marginability_percentage: number
    start_date: string
    end_date: string
  }>
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Fetch all projects for the organization
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
      projectsWithNegativeMargin,
      billableProjects,
      nonBillableProjects,
      projectsByCategory: {},
      projectsByArea: {},
      topBudgetProjects: []
    }

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
      
      stats.projectsByCategory[category] = {
        count: projects.length,
        totalBudget,
        averageMarginability: avgMarginability
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
      
      stats.projectsByArea[area] = {
        count: projects.length,
        totalBudget,
        averageMarginability: avgMarginability
      }
    })

    // Get open projects sorted by budget (highest first)
    stats.topBudgetProjects = openProjects
      .sort((a, b) => (b.budget || 0) - (a.budget || 0))
      .map(project => ({
        uid: project.uid,
        title: project.title,
        status: project.status,
        budget: project.budget || 0,
        marginability_percentage: project.marginability_percentage || 0,
        start_date: project.start_date,
        end_date: project.end_date
      }))

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error calculating project statistics:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error },
      { status: 500 }
    )
  }
} 