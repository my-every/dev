"use client"

/**
 * Revision Comparison Modal
 * 
 * A full-screen modal that shows side-by-side comparison of wire lists
 * between two revisions. Left side shows previous revision, right side
 * shows current revision with highlighted differences.
 */

import { useMemo } from "react"
import {
  ArrowLeftRight,
  Plus,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { 
  FileRevision, 
  WireRowDiff,
} from "@/lib/revision/types"
import type { SemanticWireListRow } from "@/lib/workbook/types"

// ============================================================================
// Props
// ============================================================================

interface RevisionComparisonModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void
  /** Source revision (previous) */
  sourceRevision: FileRevision | null
  /** Target revision (current) */
  targetRevision: FileRevision | null
  /** Source rows for comparison */
  sourceRows?: SemanticWireListRow[]
  /** Target rows for comparison */
  targetRows?: SemanticWireListRow[]
  /** Sheet name */
  sheetName?: string
  /** Loading state */
  isLoading?: boolean
}

// ============================================================================
// Comparison Logic
// ============================================================================

function computeRowDiffs(
  sourceRows: SemanticWireListRow[],
  targetRows: SemanticWireListRow[]
): WireRowDiff[] {
  const diffs: WireRowDiff[] = []
  
  // Create maps keyed by a composite key (fromDeviceId + wireNo + toDeviceId)
  const createRowKey = (row: SemanticWireListRow) => 
    `${row.fromDeviceId || ''}|${row.wireNo || ''}|${row.toDeviceId || ''}`
  
  const sourceMap = new Map(sourceRows.map(r => [createRowKey(r), r]))
  const targetMap = new Map(targetRows.map(r => [createRowKey(r), r]))
  
  // Find removed rows (in source but not in target)
  for (const [key, sourceRow] of sourceMap) {
    if (!targetMap.has(key)) {
      diffs.push({
        sourceRowId: sourceRow.__rowId,
        changeType: 'removed',
        sourceRow: sourceRow as unknown as Record<string, unknown>,
      })
    }
  }
  
  // Find added rows (in target but not in source)
  for (const [key, targetRow] of targetMap) {
    if (!sourceMap.has(key)) {
      diffs.push({
        targetRowId: targetRow.__rowId,
        changeType: 'added',
        targetRow: targetRow as unknown as Record<string, unknown>,
      })
    }
  }
  
  return diffs
}

// ============================================================================
// Helper Components
// ============================================================================

const CHANGE_TYPE_STYLES: Record<'added' | 'removed', { bg: string; text: string; icon: React.ReactNode }> = {
  added: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-400',
    icon: <Plus className="h-3.5 w-3.5" />,
  },
  removed: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    icon: <Minus className="h-3.5 w-3.5" />,
  },
}

function DiffRow({ diff }: { diff: WireRowDiff }) {
  const row = diff.changeType === 'removed' ? diff.sourceRow : diff.targetRow
  const style = CHANGE_TYPE_STYLES[diff.changeType as 'added' | 'removed']
  
  if (!row || !style) return null
  
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 text-xs border-b border-border/50", style.bg)}>
      {/* Change indicator */}
      <div className={cn("flex-shrink-0", style.text)}>
        {style.icon}
      </div>
      
      {/* From Device */}
      <div className="w-24 font-mono truncate">
        {row.fromDeviceId as string || '-'}
      </div>
      
      {/* Wire No */}
      <div className="w-20 font-mono truncate">
        {row.wireNo as string || '-'}
      </div>
      
      {/* Gauge */}
      <div className="w-12 truncate">
        {row.gaugeSize as string || '-'}
      </div>
      
      {/* Color */}
      <div className="w-16 truncate">
        {row.wireId as string || '-'}
      </div>
      
      {/* To Device */}
      <div className="w-24 font-mono truncate">
        {row.toDeviceId as string || '-'}
      </div>
      
      {/* Location */}
      <div className="flex-1 truncate">
        {row.fromLocation as string || row.toLocation as string || '-'}
      </div>
    </div>
  )
}

function SummaryBadges({ diffs }: { diffs: WireRowDiff[] }) {
  const counts = useMemo(() => {
    return {
      added: diffs.filter(d => d.changeType === 'added').length,
      removed: diffs.filter(d => d.changeType === 'removed').length,
    }
  }, [diffs])
  
  return (
    <div className="flex items-center gap-2">
      {counts.added > 0 && (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
          <Plus className="h-3 w-3" />
          {counts.added} added
        </Badge>
      )}
      {counts.removed > 0 && (
        <Badge variant="outline" className="gap-1 text-red-600 border-red-600/30">
          <Minus className="h-3 w-3" />
          {counts.removed} removed
        </Badge>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function RevisionComparisonModal({
  open,
  onOpenChange,
  sourceRevision,
  targetRevision,
  sourceRows = [],
  targetRows = [],
  sheetName,
  isLoading = false,
}: RevisionComparisonModalProps) {
  // Compute diffs — only added and removed
  const diffs = useMemo(() => {
    if (sourceRows.length === 0 && targetRows.length === 0) return []
    return computeRowDiffs(sourceRows, targetRows)
  }, [sourceRows, targetRows])

  const removedDiffs = useMemo(() => diffs.filter(d => d.changeType === 'removed'), [diffs])
  const addedDiffs = useMemo(() => diffs.filter(d => d.changeType === 'added'), [diffs])
  
  if (!sourceRevision || !targetRevision) return null
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[95vw] w-full max-h-[90vh] h-full p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-lg">
                Compare Revisions
                {sheetName && (
                  <span className="text-muted-foreground font-normal ml-2">
                    • {sheetName}
                  </span>
                )}
              </DialogTitle>
            </div>
            
            <SummaryBadges diffs={diffs} />
          </div>
        </DialogHeader>
        
        {/* Comparison panels */}
        <div className="flex-1 gap-4 p-4 flex overflow-hidden">
          {/* Removed (Previous → gone) */}
          <div className="flex-1 flex rounded-lg flex-col border-r">
            <div className="px-4 py-2 bg-red-50/50 dark:bg-red-950/20 border-b flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Removed</p>
                <p className="text-xs text-muted-foreground">
                  {sourceRevision.revisionInfo.displayVersion}
                </p>
              </div>
              <Badge variant="outline" className="text-red-600 border-red-600/30">
                {removedDiffs.length} rows
              </Badge>
            </div>
            
            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="w-5" />
              <div className="w-24">From</div>
              <div className="w-20">Wire No</div>
              <div className="w-12">Gauge</div>
              <div className="w-16">Color</div>
              <div className="w-24">To</div>
              <div className="flex-1">Location</div>
            </div>
            
            <ScrollArea className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : removedDiffs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No rows removed
                </div>
              ) : (
                removedDiffs.map((diff, i) => (
                  <DiffRow key={i} diff={diff} />
                ))
              )}
            </ScrollArea>
          </div>
          
          {/* Added (new in Current) */}
          <div className="flex-1 flex rounded-lg flex-col">
            <div className="px-4 py-2 bg-green-50/50 dark:bg-green-950/20 border-b flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Added</p>
                <p className="text-xs text-muted-foreground">
                  {targetRevision.revisionInfo.displayVersion}
                </p>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600/30">
                {addedDiffs.length} rows
              </Badge>
            </div>
            
            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="w-5" />
              <div className="w-24">From</div>
              <div className="w-20">Wire No</div>
              <div className="w-12">Gauge</div>
              <div className="w-16">Color</div>
              <div className="w-24">To</div>
              <div className="flex-1">Location</div>
            </div>
            
            <ScrollArea className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : addedDiffs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No rows added
                </div>
              ) : (
                addedDiffs.map((diff, i) => (
                  <DiffRow key={i} diff={diff} />
                ))
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
