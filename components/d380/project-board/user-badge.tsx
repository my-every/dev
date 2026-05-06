'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserBadgeProps {
  initials: string
  name: string
  className?: string
}

export function UserBadge({ initials, name, className }: UserBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white px-2 py-1 shadow-sm',
        className
      )}
    >
      <Avatar className="size-5 border border-amber-400 bg-amber-400">
        <AvatarFallback className="bg-amber-400 text-[9px] font-bold text-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-[11px] font-medium text-foreground/80">{name}</span>
    </div>
  )
}
