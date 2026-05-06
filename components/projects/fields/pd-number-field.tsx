'use client'

import { useState } from 'react'
import { Hash } from 'lucide-react'
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

export interface PdNumberFieldProps extends BaseFieldProps {
    value: string
    onChange?: (value: string) => void
    placeholder?: string
    description?: string
    required?: boolean
    error?: string | null
}

// ============================================================================
// Component
// ============================================================================

export function PdNumberField({
    mode,
    value,
    onChange,
    label = 'PD Number',
    placeholder = '4M093',
    description,
    required,
    error,
    className,
    disabled,
}: PdNumberFieldProps) {
    const [editOpen, setEditOpen] = useState(false)

    // ── create ──────────────────────────────────────────────────────────────
    if (mode === 'create') {
        return (
            <div className={cn('space-y-2', className)}>
                <Label className="text-xs font-medium text-muted-foreground">
                    {label} {required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                    value={value}
                    onChange={e => onChange?.(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder={placeholder}
                    maxLength={12}
                    disabled={disabled}
                    className={cn(
                        'h-9 font-mono uppercase tracking-wider',
                        error && 'border-destructive focus-visible:ring-destructive',
                    )}
                />
                {error ? (
                    <p className="text-xs text-destructive">{error}</p>
                ) : description ? (
                    <p className="text-xs text-muted-foreground">{description}</p>
                ) : null}
            </div>
        )
    }

    // ── select (card variant) ───────────────────────────────────────────────
    if (mode === 'select') {
        return (
            <button
                type="button"
                onClick={() => onChange?.(value)}
                disabled={disabled}
                className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent',
                    className,
                )}
            >
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-sm font-semibold uppercase tracking-wider">
                    {value || placeholder}
                </span>
            </button>
        )
    }

    // ── status (badge) ──────────────────────────────────────────────────────
    if (mode === 'status') {
        return (
            <Badge variant="outline" className={cn('gap-1 text-[10px] font-mono', className)}>
                PD#: {value}
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
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        {value || '—'}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" align="start">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                        value={value}
                        onChange={e => onChange?.(e.target.value)}
                        placeholder={placeholder}
                        maxLength={12}
                        className="mt-1.5 h-8 font-mono uppercase text-xs tracking-wider"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && setEditOpen(false)}
                    />
                </PopoverContent>
            </Popover>
        )
    }

    // ── list (row) ──────────────────────────────────────────────────────────
    return (
        <div className={cn('flex items-center justify-between gap-2 text-sm', className)}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono font-medium uppercase tracking-wider">{value || '—'}</span>
        </div>
    )
}
