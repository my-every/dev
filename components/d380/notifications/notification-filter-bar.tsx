'use client'

import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { NotificationFilterState, NotificationProjectOption, NotificationTypeOption } from '@/types/d380-notifications'

export function NotificationFilterBar({
  filters,
  projectOptions,
  typeOptions,
  onSearchTextChange,
  onProjectChange,
  onTypeChange,
  onUnreadOnlyChange,
  onReset,
}: {
  filters: NotificationFilterState
  projectOptions: NotificationProjectOption[]
  typeOptions: NotificationTypeOption[]
  onSearchTextChange: (value: string) => void
  onProjectChange: (value: string) => void
  onTypeChange: (value: NotificationFilterState['type']) => void
  onUnreadOnlyChange: (value: boolean) => void
  onReset: () => void
}) {
  return (
    <div className="grid gap-3 rounded-[28px] border border-border/70 bg-card/78 p-5 shadow-[0_18px_80px_rgba(0,0,0,0.1)] backdrop-blur-sm xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,1.15fr)_auto_auto] xl:items-center">
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/45">Search</div>
        <Input
          value={filters.searchText}
          onChange={event => onSearchTextChange(event.target.value)}
          placeholder="Search message, sheet name, or PD number"
          className="h-11 rounded-2xl border-border bg-background px-4 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/45">Project</div>
        <Select value={filters.projectId} onValueChange={onProjectChange}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border bg-background px-4">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            {projectOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/45">Event type</div>
        <Select value={filters.type} onValueChange={value => onTypeChange(value as NotificationFilterState['type'])}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border bg-background px-4">
            <SelectValue placeholder="All event types" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full items-end">
        <label className="flex h-11 w-full min-w-0 items-center justify-between rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground xl:w-auto xl:min-w-52">
          Unread only
          <Switch checked={filters.unreadOnly} onCheckedChange={onUnreadOnlyChange} />
        </label>
      </div>

      <div className="flex h-full items-end justify-end">
        <Button variant="outline" className="h-11 rounded-2xl px-4" onClick={onReset}>
          <RotateCcw className="size-4" />
          Reset filters
        </Button>
      </div>
    </div>
  )
}