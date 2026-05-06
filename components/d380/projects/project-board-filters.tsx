'use client'

import { Filter, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProjectsBoardFilterState, ProjectsBoardOption } from '@/types/d380-projects-board'

interface ProjectBoardFiltersProps {
  filters: ProjectsBoardFilterState
  shiftOptions: ProjectsBoardOption[]
  riskOptions: ProjectsBoardOption[]
  lifecycleOptions: ProjectsBoardOption[]
  onFilterChange: <K extends keyof ProjectsBoardFilterState>(key: K, value: ProjectsBoardFilterState[K]) => void
  onReset: () => void
}

export function ProjectBoardFilters({
  filters,
  shiftOptions,
  riskOptions,
  lifecycleOptions,
  onFilterChange,
  onReset,
}: ProjectBoardFiltersProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
      <Select value={filters.shift} onValueChange={value => onFilterChange('shift', value as ProjectsBoardFilterState['shift'])}>
        <SelectTrigger className="h-11 w-full rounded-full border-border bg-background px-4 text-foreground">
          <SelectValue placeholder="Shift" />
        </SelectTrigger>
        <SelectContent>
          {shiftOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.risk} onValueChange={value => onFilterChange('risk', value as ProjectsBoardFilterState['risk'])}>
        <SelectTrigger className="h-11 w-full rounded-full border-border bg-background px-4 text-foreground">
          <SelectValue placeholder="Risk" />
        </SelectTrigger>
        <SelectContent>
          {riskOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.lifecycle} onValueChange={value => onFilterChange('lifecycle', value as ProjectsBoardFilterState['lifecycle'])}>
        <SelectTrigger className="h-11 w-full rounded-full border-border bg-background px-4 text-foreground">
          <SelectValue placeholder="Lifecycle" />
        </SelectTrigger>
        <SelectContent>
          {lifecycleOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant={filters.lateOnly ? 'default' : 'outline'}
        onClick={() => onFilterChange('lateOnly', !filters.lateOnly)}
        className="h-11 rounded-full px-5"
      >
        <Filter className="size-4" />
        Late only
      </Button>

      <Button type="button" variant="ghost" onClick={onReset} className="h-11 rounded-full px-4 text-foreground/68 hover:bg-muted hover:text-foreground">
        <RotateCcw className="size-4" />
        Reset
      </Button>
    </div>
  )
}