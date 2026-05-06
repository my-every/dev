'use client'

import { useState, useMemo } from 'react'
import { GitBranch, FileText, Layout, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { BaseFieldProps } from './types'
import type { FileRevision } from '@/lib/revision/types'

// ============================================================================
// Props
// ============================================================================

export interface RevisionFieldProps extends BaseFieldProps {
    value: string
    onChange?: (value: string) => void
    /** Uploaded wire-list revisions available in the revision sidebar */
    wireListRevisions?: FileRevision[]
    /** Uploaded layout revisions available in the revision sidebar */
    layoutRevisions?: FileRevision[]
    /** Placeholder for the text input */
    placeholder?: string
    /** Extracted WL revision hint (shown below input) */
    extractedWl?: string
    /** Extracted LAY revision hint (shown below input) */
    extractedLay?: string
    description?: string
}

// ============================================================================
// Helpers
// ============================================================================

interface UploadedRevisionItem {
    displayVersion: string
    revision: string
    category: string
}

function useUploadedRevisions(
    wireListRevisions: FileRevision[],
    layoutRevisions: FileRevision[],
) {
    return useMemo(() => {
        const seen = new Set<string>()
        const items: UploadedRevisionItem[] = []
        for (const rev of wireListRevisions) {
            const key = rev.revisionInfo.displayVersion
            if (!seen.has(key)) {
                seen.add(key)
                items.push({
                    displayVersion: key,
                    revision: rev.revisionInfo.revision,
                    category: 'WIRE_LIST',
                })
            }
        }
        for (const rev of layoutRevisions) {
            const key = rev.revisionInfo.displayVersion
            if (!seen.has(key)) {
                seen.add(key)
                items.push({
                    displayVersion: key,
                    revision: rev.revisionInfo.revision,
                    category: 'LAYOUT',
                })
            }
        }
        return items.sort((a, b) => {
            const aRev = wireListRevisions.find(r => r.revisionInfo.displayVersion === a.displayVersion)
                ?? layoutRevisions.find(r => r.revisionInfo.displayVersion === a.displayVersion)
            const bRev = wireListRevisions.find(r => r.revisionInfo.displayVersion === b.displayVersion)
                ?? layoutRevisions.find(r => r.revisionInfo.displayVersion === b.displayVersion)
            return (bRev?.revisionInfo.sortScore ?? 0) - (aRev?.revisionInfo.sortScore ?? 0)
        })
    }, [wireListRevisions, layoutRevisions])
}

/** Shared button for an uploaded revision item. */
function UploadedRevisionButton({
    item,
    isSelected,
    onClick,
    compact = false,
}: {
    item: UploadedRevisionItem
    isSelected: boolean
    onClick: () => void
    compact?: boolean
}) {
    const Icon = item.category === 'WIRE_LIST' ? FileText : Layout
    if (compact) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent',
                    isSelected && 'bg-accent',
                )}
            >
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{item.displayVersion}</span>
                {isSelected && <Check className="ml-auto h-3 w-3 text-primary" />}
            </button>
        )
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-accent',
            )}
        >
            <Icon className="h-3 w-3 text-muted-foreground" />
            {item.displayVersion}
        </button>
    )
}

// ============================================================================
// Component
// ============================================================================

export function RevisionField({
    mode,
    value,
    onChange,
    wireListRevisions = [],
    layoutRevisions = [],
    label = 'Revision',
    placeholder = 'e.g. A.2',
    extractedWl,
    extractedLay,
    description,
    className,
    disabled,
}: RevisionFieldProps) {
    const [editOpen, setEditOpen] = useState(false)
    const [selectOpen, setSelectOpen] = useState(false)

    const uploadedRevisions = useUploadedRevisions(wireListRevisions, layoutRevisions)
    const hasUploaded = uploadedRevisions.length > 0

    // ── create ──────────────────────────────────────────────────────────────
    if (mode === 'create') {
        return (
            <div className={cn('space-y-2', className)}>
                <Label className="text-xs font-medium text-muted-foreground">{label}</Label>

                {/* Text input — always shown as the primary entry method */}
                <Input
                    value={value}
                    onChange={e => onChange?.(e.target.value.toUpperCase())}
                    placeholder={placeholder}
                    maxLength={20}
                    disabled={disabled}
                    className="h-9 font-mono uppercase text-sm tracking-wider"
                />

                {/* Uploaded revision quick-select cards */}
                {hasUploaded && (
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Available Revisions
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {uploadedRevisions.map(ur => (
                                <UploadedRevisionButton
                                    key={ur.displayVersion}
                                    item={ur}
                                    isSelected={value === ur.revision}
                                    onClick={() => onChange?.(ur.revision)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Extracted revision hints */}
                {(extractedWl || extractedLay) && (
                    <div className="flex flex-col gap-0.5">
                        {extractedWl && (
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium">WL:</span> {extractedWl}
                            </p>
                        )}
                        {extractedLay && (
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium">LAY:</span> {extractedLay}
                            </p>
                        )}
                    </div>
                )}

                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        )
    }

    // ── select (choice card) ────────────────────────────────────────────────
    if (mode === 'select') {
        return (
            <Popover open={selectOpen} onOpenChange={setSelectOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{value || '—'}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="start">
                    {hasUploaded ? (
                        <ScrollArea className="max-h-48">
                            <div className="p-2">
                                <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Available Revisions
                                </p>
                                {uploadedRevisions.map(ur => (
                                    <UploadedRevisionButton
                                        key={ur.displayVersion}
                                        item={ur}
                                        isSelected={value === ur.revision}
                                        onClick={() => { onChange?.(ur.revision); setSelectOpen(false) }}
                                        compact
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                            No revisions uploaded yet
                        </div>
                    )}
                    <Separator />
                    <div className="p-2">
                        <Input
                            value={value}
                            onChange={e => onChange?.(e.target.value.toUpperCase())}
                            placeholder={placeholder}
                            maxLength={20}
                            className="h-7 font-mono uppercase text-xs tracking-wider"
                            onKeyDown={e => e.key === 'Enter' && setSelectOpen(false)}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        )
    }

    // ── status (badge) ──────────────────────────────────────────────────────
    if (mode === 'status') {
        return (
            <Badge variant="outline" className={cn('gap-1 text-[10px]', className)}>
                Rev {value}
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
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent',
                            className,
                        )}
                    >
                        <GitBranch className="h-3 w-3 text-muted-foreground" />
                        {value || '—'}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="start">
                    <div className="p-2">
                        <Input
                            value={value}
                            onChange={e => onChange?.(e.target.value.toUpperCase())}
                            placeholder={placeholder}
                            maxLength={20}
                            className="h-7 font-mono uppercase text-xs tracking-wider"
                            onKeyDown={e => e.key === 'Enter' && setEditOpen(false)}
                        />
                    </div>
                    {hasUploaded && (
                        <>
                            <Separator />
                            <ScrollArea className="max-h-36">
                                <div className="p-2">
                                    <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                        Available Revisions
                                    </p>
                                    {uploadedRevisions.map(ur => (
                                        <UploadedRevisionButton
                                            key={ur.displayVersion}
                                            item={ur}
                                            isSelected={value === ur.revision}
                                            onClick={() => { onChange?.(ur.revision); setEditOpen(false) }}
                                            compact
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </PopoverContent>
            </Popover>
        )
    }

    // ── list (row) ──────────────────────────────────────────────────────────
    return (
        <div className={cn('flex items-center justify-between gap-2 text-sm', className)}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value || '—'}</span>
        </div>
    )
}
