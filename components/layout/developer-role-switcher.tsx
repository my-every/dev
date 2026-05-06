'use client'

import { useRouter } from 'next/navigation'
import { Code, RotateCcw, Users, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/hooks/use-session'
import type { UserRole } from '@/types/d380-user-session'
import { USER_ROLE_LABELS } from '@/types/d380-user-session'

// ============================================================================
// Role Configuration — only roles that have a distinct workspace view
// ============================================================================

const ROLE_CONFIG: Record<
  UserRole,
  { icon: React.ComponentType<{ className?: string }>; description: string; color: string }
> = {
  DEVELOPER: {
    icon: Code,
    description: 'Full system access',
    color: 'text-violet-500',
  },
  MANAGER: {
    icon: Code,
    description: 'Full department oversight',
    color: 'text-blue-500',
  },
  SUPERVISOR: {
    icon: Code,
    description: 'Shift operations',
    color: 'text-cyan-500',
  },
  TEAM_LEAD: {
    icon: Users,
    description: 'Team assignments',
    color: 'text-emerald-500',
  },
  QA: {
    icon: Code,
    description: 'Quality verification',
    color: 'text-amber-500',
  },
  BRANDER: {
    icon: Code,
    description: 'Labeling & marking',
    color: 'text-orange-500',
  },
  ASSEMBLER: {
    icon: Wrench,
    description: 'Wiring & assembly',
    color: 'text-rose-500',
  },
}

/**
 * The only roles available for workspace preview switching.
 * QA, Supervisor, Manager, and Brander workspaces are removed.
 */
const SWITCHABLE_ROLES: UserRole[] = ['DEVELOPER', 'TEAM_LEAD', 'ASSEMBLER']

// ============================================================================
// DeveloperRoleSwitcherSection
//
// Renders directly inside another popover/dropdown — no nested Popover,
// no trigger button of its own.
// ============================================================================

interface DeveloperRoleSwitcherSectionProps {
  className?: string
}

export function DeveloperRoleSwitcherSection({
  className,
}: DeveloperRoleSwitcherSectionProps) {
  const router = useRouter()
  const { user, canSwitchRoles, switchRole, originalRole } = useSession()

  if (!canSwitchRoles || !user) return null

  const currentRole = user.role
  const baseRole = originalRole ?? currentRole
  const isRoleSwitched = originalRole !== null

  const handleRoleSwitch = async (targetRole: UserRole) => {
    await switchRole(targetRole)
    router.refresh()
  }

  const handleReset = async () => {
    if (originalRole) {
      await switchRole(originalRole)
      router.refresh()
    }
  }

  return (
    <div className={cn('border-t border-border', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Developer Workspace
        </span>
        {isRoleSwitched && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset
          </button>
        )}
      </div>

      {/* Role list */}
      <div className="space-y-0.5 px-1.5 pb-1.5">
        {SWITCHABLE_ROLES.map((role) => {
          const roleConfig = ROLE_CONFIG[role]
          const RoleIcon = roleConfig.icon
          const isActive = role === currentRole
          const isOriginal = role === baseRole && isRoleSwitched

          return (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleSwitch(role)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors',
                isActive ? 'bg-primary/10 text-foreground' : 'hover:bg-accent',
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  isActive ? 'bg-primary/20' : 'bg-muted',
                )}
              >
                <RoleIcon className={cn('h-3.5 w-3.5', roleConfig.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {USER_ROLE_LABELS[role]}
                  </span>
                  {isOriginal && (
                    <Badge
                      variant="outline"
                      className="rounded-full px-1.5 py-0 text-[9px]"
                    >
                      Original
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {roleConfig.description}
                </span>
              </div>
              {isActive && (
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      {isRoleSwitched && (
        <p className="px-3 pb-2 text-[10px] text-muted-foreground">
          Previewing as {USER_ROLE_LABELS[currentRole]}. Your actual permissions are unchanged.
        </p>
      )}
    </div>
  )
}
