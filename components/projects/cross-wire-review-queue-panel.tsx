'use client'

/**
 * Cross-Wire Review Queue Panel
 * 
 * UI for reviewing and classifying ambiguous cross-wire connections.
 * Shows connections that need Team Lead classification decision.
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  HelpCircle,
  Layers,
  Plug,
  X,
  Zap,
} from 'lucide-react'
import type {
  CrossWireReviewItem,
  WireConnectionExecutionBucket,
  CrossWireClassificationSummary,
} from '@/types/d380-cross-wire'

// ============================================================================
// TYPES
// ============================================================================

interface CrossWireReviewQueuePanelProps {
  summary: CrossWireClassificationSummary
  onReviewComplete?: (connectionId: string, bucket: WireConnectionExecutionBucket, notes?: string) => void
  onSkip?: (connectionId: string) => void
  className?: string
}

interface CrossWireReviewItemProps {
  item: CrossWireReviewItem
  onReview: (bucket: WireConnectionExecutionBucket, notes?: string) => void
  onSkip: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CrossWireReviewQueuePanel({
  summary,
  onReviewComplete,
  onSkip,
  className,
}: CrossWireReviewQueuePanelProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set())
  
  const pendingItems = useMemo(() => {
    return summary.reviewQueue.filter(item => !reviewedItems.has(item.connection.id))
  }, [summary.reviewQueue, reviewedItems])
  
  const handleReview = (connectionId: string, bucket: WireConnectionExecutionBucket, notes?: string) => {
    setReviewedItems(prev => new Set([...prev, connectionId]))
    onReviewComplete?.(connectionId, bucket, notes)
  }
  
  const handleSkip = (connectionId: string) => {
    setReviewedItems(prev => new Set([...prev, connectionId]))
    onSkip?.(connectionId)
  }
  
  if (summary.reviewRequiredConnections === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">No Review Required</CardTitle>
          </div>
          <CardDescription>
            All {summary.totalConnections} connections have been classified automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {summary.wiringConnections}
              </Badge>
              <span className="text-muted-foreground">Wiring</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {summary.crossWiringConnections}
              </Badge>
              <span className="text-muted-foreground">Cross-Wiring</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Review Required</CardTitle>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {pendingItems.length} pending
          </Badge>
        </div>
        <CardDescription>
          {summary.reviewRequiredConnections} connection(s) need manual classification.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="flex gap-4 text-sm pb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {summary.wiringConnections}
            </Badge>
            <span className="text-muted-foreground">Wiring</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {summary.crossWiringConnections}
            </Badge>
            <span className="text-muted-foreground">Cross-Wiring</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {summary.reviewRequiredConnections}
            </Badge>
            <span className="text-muted-foreground">Review</span>
          </div>
        </div>
        
        <Separator />
        
        {/* Review Queue */}
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {pendingItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>All items reviewed!</p>
              </div>
            ) : (
              pendingItems.map((item) => (
                <CrossWireReviewItemCard
                  key={item.connection.id}
                  item={item}
                  isExpanded={expandedItem === item.connection.id}
                  onToggleExpand={() => setExpandedItem(
                    expandedItem === item.connection.id ? null : item.connection.id
                  )}
                  onReview={(bucket, notes) => handleReview(item.connection.id, bucket, notes)}
                  onSkip={() => handleSkip(item.connection.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// REVIEW ITEM COMPONENT
// ============================================================================

function CrossWireReviewItemCard({
  item,
  isExpanded,
  onToggleExpand,
  onReview,
  onSkip,
}: CrossWireReviewItemProps) {
  const [selectedBucket, setSelectedBucket] = useState<WireConnectionExecutionBucket>(
    item.suggestedBucket
  )
  const [notes, setNotes] = useState('')
  
  const { connection, classification, suggestedBucket, suggestedReason } = item
  
  return (
    <div className="rounded-lg border bg-card">
      {/* Header - Always visible */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {connection.fromLocation || 'Unknown'}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">
              {connection.toLocation || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <CrossWireClassificationBadge bucket={suggestedBucket} size="sm" />
            <span className="text-xs text-muted-foreground truncate">
              {suggestedReason}
            </span>
          </div>
        </div>
        
        <Badge variant="outline" className="shrink-0 bg-amber-50/50 text-amber-600 border-amber-200">
          {classification.confidence}
        </Badge>
      </button>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          <Separator />
          
          {/* Connection Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From Zone</p>
              <p className="font-medium">{classification.fromZone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To Zone</p>
              <p className="font-medium">{classification.toZone}</p>
            </div>
          </div>
          
          {/* Reasons */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Classification Reasons</p>
            <ul className="text-xs space-y-0.5">
              {classification.reasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="text-muted-foreground">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Classification Selection */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Select Classification</p>
            <Select
              value={selectedBucket}
              onValueChange={(value) => setSelectedBucket(value as WireConnectionExecutionBucket)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WIRING">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-blue-500" />
                    Wiring (Internal Panel)
                  </div>
                </SelectItem>
                <SelectItem value="CROSS_WIRING">
                  <div className="flex items-center gap-2">
                    <Plug className="h-3 w-3 text-purple-500" />
                    Cross-Wiring (Boundary Crossing)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Notes (optional)</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this classification..."
              className="h-16 text-sm resize-none"
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip
            </Button>
            <Button
              size="sm"
              onClick={() => onReview(selectedBucket, notes || undefined)}
            >
              <Check className="mr-1 h-3 w-3" />
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// BADGE COMPONENT
// ============================================================================

interface CrossWireClassificationBadgeProps {
  bucket: WireConnectionExecutionBucket
  size?: 'sm' | 'md'
}

export function CrossWireClassificationBadge({
  bucket,
  size = 'md',
}: CrossWireClassificationBadgeProps) {
  const config = {
    WIRING: {
      label: 'Wiring',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Zap,
    },
    CROSS_WIRING: {
      label: 'Cross-Wire',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: Plug,
    },
    REVIEW_REQUIRED: {
      label: 'Review',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: HelpCircle,
    },
  }
  
  const { label, className, icon: Icon } = config[bucket]
  
  if (size === 'sm') {
    return (
      <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${className}`}>
        <Icon className="h-2.5 w-2.5 mr-0.5" />
        {label}
      </Badge>
    )
  }
  
  return (
    <Badge variant="outline" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  )
}
