'use client'

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  Package,
  Plus,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { ProjectUnitRecord } from '@/types/d380-project-details'

// ============================================================================
// Status badge colors
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  GREEN_CHANGE: 'bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300',
  REWORK: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  COMPLETE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ============================================================================
// Props
// ============================================================================

export interface ProjectUnitSwitcherProps {
  /** Project display name */
  projectName: string
  /** PD number */
  pdNumber?: string
  /** Current revision label */
  revision?: string
  /** LWC short label */
  lwcLabel?: string
  /** Due date ISO string */
  dueDate?: string
  /** All units for this project */
  units: ProjectUnitRecord[]
  /** Currently active unit id */
  currentUnitId?: string
  /** Called when a unit is selected */
  onSelectUnit?: (unit: ProjectUnitRecord) => void
  /** Called when "Create Unit" is clicked */
  onCreateUnit?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ProjectUnitSwitcher({
  projectName,
  pdNumber,
  revision,
  lwcLabel,
  dueDate,
  units,
  currentUnitId,
  onSelectUnit,
  onCreateUnit,
}: ProjectUnitSwitcherProps) {
  const [open, setOpen] = useState(false)

  const currentUnit = useMemo(
    () => units.find(u => u.id === currentUnitId),
    [units, currentUnitId],
  )

  const unitLabel = currentUnit
    ? `Unit ${currentUnit.unitNumber}`
    : units.length > 0
      ? `${units.length} unit${units.length !== 1 ? 's' : ''}`
      : null

  return (
    <div className="border-b border-border">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-start gap-3 p-4 text-left',
              'hover:bg-accent/50 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            )}
          >
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {projectName}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                {unitLabel && <span>{unitLabel}</span>}
                {pdNumber && <span>PD#: {pdNumber}</span>}
                {revision && <span>Rev: {revision}</span>}
                {lwcLabel && <span>LWC: {lwcLabel}</span>}
                {dueDate && (
                  <span>
                    Due: {new Date(dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={0}
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          {units.length > 0 ? (
            <ScrollArea className="max-h-64">
              <div className="py-1">
                {units.map(unit => {
                  const isActive = unit.id === currentUnitId
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => {
                        onSelectUnit?.(unit)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left',
                        'hover:bg-accent transition-colors',
                        isActive && 'bg-accent/60',
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                        {unit.unitNumber}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {unit.displayName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {unit.pdNumber && <span>PD#: {unit.pdNumber}</span>}
                          {unit.dueDate && (
                            <span>Due: {new Date(unit.dueDate).toLocaleDateString()}</span>
                          )}
                          <span
                            className={cn(
                              'inline-flex rounded-full px-1.5 py-0.5 font-medium',
                              STATUS_COLORS[unit.status] ?? STATUS_COLORS.PLANNED,
                            )}
                          >
                            {formatStatus(unit.status)}
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No units created yet.
            </div>
          )}

          <Separator />

          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                onCreateUnit?.()
                setOpen(false)
              }}
            >
              <Plus className="h-4 w-4" />
              Create Unit
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
