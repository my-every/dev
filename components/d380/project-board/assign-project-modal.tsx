'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

import { StationBadge } from '@/components/d380/project-board/station-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ProjectBoardWorkAreaKind, ProjectBoardAssignmentViewModel } from '@/types/d380-project-board'

interface AssignProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stationKind: ProjectBoardWorkAreaKind
  stationNumber: number | string
  stationLabel: string
  availableProjects: ProjectBoardAssignmentViewModel[]
  onAssign: (projectId: string) => void
}

export function AssignProjectModal({
  open,
  onOpenChange,
  stationKind,
  stationNumber,
  stationLabel,
  availableProjects,
  onAssign,
}: AssignProjectModalProps) {
  const [search, setSearch] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const filteredProjects = availableProjects.filter(project => {
    const searchLower = search.toLowerCase()
    return (
      project.pdNumber.toLowerCase().includes(searchLower) ||
      project.projectName.toLowerCase().includes(searchLower) ||
      project.sheetName.toLowerCase().includes(searchLower)
    )
  })

  const handleAssign = () => {
    if (selectedProjectId) {
      onAssign(selectedProjectId)
      setSelectedProjectId(null)
      setSearch('')
      onOpenChange(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedProjectId(null)
      setSearch('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <StationBadge kind={stationKind} stationNumber={stationNumber} />
            <span>Assign Project to {stationLabel}</span>
          </DialogTitle>
          <DialogDescription>
            Select a project from the backlog to assign to this work area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PD number, project, or sheet name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Available Projects ({filteredProjects.length})
            </Label>
            <ScrollArea className="mt-2 h-[280px] rounded-lg border">
              {filteredProjects.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {search ? 'No projects match your search.' : 'No available projects in the backlog.'}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredProjects.map(project => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        selectedProjectId === project.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-foreground">
                            {project.sheetName}
                          </div>
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            {project.pdNumber} - {project.projectName}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
                            project.status === 'UNASSIGNED'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {project.statusLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{project.stageLabel}</span>
                        <span>·</span>
                        <span>{project.priorityLabel}</span>
                        <span>·</span>
                        <span>{project.progressPercent}% complete</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedProjectId}>
            Assign to Station
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
