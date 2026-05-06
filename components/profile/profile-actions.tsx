'use client'

import * as React from 'react'
import { UserPlus, MessageSquare, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import AnimatedTooltip from '@/components/ui/animated-tooltip'

// ============================================================================
// Types
// ============================================================================

export interface ProfileAction {
    /** Unique key for the action */
    id: 'assign' | 'message' | 'delete' | (string & {})
    /** Button label (used in tooltip and as visible text in expanded mode) */
    label: string
    /** Lucide icon component */
    icon: React.ElementType
    /** Click handler */
    onClick?: () => void
    /** Visual variant */
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
    /** Whether this action is disabled */
    disabled?: boolean
    /** Whether this action is currently loading */
    loading?: boolean
}

export interface ProfileActionsProps {
    /** Actions to render — order is preserved */
    actions: ProfileAction[]
    /** Render mode: icon-only buttons or icon+label */
    mode?: 'icon' | 'expanded'
    /** Size of the buttons */
    size?: 'sm' | 'default'
    /** Extra class names on the wrapper */
    className?: string
}

// ============================================================================
// Preset actions (convenience helpers)
// ============================================================================

export function createAssignAction(onClick?: () => void, disabled?: boolean): ProfileAction {
    return { id: 'assign', label: 'Assign', icon: UserPlus, onClick, variant: 'outline', disabled }
}

export function createMessageAction(onClick?: () => void, disabled?: boolean): ProfileAction {
    return { id: 'message', label: 'Message', icon: MessageSquare, onClick, variant: 'outline', disabled }
}

export function createDeleteAction(onClick?: () => void, disabled?: boolean): ProfileAction {
    return { id: 'delete', label: 'Delete', icon: Trash2, onClick, variant: 'destructive', disabled }
}

// ============================================================================
// Component
// ============================================================================

export function ProfileActions({
    actions,
    mode = 'icon',
    size = 'sm',
    className,
}: ProfileActionsProps) {
    if (actions.length === 0) return null

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            {actions.map((action) => {
                const Icon = action.icon
                const btn = (
                    <Button
                        key={action.id}
                        variant={action.variant ?? 'outline'}
                        size={mode === 'icon' ? 'icon' : size}
                        disabled={action.disabled || action.loading}
                        onClick={action.onClick}
                        className={cn(
                            'rounded-full',
                            mode === 'icon' && size === 'sm' && 'h-8 w-8',
                            mode === 'expanded' && 'gap-1.5',
                        )}
                    >
                        <Icon className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                        {mode === 'expanded' && (
                            <span className="hidden sm:inline">{action.label}</span>
                        )}
                    </Button>
                )

                if (mode === 'icon') {
                    return (
                        <AnimatedTooltip key={action.id} content={action.label} placement="bottom">
                            {btn}
                        </AnimatedTooltip>
                    )
                }

                return btn
            })}
        </div>
    )
}
