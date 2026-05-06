'use client'

import { MessageSquare, UserPlus, History, Settings, Send, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types/profile'

// ============================================================================
// QUICK ACTION CONFIG
// ============================================================================

interface QuickAction {
  id: string
  label: string
  icon: typeof MessageSquare
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  roleVisibility?: UserRole[]
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'message',
    label: 'Message',
    icon: MessageSquare,
    variant: 'default',
  },
  {
    id: 'assign',
    label: 'Assign Work',
    icon: ClipboardList,
    variant: 'outline',
    roleVisibility: ['manager', 'supervisor', 'team_lead'],
  },
  {
    id: 'add-to-team',
    label: 'Add to Team',
    icon: UserPlus,
    variant: 'outline',
    roleVisibility: ['manager', 'supervisor'],
  },
  {
    id: 'view-history',
    label: 'View History',
    icon: History,
    variant: 'ghost',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    variant: 'ghost',
  },
]

// ============================================================================
// PROFILE QUICK ACTIONS COMPONENT
// ============================================================================

interface ProfileQuickActionsProps {
  viewerRole?: UserRole
  onAction?: (actionId: string) => void
  className?: string
}

export function ProfileQuickActions({
  viewerRole,
  onAction,
  className,
}: ProfileQuickActionsProps) {
  const visibleActions = QUICK_ACTIONS.filter((action) => {
    if (!action.roleVisibility) return true
    if (!viewerRole) return false
    return action.roleVisibility.includes(viewerRole)
  })

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {visibleActions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => onAction?.(action.id)}
        >
          <action.icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
      ))}
    </div>
  )
}
