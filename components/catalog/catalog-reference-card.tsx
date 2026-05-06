'use client'

/**
 * Catalog Reference Card
 * 
 * Displays a part catalog entry with image, description, and metadata.
 * Reusable across stage pages and assignment details.
 */

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronRight,
  Package,
  Tag,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Wrench,
} from 'lucide-react'
import type {
  PartCatalogRecord,
  CatalogLookupResult,
  CatalogInstructionNote,
  CatalogAssociatedPart,
} from '@/types/d380-catalog'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPES
// ============================================================================

interface CatalogReferenceCardProps {
  /** The catalog record to display */
  record: PartCatalogRecord
  /** Optional lookup result for match info */
  lookupResult?: CatalogLookupResult
  /** Compact mode for inline display */
  compact?: boolean
  /** Show associated parts */
  showAssociatedParts?: boolean
  /** Show instruction notes */
  showNotes?: boolean
  /** Additional class names */
  className?: string
  /** On click handler */
  onClick?: () => void
}

// ============================================================================
// CONFIDENCE BADGE
// ============================================================================

function ConfidenceBadge({ result }: { result: CatalogLookupResult }) {
  const getConfidenceColor = () => {
    if (result.confidenceScore >= 90) return 'bg-emerald-500'
    if (result.confidenceScore >= 70) return 'bg-blue-500'
    if (result.confidenceScore >= 50) return 'bg-amber-500'
    return 'bg-slate-500'
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('gap-1', getConfidenceColor())}>
            {result.confidence === 'EXACT' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Info className="h-3 w-3" />
            )}
            {result.confidenceScore}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-medium">Match: {result.confidence}</p>
            <p>{result.reasons.join(', ')}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// CATEGORY BADGE
// ============================================================================

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Tag className="h-3 w-3" />
      {category}
    </Badge>
  )
}

// ============================================================================
// INSTRUCTION NOTE ITEM
// ============================================================================

function InstructionNoteItem({ note }: { note: CatalogInstructionNote }) {
  const getIcon = () => {
    switch (note.type) {
      case 'WARNING':
      case 'CAUTION':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'DONT':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'DO':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'TIP':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }
  
  const getBgColor = () => {
    switch (note.type) {
      case 'WARNING':
      case 'CAUTION':
        return 'bg-amber-50 border-amber-200'
      case 'DONT':
        return 'bg-red-50 border-red-200'
      case 'DO':
        return 'bg-emerald-50 border-emerald-200'
      default:
        return 'bg-slate-50 border-slate-200'
    }
  }
  
  return (
    <div className={cn('flex items-start gap-2 p-2 rounded border text-sm', getBgColor())}>
      {getIcon()}
      <div>
        <span className="font-medium text-xs uppercase">{note.type}</span>
        <p className="text-muted-foreground">{note.text}</p>
      </div>
    </div>
  )
}

// ============================================================================
// ASSOCIATED PART ITEM
// ============================================================================

function AssociatedPartItem({ part }: { part: CatalogAssociatedPart }) {
  const getOperationshipLabel = () => {
    switch (part.operationship) {
      case 'REQUIRES':
        return 'Required'
      case 'RECOMMENDED':
        return 'Recommended'
      case 'ALTERNATIVE':
        return 'Alternative'
      case 'ACCESSORY':
        return 'Accessory'
      case 'MOUNTING':
        return 'Mounting'
      default:
        return part.operationship
    }
  }
  
  return (
    <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono">{part.partNumber}</span>
        {part.quantity && part.quantity > 1 && (
          <Badge variant="secondary" className="text-xs">x{part.quantity}</Badge>
        )}
      </div>
      <Badge variant="outline" className="text-xs">{getOperationshipLabel()}</Badge>
    </div>
  )
}

// ============================================================================
// PART IMAGE
// ============================================================================

function PartImage({ record, compact }: { record: PartCatalogRecord; compact?: boolean }) {
  const [imageError, setImageError] = useState(false)
  const [useIcon, setUseIcon] = useState(false)
  
  const imageSrc = useIcon 
    ? record.images.icon?.src 
    : record.images.primary?.src || record.images.images[0]?.src
  
  const size = compact ? 48 : 80
  
  if (!imageSrc || imageError) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center bg-muted rounded',
          compact ? 'w-12 h-12' : 'w-20 h-20'
        )}
      >
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <div 
      className={cn(
        'relative bg-white rounded border overflow-hidden',
        compact ? 'w-12 h-12' : 'w-20 h-20'
      )}
    >
      <Image
        src={imageSrc}
        alt={record.description || record.partNumber}
        width={size}
        height={size}
        className="object-contain"
        onError={() => {
          if (!useIcon && record.images.icon) {
            setUseIcon(true)
          } else {
            setImageError(true)
          }
        }}
      />
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CatalogReferenceCard({
  record,
  lookupResult,
  compact = false,
  showAssociatedParts = true,
  showNotes = true,
  className,
  onClick,
}: CatalogReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const hasNotes = record.notes && record.notes.length > 0
  const hasAssociatedParts = record.associatedParts && record.associatedParts.length > 0
  const hasTools = record.tools && record.tools.length > 0
  const hasExpandableContent = (showNotes && hasNotes) || (showAssociatedParts && hasAssociatedParts)
  
  if (compact) {
    // Compact inline version
    return (
      <div 
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        <PartImage record={record} compact />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">
              {record.partNumber}
            </span>
            {lookupResult && <ConfidenceBadge result={lookupResult} />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {record.description}
          </p>
        </div>
        {hasNotes && (
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        )}
      </div>
    )
  }
  
  // Full card version
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-4">
          <PartImage record={record} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CardTitle className="text-base font-mono">
                {record.partNumber}
              </CardTitle>
              {lookupResult && <ConfidenceBadge result={lookupResult} />}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {record.description}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <CategoryBadge category={record.category} />
              {record.mountType && record.mountType !== 'UNKNOWN' && (
                <Badge variant="secondary" className="text-xs">
                  {record.mountType.replace(/_/g, ' ')}
                </Badge>
              )}
              {hasTools && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Wrench className="h-3 w-3" />
                  {record.tools!.length} tool(s)
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      {hasExpandableContent && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2 rounded-none border-t"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {hasNotes && `${record.notes!.length} note(s)`}
              {hasNotes && hasAssociatedParts && ' • '}
              {hasAssociatedParts && `${record.associatedParts!.length} associated part(s)`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 space-y-4">
              {/* Instruction Notes */}
              {showNotes && hasNotes && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </h4>
                  {record.notes!.map((note, idx) => (
                    <InstructionNoteItem key={idx} note={note} />
                  ))}
                </div>
              )}
              
              {/* Associated Parts */}
              {showAssociatedParts && hasAssociatedParts && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Associated Parts
                  </h4>
                  {record.associatedParts!.map((part, idx) => (
                    <AssociatedPartItem key={idx} part={part} />
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  )
}

// ============================================================================
// COMPACT LIST VERSION
// ============================================================================

export function CatalogReferenceList({
  records,
  lookupResults,
  className,
  onSelect,
}: {
  records: PartCatalogRecord[]
  lookupResults?: Map<string, CatalogLookupResult>
  className?: string
  onSelect?: (record: PartCatalogRecord) => void
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {records.map(record => (
        <CatalogReferenceCard
          key={record.partNumber}
          record={record}
          lookupResult={lookupResults?.get(record.partNumber)}
          compact
          onClick={() => onSelect?.(record)}
        />
      ))}
    </div>
  )
}
