'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CalendarIcon, Plus, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
// Note: Using API routes for database operations instead of direct client access
import _ from 'lodash'
import { toast } from "sonner"

interface WorkingDay {
  id: number
  calendar_day: string
  is_working_day: boolean
  description: string | null
  organization_id: string | null
}

// Reduce debounce time for better responsiveness
const debouncedUpdate = _.debounce((
  dayId: number, 
  description: string, 
  updateFn: (id: number, updates: Partial<WorkingDay>) => Promise<void>
) => {
  updateFn(dayId, { description });
}, 300);

export default function WorkingCalendar() {
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<number[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    calendar_day: '',
    is_working_day: true,
    description: ''
  })

  const fetchWorkingDays = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/working-calendar')
      if (!response.ok) {
        throw new Error('Failed to fetch working days')
      }
      const data = await response.json()
      setWorkingDays(data)
    } catch (error) {
      console.error('Error fetching working days:', error)
      toast.error('Failed to fetch working days')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkingDays()
  }, [])

  const handleAdd = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/working-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendar_day: formData.calendar_day,
          is_working_day: formData.is_working_day,
          description: formData.description || null
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create working day')
      }
      
      await fetchWorkingDays()
      setIsDialogOpen(false)
      setFormData({
        calendar_day: '',
        is_working_day: true,
        description: ''
      })
      toast.success('Day added successfully')
    } catch (error) {
      console.error('Error adding working day:', error)
      toast.error('Failed to add day')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async (dayId: number, updates: Partial<WorkingDay>) => {
    try {
      setUpdatingIds(prev => [...prev, dayId])
      const response = await fetch(`/api/working-calendar/${dayId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update working day')
      }

      const updatedDay = await response.json()
      setWorkingDays(prevDays => 
        prevDays.map(day => 
          day.id === dayId ? { ...day, ...updatedDay } : day
        )
      )
      toast.success('Day updated successfully')
    } catch (error) {
      console.error('Error updating working day:', error)
      toast.error('Failed to update day')
    } finally {
      setUpdatingIds(prev => prev.filter(id => id !== dayId))
    }
  }

  const handleDescriptionChange = (dayId: number, value: string) => {
    // Update local state immediately
    setWorkingDays(prevDays =>
      prevDays.map(d =>
        d.id === dayId
          ? { ...d, description: value }
          : d
      )
    );
    // Use the shared debounced function
    debouncedUpdate(dayId, value, handleUpdate);
  };

  const handleDelete = async (id: number) => {
    try {
      setUpdatingIds(prev => [...prev, id])
      const response = await fetch(`/api/working-calendar/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete working day')
      }
      
      await fetchWorkingDays()
      toast.success('Day deleted successfully')
    } catch (error) {
      console.error('Error deleting working day:', error)
      toast.error('Failed to delete day')
    } finally {
      setUpdatingIds(prev => prev.filter(dayId => dayId !== id))
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <main className="flex-1 p-8">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">📅 Working Calendar</h1>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Day
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Working Day</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setSelectedDate(date)
                            if (date) {
                              setFormData(prev => ({
                                ...prev,
                                calendar_day: format(date, 'yyyy-MM-dd')
                              }))
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.is_working_day}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, is_working_day: checked }))
                      }
                    />
                    <Label>Working Day</Label>
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Optional description..."
                    />
                  </div>
                  
                  <Button onClick={handleAdd} disabled={isLoading} className="w-full">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Day
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading && workingDays.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {workingDays.map((day) => (
                <Card key={day.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="font-medium min-w-32">
                        {format(new Date(day.calendar_day), 'yyyy-MM-dd')}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={day.is_working_day}
                          onCheckedChange={(checked) => 
                            handleUpdate(day.id, { is_working_day: checked })
                          }
                          disabled={updatingIds.includes(day.id)}
                        />
                        <Label className={day.is_working_day ? "text-green-600" : "text-red-600"}>
                          {day.is_working_day ? "Working" : "Non-working"}
                        </Label>
                      </div>
                      
                      <div className="flex-1">
                        <Textarea
                          value={day.description || ''}
                          onChange={(e) => handleDescriptionChange(day.id, e.target.value)}
                          placeholder="Description..."
                          className="min-h-8"
                          disabled={updatingIds.includes(day.id)}
                        />
                      </div>
                    </div>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(day.id)}
                      disabled={updatingIds.includes(day.id)}
                    >
                      {updatingIds.includes(day.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}