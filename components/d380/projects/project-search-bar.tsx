'use client'

import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProjectSearchBarProps {
  value: string
  onValueChange: (value: string) => void
}

export function ProjectSearchBar({ value, onValueChange }: ProjectSearchBarProps) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
      <Input
        value={value}
        onChange={event => onValueChange(event.target.value)}
        placeholder="Search PD number, project name, member, or lifecycle status"
        className="h-12 rounded-full border-border bg-background pl-11 pr-12 text-foreground shadow-xs"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onValueChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}