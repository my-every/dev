'use client'

import Image from 'next/image'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    SWS_TYPE_REGISTRY,
    type SwsTypeId,
} from '@/lib/assignment/sws-detection'

// ============================================================================
// Shared icon map — single source of truth
// ============================================================================

export const SWS_ICON_MAP: Record<SwsTypeId, string> = {
    BLANK: '/sws/blank.svg',
    RAIL: '/sws/rail.svg',
    BOX: '/sws/box.svg',
    PANEL: '/sws/panel.svg',
    COMPONENT: '/sws/component.svg',
    UNDECIDED: '/sws/blank.svg',
}

export const ALL_SWS_TYPES: SwsTypeId[] = [
    'BLANK', 'RAIL', 'BOX', 'PANEL', 'COMPONENT', 'UNDECIDED',
]

// ============================================================================
// SwsTypeGrid — consistent 2×3 icon grid for SWS type selection / filtering
// ============================================================================

export interface SwsTypeGridProps {
    /** Currently selected type(s). Pass a single string for single-select, or a Set for multi-select. */
    selected: SwsTypeId | Set<SwsTypeId>
    /** Called when a type is clicked. */
    onSelect: (id: SwsTypeId) => void
    /** Optional subset of types to show. Defaults to all 6. */
    types?: SwsTypeId[]
    /** Compact mode uses smaller cells. Default false. */
    compact?: boolean
    className?: string
}

export function SwsTypeGrid({
    selected,
    onSelect,
    types = ALL_SWS_TYPES,
    compact = false,
    className,
}: SwsTypeGridProps) {
    const isActive = (id: SwsTypeId) =>
        selected instanceof Set ? selected.has(id) : selected === id

    return (
        <div
            className={cn(
                'grid grid-cols-2 gap-1.5',
                compact ? 'w-[140px]' : 'w-[180px]',
                className,
            )}
        >
            {types.map((id) => {
                const meta = SWS_TYPE_REGISTRY[id]
                const active = isActive(id)
                const label = meta.label === 'Undetermined' ? 'Unknown' : meta.label

                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className={cn(
                            'flex flex-col items-center justify-center gap-1 rounded-md border transition-all',
                            compact ? 'px-2 py-1.5' : 'px-3 py-2',
                            active
                                ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-sm'
                                : 'border-border/50 hover:border-primary/40 hover:bg-muted/50',
                        )}
                        title={meta.label}
                    >
                        {id === 'UNDECIDED' ? (
                            <HelpCircle
                                className={cn(
                                    compact ? 'h-5 w-5' : 'h-6 w-6',
                                    active ? 'text-primary' : 'text-muted-foreground/70',
                                )}
                            />
                        ) : (
                            <Image
                                src={SWS_ICON_MAP[id]}
                                alt=""
                                width={compact ? 20 : 24}
                                height={compact ? 20 : 24}
                                className={cn(
                                    'shrink-0 dark:invert',
                                    compact ? 'h-5 w-5' : 'h-6 w-6',
                                    active ? 'opacity-100' : 'opacity-60',
                                )}
                            />
                        )}
                        <span
                            className={cn(
                                'font-medium leading-tight truncate w-full text-center',
                                compact ? 'text-[9px]' : 'text-[10px]',
                                active ? 'text-primary' : 'text-muted-foreground',
                            )}
                        >
                            {label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
