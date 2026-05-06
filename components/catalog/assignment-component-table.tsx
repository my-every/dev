'use client'

/**
 * Assignment Component Table
 * 
 * Displays normalized assignment components in a sortable, filterable table.
 * Shows device ID, part number, description, category, and confidence.
 */

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Search,
  SortAsc,
  SortDesc,
  Filter,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'
import type {
  NormalizedAssignmentComponent,
  AssignmentComponentSummary,
  PartCategory,
} from '@/types/d380-catalog'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPES
// ============================================================================

type SortField = 'deviceId' | 'partNumber' | 'category' | 'confidence'
type SortDirection = 'asc' | 'desc'

interface AssignmentComponentTableProps {
  /** Component summary to display */
  summary: AssignmentComponentSummary
  /** Whether to show compact view */
  compact?: boolean
  /** Category filter */
  categoryFilter?: PartCategory
  /** Minimum confidence filter */
  minConfidence?: number
  /** On component select handler */
  onSelect?: (component: NormalizedAssignmentComponent) => void
  /** Additional class names */
  className?: string
}

// ============================================================================
// CONFIDENCE INDICATOR
// ============================================================================

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return 'text-emerald-500'
    if (confidence >= 60) return 'text-blue-500'
    if (confidence >= 40) return 'text-amber-500'
    return 'text-slate-400'
  }
  
  const getIcon = () => {
    if (confidence >= 80) return <CheckCircle2 className="h-4 w-4" />
    if (confidence >= 40) return <AlertCircle className="h-4 w-4" />
    return <HelpCircle className="h-4 w-4" />
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', getColor())}>
            {getIcon()}
            <span className="text-sm">{confidence}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {confidence >= 80 && 'High confidence match'}
            {confidence >= 40 && confidence < 80 && 'Medium confidence - may need review'}
            {confidence < 40 && 'Low confidence - needs review'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// COMPONENT IMAGE CELL
// ============================================================================

function ComponentImageCell({ component }: { component: NormalizedAssignmentComponent }) {
  const [error, setError] = useState(false)
  
  const imageSrc = component.referenceImage?.src || component.icon?.src
  
  if (!imageSrc || error) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <div className="w-10 h-10 relative bg-white rounded border overflow-hidden">
      <Image
        src={imageSrc}
        alt={component.description || component.deviceId}
        width={40}
        height={40}
        className="object-contain"
        onError={() => setError(true)}
      />
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AssignmentComponentTable({
  summary,
  compact = false,
  categoryFilter,
  minConfidence = 0,
  onSelect,
  className,
}: AssignmentComponentTableProps) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('deviceId')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [localCategoryFilter, setLocalCategoryFilter] = useState<string>('all')
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<PartCategory>()
    for (const component of summary.components) {
      if (component.category) {
        cats.add(component.category)
      }
    }
    return Array.from(cats).sort()
  }, [summary.components])
  
  // Filter and sort components
  const filteredComponents = useMemo(() => {
    let filtered = [...summary.components]
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(c => 
        c.deviceId.toLowerCase().includes(searchLower) ||
        c.fullDeviceId.toLowerCase().includes(searchLower) ||
        c.primaryPartNumber?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      )
    }
    
    // Apply category filter
    const effectiveCategory = categoryFilter || (localCategoryFilter !== 'all' ? localCategoryFilter : null)
    if (effectiveCategory) {
      filtered = filtered.filter(c => c.category === effectiveCategory)
    }
    
    // Apply confidence filter
    if (minConfidence > 0) {
      filtered = filtered.filter(c => c.confidence >= minConfidence)
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'deviceId':
          comparison = a.fullDeviceId.localeCompare(b.fullDeviceId)
          break
        case 'partNumber':
          comparison = (a.primaryPartNumber || '').localeCompare(b.primaryPartNumber || '')
          break
        case 'category':
          comparison = (a.category || 'Unknown').localeCompare(b.category || 'Unknown')
          break
        case 'confidence':
          comparison = a.confidence - b.confidence
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return filtered
  }, [summary.components, search, categoryFilter, localCategoryFilter, minConfidence, sortField, sortDirection])
  
  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }
  
  // Sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' 
      ? <SortAsc className="h-3 w-3 ml-1" />
      : <SortDesc className="h-3 w-3 ml-1" />
  }
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices, part numbers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {!categoryFilter && (
          <Select value={localCategoryFilter} onValueChange={setLocalCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <div className="text-sm text-muted-foreground">
          {filteredComponents.length} of {summary.totalComponents} components
        </div>
      </div>
      
      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {!compact && <TableHead className="w-[60px]">Image</TableHead>}
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('deviceId')}
              >
                <span className="flex items-center">
                  Device ID
                  <SortIndicator field="deviceId" />
                </span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('partNumber')}
              >
                <span className="flex items-center">
                  Part Number
                  <SortIndicator field="partNumber" />
                </span>
              </TableHead>
              {!compact && (
                <TableHead>Description</TableHead>
              )}
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('category')}
              >
                <span className="flex items-center">
                  Category
                  <SortIndicator field="category" />
                </span>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 w-[100px]"
                onClick={() => toggleSort('confidence')}
              >
                <span className="flex items-center">
                  Match
                  <SortIndicator field="confidence" />
                </span>
              </TableHead>
              {onSelect && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredComponents.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={compact ? 4 : 6} 
                  className="h-24 text-center text-muted-foreground"
                >
                  No components found
                </TableCell>
              </TableRow>
            ) : (
              filteredComponents.map(component => (
                <TableRow 
                  key={component.componentId}
                  className={cn(
                    onSelect && 'cursor-pointer hover:bg-muted/50',
                    component.confidence < 40 && 'bg-amber-50/50'
                  )}
                  onClick={() => onSelect?.(component)}
                >
                  {!compact && (
                    <TableCell>
                      <ComponentImageCell component={component} />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">
                    {component.fullDeviceId}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {component.primaryPartNumber || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {!compact && (
                    <TableCell className="max-w-[200px]">
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {component.description || '-'}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    {component.category ? (
                      <Badge variant="outline" className="text-xs">
                        {component.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ConfidenceIndicator confidence={component.confidence} />
                  </TableCell>
                  {onSelect && (
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// SUMMARY STATS BAR
// ============================================================================

export function AssignmentComponentStats({
  summary,
  className,
}: {
  summary: AssignmentComponentSummary
  className?: string
}) {
  const highConfidence = summary.components.filter(c => c.confidence >= 80).length
  const mediumConfidence = summary.components.filter(c => c.confidence >= 40 && c.confidence < 80).length
  const lowConfidence = summary.components.filter(c => c.confidence < 40).length
  
  return (
    <div className={cn('flex flex-wrap items-center gap-4 text-sm', className)}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Components:</span>
        <span className="font-medium">{summary.totalComponents}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Catalog Matched:</span>
        <span className="font-medium">{summary.catalogMatched}</span>
        <span className="text-muted-foreground">
          ({Math.round((summary.catalogMatched / summary.totalComponents) * 100)}%)
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          {highConfidence} high
        </Badge>
        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
          <AlertCircle className="h-3 w-3" />
          {mediumConfidence} medium
        </Badge>
        <Badge variant="outline" className="gap-1 text-slate-600 border-slate-200">
          <HelpCircle className="h-3 w-3" />
          {lowConfidence} low
        </Badge>
      </div>
    </div>
  )
}
