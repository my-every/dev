'use client'

import { useState, useCallback } from 'react'
import {
  Shield,
  UserCog,
  Users,
  ClipboardCheck,
  Tag,
  Wrench,
  Code,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/d380-user-session'
import { USER_ROLE_LABELS } from '@/types/d380-user-session'

// ============================================================================
// Types
// ============================================================================

interface RoleOption {
  role: UserRole
  icon: React.ComponentType<{ className?: string }>
  description: string
}

interface RoleChoiceBoxProps {
  /** Currently selected role */
  value?: UserRole | null
  /** Callback when a role is selected */
  onChange?: (role: UserRole) => void
  /** Optional className for the container */
  className?: string
  /** Disabled state */
  disabled?: boolean
  /** Size variant */
  size?: 'default' | 'compact'
  /** Layout orientation */
  layout?: 'horizontal' | 'grid'
  /** Filter to show only specific roles */
  roles?: UserRole[]
}

// ============================================================================
// Role Configuration - Unified Color Scheme
// ============================================================================

const ALL_ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'DEVELOPER',
    icon: Code,
    description: 'Full system access',
  },
  {
    role: 'MANAGER',
    icon: Shield,
    description: 'Full department oversight',
  },
  {
    role: 'SUPERVISOR',
    icon: UserCog,
    description: 'Shift operations',
  },
  {
    role: 'TEAM_LEAD',
    icon: Users,
    description: 'Team assignments',
  },
  {
    role: 'QA',
    icon: ClipboardCheck,
    description: 'Quality verification',
  },
  {
    role: 'BRANDER',
    icon: Tag,
    description: 'Labeling & marking',
  },
  {
    role: 'ASSEMBLER',
    icon: Wrench,
    description: 'Wiring & assembly',
  },
]

// ============================================================================
// RoleChoiceBox Component
// ============================================================================

export function RoleChoiceBox({
  value,
  onChange,
  className,
  disabled = false,
  size = 'default',
  layout = 'horizontal',
  roles,
}: RoleChoiceBoxProps) {
  const handleSelect = useCallback(
    (role: UserRole) => {
      if (!disabled && onChange) {
        onChange(role)
      }
    },
    [disabled, onChange]
  )

  // Filter roles if specified
  const roleOptions = roles
    ? ALL_ROLE_OPTIONS.filter((opt) => roles.includes(opt.role))
    : ALL_ROLE_OPTIONS

  return (
    <div
      className={cn(
        'w-full',
        layout === 'grid'
          ? cn('grid gap-2', size === 'compact' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')
          : cn('flex', size === 'compact' ? 'gap-2' : 'gap-3', 'flex-col sm:flex-row'),
        className
      )}
      role="radiogroup"
      aria-label="Select your role"
    >
      {roleOptions.map((option) => {
        const isSelected = value === option.role
        const Icon = option.icon

        return (
          <button
            key={option.role}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => handleSelect(option.role)}
            className={cn(
              // Base styles
              'group relative flex flex-1 items-center gap-3 rounded-lg border-2 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              // Size variants
              size === 'compact' ? 'p-3' : 'p-4',
              // Selected state - unified color
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-primary/[0.02]',
              // Disabled state
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {/* Icon container */}
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-md transition-colors',
                size === 'compact' ? 'h-9 w-9' : 'h-10 w-10',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
              )}
            >
              <Icon className={cn(size === 'compact' ? 'h-4 w-4' : 'h-5 w-5')} />
            </div>

            {/* Text content */}
            <div className="flex-1 text-left">
              <p
                className={cn(
                  'font-semibold transition-colors',
                  size === 'compact' ? 'text-sm' : 'text-base',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}
              >
                {USER_ROLE_LABELS[option.role]}
              </p>
              <p
                className={cn(
                  'text-muted-foreground',
                  size === 'compact' ? 'text-xs' : 'text-sm'
                )}
              >
                {option.description}
              </p>
            </div>

            {/* Selection indicator */}
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full border-2 transition-all',
                size === 'compact' ? 'h-5 w-5' : 'h-6 w-6',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30 bg-transparent'
              )}
            >
              {isSelected && (
                <Check
                  className={cn(size === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5')}
                  strokeWidth={3}
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Controlled RoleChoiceBox Demo
// ============================================================================

export function RoleChoiceBoxDemo() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  return (
    <div className="w-full max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Select Your Role</h3>
        <p className="text-sm text-muted-foreground">
          Choose the role that best describes your position to continue.
        </p>
      </div>

      <RoleChoiceBox value={selectedRole} onChange={setSelectedRole} />

      {selectedRole && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            Selected:{' '}
            <span className="font-semibold text-primary">
              {USER_ROLE_LABELS[selectedRole]}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
