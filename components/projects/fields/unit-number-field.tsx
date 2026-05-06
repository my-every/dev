'use client'

import { useState } from 'react'
import { Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { BaseFieldProps } from './types'

// ============================================================================
// Props
// ============================================================================

export interface UnitNumberFieldProps extends BaseFieldProps {
    value: string
    onChange?: (value: string) => void
    /** When true the field is auto-computed and not user-editable */
    autoIncrement?: boolean
    placeholder?: string
    description?: string
}

// ============================================================================
// Component
// ============================================================================

export function UnitNumberField({
    mode,
    value,
    onChange,
    autoIncrement,
    label = 'Unit Number',
    placeholder = '001',
    description,
    className,
    disabled,
}: UnitNumberFieldProps) {
    const [editOpen, setEditOpen] = useState(false)
    const isReadOnly = autoIncrement || disabled

    // ── create ──────────────────────────────────────────────────────────────
    if (mode === 'create') {
        if (autoIncrement) {
            return (
                <div className={cn('space-y-2', className)}>
                    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                    <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-semibold tabular-nums">
                        {value}
                    </div>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
            )
        }
        return (
            <div className={cn('space-y-2', className)}>
                <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                <Input
                    value={value}
                    onChange={e => onChange?.(e.target.value.toUpperCase())}
                    placeholder={placeholder}
                    maxLength={10}
                    disabled={disabled}
                    className="h-9 font-mono uppercase tracking-wider"
                />
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        )
    }

    // ── select (card) ───────────────────────────────────────────────────────
    if (mode === 'select') {
        return (
            <div
                className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2',
                    className,
                )}
            >
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold tabular-nums">{value}</span>
            </div>
        )
    }

    // ── status ──────────────────────────────────────────────────────────────
    if (mode === 'status') {
        return (
            <Badge variant="outline" className={cn('gap-1 text-[10px] font-semibold tabular-nums', className)}>
                Unit {value}
            </Badge>
        )
    }

    // ── edit ─────────────────────────────────────────────────────────────────
    if (mode === 'edit') {
        if (isReadOnly) {
            return (
                <span className={cn('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', className)}>
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    {value}
                </span>
            )
        }
        return (
            <Popover open={editOpen} onOpenChange={setEditOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        <Layers className="h-3 w-3 text-muted-foreground" />
                        {value}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-36 p-3" align="start">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                        value={value}
                        onChange={e => onChange?.(e.target.value.toUpperCase())}
                        placeholder={placeholder}
                        maxLength={10}
                        className="mt-1.5 h-8 font-mono uppercase text-xs tracking-wider"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && setEditOpen(false)}
                    />
                </PopoverContent>
            </Popover>
        )
    }

    // ── list ─────────────────────────────────────────────────────────────────
    return (
        <div className={cn('flex items-center justify-between gap-2 text-sm', className)}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
        </div>
    )
}
