'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { LWC_TYPE_REGISTRY, type LwcType, type LwcTypeConfig } from '@/lib/workbook/types'
import type { BaseFieldProps } from './types'

// ============================================================================
// Props
// ============================================================================

export interface LwcTypeFieldProps extends BaseFieldProps {
    value: LwcType | undefined
    onChange?: (value: LwcType) => void
    required?: boolean
    description?: string
    /** Show the description text from the registry under the selector */
    showRegistryDescription?: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────

function DotIndicator({ config, size = 'sm' }: { config: LwcTypeConfig; size?: 'sm' | 'md' }) {
    const s = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5'
    return (
        <span
            className={cn('inline-block rounded-full shrink-0', s)}
            style={{ backgroundColor: config.dotColor }}
        />
    )
}

// ============================================================================
// Component
// ============================================================================

export function LwcTypeField({
    mode,
    value,
    onChange,
    label = 'LWC Type',
    required,
    description,
    showRegistryDescription = true,
    className,
    disabled,
}: LwcTypeFieldProps) {
    const [editOpen, setEditOpen] = useState(false)
    const config = value ? LWC_TYPE_REGISTRY[value] : null

    // ── create ──────────────────────────────────────────────────────────────
    if (mode === 'create') {
        return (
            <div className={cn('space-y-2', className)}>
                <Label className="text-xs font-medium text-muted-foreground">
                    {label} {required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                    value={value ?? ''}
                    onValueChange={v => onChange?.(v as LwcType)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select LWC type" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(LWC_TYPE_REGISTRY).map(cfg => (
                            <SelectItem key={cfg.id} value={cfg.id}>
                                <span className="flex items-center gap-2">
                                    <DotIndicator config={cfg} />
                                    {cfg.label}
                                    <span className="text-xs text-muted-foreground">
                                        ({cfg.shortLabel})
                                    </span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {showRegistryDescription && config && (
                    <p className="text-[10px] text-muted-foreground">{config.description}</p>
                )}
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
        )
    }

    // ── select (card grid) ──────────────────────────────────────────────────
    if (mode === 'select') {
        return (
            <div className={cn('space-y-2', className)}>
                {label && (
                    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.values(LWC_TYPE_REGISTRY).map(cfg => {
                        const isActive = value === cfg.id
                        return (
                            <button
                                key={cfg.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => onChange?.(cfg.id)}
                                className={cn(
                                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                                    isActive
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                        : 'border-border hover:bg-accent',
                                )}
                            >
                                <span className="flex w-full items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm font-semibold">
                                        <DotIndicator config={cfg} size="md" />
                                        {cfg.shortLabel}
                                    </span>
                                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                                </span>
                                <span className="text-[10px] text-muted-foreground leading-tight">
                                    {cfg.label}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    // ── status (badge) ──────────────────────────────────────────────────────
    if (mode === 'status') {
        if (!config) {
            return (
                <Badge variant="outline" className={cn('text-[10px]', className)}>
                    LWC: —
                </Badge>
            )
        }
        return (
            <Badge variant="outline" className={cn('gap-1 text-[10px]', className)}>
                <DotIndicator config={config} />
                {config.shortLabel}
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
                            'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        {config ? (
                            <>
                                <DotIndicator config={config} />
                                {config.shortLabel}
                            </>
                        ) : (
                            <span className="text-muted-foreground">LWC</span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="start">
                    {Object.values(LWC_TYPE_REGISTRY).map(cfg => {
                        const isActive = value === cfg.id
                        return (
                            <button
                                key={cfg.id}
                                type="button"
                                onClick={() => { onChange?.(cfg.id); setEditOpen(false) }}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent',
                                    isActive && 'bg-accent',
                                )}
                            >
                                <DotIndicator config={cfg} />
                                <span className="font-medium">{cfg.label}</span>
                                <span className="ml-auto text-muted-foreground">{cfg.shortLabel}</span>
                                {isActive && <Check className="h-3 w-3 text-primary" />}
                            </button>
                        )
                    })}
                </PopoverContent>
            </Popover>
        )
    }

    // ── list (row) ──────────────────────────────────────────────────────────
    return (
        <div className={cn('flex items-center justify-between gap-2 text-sm', className)}>
            <span className="text-muted-foreground">{label}</span>
            {config ? (
                <span className="flex items-center gap-1.5 font-medium">
                    <DotIndicator config={config} />
                    {config.label}
                </span>
            ) : (
                <span className="text-muted-foreground">—</span>
            )}
        </div>
    )
}
