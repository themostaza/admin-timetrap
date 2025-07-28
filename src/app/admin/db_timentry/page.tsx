'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { format, isValid } from 'date-fns'
import { 
  CalendarIcon, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  X,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  AlertTriangle
} from "lucide-react"

interface TimeEntry {
  uid: string
  user_id: string
  start_time: number
  end_time: number
  completed: boolean
  event_type: string
  project_id: string | null
  category_id: string | null
  duration_hours: number | string
  project: {
    uid: string
    title: string
    not_billable: boolean
  } | null
  category: {
    uid: string
    name: string
    color: string
  } | null
  user: {
    nominative: string
    email: string
  }
}

interface ApiResponse {
  entries: TimeEntry[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
}

interface Filters {
  userId?: string
  projectId?: string
  categoryId?: string
  completed?: boolean
  startDate?: string
  endDate?: string
  searchText?: string
}

const formatDateTime = (timestamp: number): string => {
  try {
    // Debug logging
    console.log('Formatting timestamp:', timestamp, 'type:', typeof timestamp)
    
    // Handle various timestamp formats
    if (!timestamp || timestamp === null || timestamp === undefined) {
      console.log('Timestamp is null/undefined')
      return 'No Date'
    }
    
    // Convert to number if it's a string
    const numTimestamp = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp
    
    // Check if it's in seconds (< year 2000 in milliseconds)
    const msTimestamp = numTimestamp < 946684800000 ? numTimestamp * 1000 : numTimestamp
    
    const date = new Date(msTimestamp)
    
    if (!isValid(date)) {
      console.log('Date is invalid:', date, 'from timestamp:', msTimestamp)
      return 'Invalid Date'
    }
    
    return format(date, 'dd/MM/yyyy HH:mm')
  } catch (error) {
    console.error('Date formatting error:', error, timestamp)
    return 'Format Error'
  }
}

const formatHours = (hours: number | string): string => {
  const numHours = typeof hours === 'string' ? parseFloat(hours) : hours
  if (!numHours || isNaN(numHours)) return '0h 0m'
  const h = Math.floor(numHours)
  const m = Math.round((numHours - h) * 60)
  return `${h}h ${m}m`
}

export default function TimeEntriesAdmin() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  
  // Sorting
  const [sortBy, setSortBy] = useState('start_time')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC')
  
  // Filters
  const [filters, setFilters] = useState<Filters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [searchText, setSearchText] = useState('')
  
  // Date filters
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  
  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Delete confirmation
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchTimeEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/db/time-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: currentPage,
          pageSize,
          sortBy,
          sortOrder,
          filters: {
            ...filters,
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
            searchText: searchText.trim() || undefined,
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch time entries')
      }

      const data: ApiResponse = await response.json()
      setTimeEntries(data.entries)
      setTotalPages(data.totalPages)
      setTotalCount(data.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, sortBy, sortOrder, filters, startDate, endDate, searchText])

  useEffect(() => {
    fetchTimeEntries()
  }, [fetchTimeEntries])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(column)
      setSortOrder('DESC')
    }
    setCurrentPage(0)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
  }

  const clearFilters = () => {
    setFilters({})
    setStartDate(undefined)
    setEndDate(undefined)
    setSearchText('')
    setCurrentPage(0)
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
    setCurrentPage(0)
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4" />
    return sortOrder === 'ASC' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const openDetailModal = (entry: TimeEntry) => {
    setSelectedEntry(entry)
    setShowDetailModal(true)
  }

  const closeDetailModal = () => {
    setSelectedEntry(null)
    setShowDetailModal(false)
  }

  const openDeleteDialog = (entry: TimeEntry) => {
    setEntryToDelete(entry)
    setShowDeleteDialog(true)
  }

  const closeDeleteDialog = () => {
    setEntryToDelete(null)
    setShowDeleteDialog(false)
  }

  const handleDelete = async () => {
    if (!entryToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/db/time-entries/${entryToDelete.uid}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete time entry')
      }

      // Refresh the data
      await fetchTimeEntries()
      
      // Close dialog
      closeDeleteDialog()
      
      // Optional: Show success message
      console.log('Time entry deleted successfully')
      
    } catch (error) {
      console.error('Error deleting time entry:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete time entry')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Time Entries Database</h1>
          </div>
          <div className="text-sm text-gray-500">
            {totalCount} total entries
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by user, project, or category..."
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            {(Object.keys(filters).length > 0 || startDate || endDate || searchText) && (
              <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Date Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Select date"}
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : "Select date"}
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

                {/* Completion Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={filters.completed === undefined ? '' : filters.completed.toString()}
                    onChange={(e) => {
                      const value = e.target.value
                      setFilters(prev => ({
                        ...prev,
                        completed: value === '' ? undefined : value === 'true'
                      }))
                      setCurrentPage(0)
                    }}
                  >
                    <option value="">All</option>
                    <option value="true">Confirmed</option>
                    <option value="false">Unconfirmed</option>
                  </select>
                </div>

                {/* Page Size */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Page Size</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(0)
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Table */}
        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('user_nominative')}
                >
                  <div className="flex items-center gap-2">
                    User {getSortIcon('user_nominative')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('start_time')}
                >
                  <div className="flex items-center gap-2">
                    Start Time {getSortIcon('start_time')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('end_time')}
                >
                  <div className="flex items-center gap-2">
                    End Time {getSortIcon('end_time')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('duration_hours')}
                >
                  <div className="flex items-center gap-2">
                    Duration {getSortIcon('duration_hours')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('project_title')}
                >
                  <div className="flex items-center gap-2">
                    Project {getSortIcon('project_title')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('category_name')}
                >
                  <div className="flex items-center gap-2">
                    Category {getSortIcon('category_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100" 
                  onClick={() => handleSort('completed')}
                >
                  <div className="flex items-center gap-2">
                    Status {getSortIcon('completed')}
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : timeEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No time entries found
                  </TableCell>
                </TableRow>
              ) : (
                timeEntries.map((entry) => (
                  <TableRow key={entry.uid} className="hover:bg-gray-50">
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.user.nominative}</div>
                        <div className="text-sm text-gray-500">{entry.user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDateTime(entry.start_time)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDateTime(entry.end_time)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatHours(entry.duration_hours)}</span>
                    </TableCell>
                    <TableCell>
                      {entry.project ? (
                        <div>
                          <div className="font-medium">{entry.project.title}</div>
                          <div className={`text-xs ${entry.project.not_billable ? 'text-orange-600' : 'text-green-600'}`}>
                            {entry.project.not_billable ? 'Non-billable' : 'Billable'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.category ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: entry.category.color }}
                          />
                          <span className="text-sm">{entry.category.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.completed ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-700 text-sm">Confirmed</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-orange-500" />
                            <span className="text-orange-700 text-sm">Unconfirmed</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => openDetailModal(entry)}
                        >
                          View
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(entry)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i
                } else if (currentPage < 3) {
                  pageNum = i
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 5 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum + 1}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Time Entry Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedEntry ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-lg">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Entry ID</label>
                    <p className="font-mono text-sm">{selectedEntry!.uid}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">User ID</label>
                    <p className="font-mono text-sm">{selectedEntry!.user_id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Event Type</label>
                    <p className="text-sm">{selectedEntry!.event_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-sm font-medium">{formatHours(selectedEntry!.duration_hours || 0)}</p>
                  </div>
                </div>
              </Card>

              {/* Time Info */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-lg">Time Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Start Time</label>
                    <p className="text-sm">{formatDateTime(selectedEntry!.start_time)}</p>
                    <p className="text-xs text-gray-400 font-mono">Raw: {selectedEntry!.start_time}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Time</label>
                    <p className="text-sm">{formatDateTime(selectedEntry!.end_time)}</p>
                    <p className="text-xs text-gray-400 font-mono">Raw: {selectedEntry!.end_time}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="flex items-center gap-2">
                      {selectedEntry!.completed ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-700 text-sm">Confirmed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-orange-500" />
                          <span className="text-orange-700 text-sm">Unconfirmed</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration (calculated)</label>
                    <p className="text-sm">{Number(selectedEntry!.duration_hours || 0).toFixed(2)} hours</p>
                  </div>
                </div>
              </Card>

              {/* Raw Data */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-lg">Raw Database Data</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(selectedEntry!, null, 2)}
                  </pre>
                </div>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={closeDetailModal}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          
          {entryToDelete && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 mb-3">
                  <strong>Warning:</strong> This action cannot be undone. The time entry will be permanently deleted from the database.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entry ID:</span>
                    <span className="font-mono">{entryToDelete.uid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">User:</span>
                    <span>{entryToDelete.user.nominative}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span>{formatHours(entryToDelete.duration_hours || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Time:</span>
                    <span>{formatDateTime(entryToDelete.start_time)}</span>
                  </div>
                  {entryToDelete.project && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Project:</span>
                      <span>{entryToDelete.project.title}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={closeDeleteDialog}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Entry
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 