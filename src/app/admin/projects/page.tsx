'use client'

import { useEffect, useState } from 'react'
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from '@/lib/supabase'

interface Project {
  uid: string
  title: string
  customer: string
  budget: number
  project_manager_id: string
  status: string
  closing_date: string
  tolerance_days: number
  customer_id: string
  project_manager?: {
    nominative: string
  }
  customer_details?: {
    name: string
  }
}

interface ProjectUpdate {
  status: string
  project_id: string
  created_at: string
}

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  console.log(isLoading)

  const fetchData = async () => {
    setIsLoading(true)
    
    // Fetch open projects with related data
    const { data: projectsData } = await supabase
      .from('projects')
      .select(`
        *
      `)
      .eq('status_id', '58cc0507-b8ed-4508-83ca-3d9b7b5ba882')

    // Fetch latest updates
    const { data: updatesData } = await supabase
      .from('project_details_update')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectsData) setProjects(projectsData)
    if (updatesData) setUpdates(updatesData)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalBudgetNumber = projects.length
  const top10Projects = [...projects]
    .sort((a, b) => (b.budget || 0) - (a.budget || 0))
    .slice(0, 10)

  const getProjectStatus = (projectId: string) => {
    const latestUpdate = updates
      .filter(u => u.project_id === projectId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    
    return latestUpdate?.status || 'no updates'
  }

  const delayedProjects = projects.filter(p => {
    if (!p.closing_date) return false
    const deadline = new Date(p.closing_date)
    deadline.setDate(deadline.getDate() + (p.tolerance_days || 0))
    return deadline < new Date()
  })

  const projectStatusCount = projects.reduce((acc, project) => {
    const status = getProjectStatus(project.uid)
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8">
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="margin">Margin</TabsTrigger>
          <TabsTrigger value="progression">Progression</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Total Open Projects</h2>
              <p className="text-4xl font-bold">#{totalBudgetNumber} · €{totalBudget.toLocaleString()}</p>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Top 10 Projects by Budget</h2>
              <div className="space-y-4">
                {top10Projects.map(project => (
                  <div key={project.uid} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h3 className="font-medium">{project.title}</h3>
                      <p className="text-sm text-gray-600">
                        Client: {project.customer_details?.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        PM: {project.project_manager?.nominative}
                      </p>
                    </div>
                    <p className="font-medium">€{project.budget?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Project Status Overview</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Delayed Projects</h3>
                  <p className="text-3xl font-bold">{delayedProjects.length}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Status Distribution</h3>
                  <div className="space-y-2">
                    <p>Halted: {projectStatusCount['halted'] || 0}</p>
                    <p>In Progress: {projectStatusCount['in progress'] || 0}</p>
                    <p>No Updates: {projectStatusCount['no updates'] || 0}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="margin">
          <Card className="p-6">
            <h2 className="text-2xl font-bold">Margin Analysis</h2>
            <p className="text-gray-600">Tab content to be implemented</p>
          </Card>
        </TabsContent>

        <TabsContent value="progression">
          <Card className="p-6">
            <h2 className="text-2xl font-bold">Project Progression</h2>
            <p className="text-gray-600">Tab content to be implemented</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}