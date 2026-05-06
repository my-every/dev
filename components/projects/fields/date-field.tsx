'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
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

export interface DateFieldProps extends BaseFieldProps {
    value: Date | undefined
    onChange?: (value: Date | undefined) => void
    placeholder?: string
    description?: string
    /** Format string for date-fns. Defaults to 'MMM d, yyyy'. */
    displayFormat?: string
    /** Disable dates before this date */
    minDate?: Date
}

// ============================================================================
// Component
// ============================================================================

export function DateField({
    mode,
    value,
    onChange,
    label = 'Date',
    placeholder = 'MM/DD/YYYY',
    description,
    displayFormat = 'MMM d, yyyy',
    minDate,
    className,
    disabled,
}: DateFieldProps) {
    const [editOpen, setEditOpen] = useState(false)
    const formatted = value ? format(value, displayFormat) : null
    const shortFormatted = value ? format(value, 'M/d/yyyy') : null

    // ── create ──────────────────────────────────────────────────────────────
    if (mode === 'create') {
        return (
            <div className={cn('space-y-2', className)}>
                <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            className={cn(
                                'w-full justify-start text-left font-normal',
                                !value && 'text-muted-foreground',
                            )}
                        >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {formatted || placeholder}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={value}
                            onSelect={d => onChange?.(d)}
                            initialFocus
                            disabled={minDate ? (date) => date < minDate : undefined}
                        />
                    </PopoverContent>
                </Popover>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        )
    }

    // ── select (card) ───────────────────────────────────────────────────────
    if (mode === 'select') {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{formatted || placeholder}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={d => onChange?.(d)}
                        initialFocus
                        disabled={minDate ? (date) => date < minDate : undefined}
                    />
                </PopoverContent>
            </Popover>
        )
    }

    // ── status (badge) ──────────────────────────────────────────────────────
    if (mode === 'status') {
        return (
            <Badge variant="outline" className={cn('gap-1 text-[10px]', className)}>
                {label}: {shortFormatted || '—'}
            </Badge>
        )
    }

    // ── edit (inline popover) ───────────────────────────────────────────────
    if (mode === 'edit') {
        return (
            <Popover open={editOpen} onOpenChange={setEditOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-xl px-1.5 py-0.5 text-xs transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        {shortFormatted || '—'}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={d => { onChange?.(d); setEditOpen(false) }}
                        initialFocus
                        disabled={minDate ? (date) => date < minDate : undefined}
                    />
                </PopoverContent>
            </Popover>
        )
    }

    // ── list (row) ──────────────────────────────────────────────────────────
    return (
        <div className={cn('flex items-center justify-between gap-2 text-sm', className)}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{formatted || '—'}</span>
        </div>
    )
}
