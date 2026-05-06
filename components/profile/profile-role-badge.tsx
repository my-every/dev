'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/types/profile'
import { ROLE_DISPLAY_CONFIG } from '@/types/profile'

// ============================================================================
// PROFILE ROLE BADGE
// ============================================================================

interface ProfileRoleBadgeProps {
  role: UserRole
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProfileRoleBadge({ role, size = 'md', className }: ProfileRoleBadgeProps) {
  const config = ROLE_DISPLAY_CONFIG[role]

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold',
        config.bgColor,
        config.borderColor,
        config.color,
        size === 'sm' && 'px-2 py-0 text-[10px]',
        size === 'md' && 'px-2.5 py-0.5 text-xs',
        size === 'lg' && 'px-3 py-1 text-sm',
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
