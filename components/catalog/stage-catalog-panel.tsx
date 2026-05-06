'use client'

/**
 * Stage Catalog Panel
 * 
 * Displays catalog information for a stage, including:
 * - Components that will be worked on in this stage
 * - Reference images and documentation
 * - Associated parts and tools needed
 */

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Package,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Wrench,
  AlertTriangle,
  Info,
  ExternalLink,
  Grid3X3,
  List,
} from 'lucide-react'
import type {
  NormalizedAssignmentComponent,
  AssignmentComponentSummary,
  PartCatalogRecord,
  PartCategory,
} from '@/types/d380-catalog'
import { CatalogReferenceCard } from './catalog-reference-card'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPES
// ============================================================================

interface StageCatalogPanelProps {
  /** Stage ID for context */
  stageId: string
  /** Stage title for display */
  stageTitle: string
  /** Component summary for this assignment */
  componentSummary?: AssignmentComponentSummary
  /** Categories relevant to this stage (filters displayed components) */
  relevantCategories?: PartCategory[]
  /** Show expanded view by default */
  defaultExpanded?: boolean
  /** Additional class names */
  className?: string
}

// ============================================================================
// STAGE-TO-CATEGORY MAPPING
// ============================================================================

/**
 * Map stage IDs to relevant part categories.
 */
const STAGE_CATEGORY_MAP: Record<string, PartCategory[]> = {
  READY_TO_LAY: [],
  BUILDUP: [
    'DIN Rail & Mounting',
    'Panel Hardware',
    'Grounding & Busbars',
    'Terminal Blocks & Accessories',
    'Wire Duct & Panduit',
    'Cable Management',
  ],
  READY_TO_WIRE: [],
  WIRING: [
    'Wire Ferrules',
    'Ring Terminals',
    'Fork Terminals',
    'Terminal Blocks & Accessories',
    'Wire Management',
  ],
  READY_FOR_VISUAL: [],
  WIRING_IPV: [],
  READY_TO_HANG: [],
  BOX_BUILD: [
    'Panel Hardware',
    'Operator Controls',
    'Pilot Lights & Indicators',
    'HMI & Operator Interface',
  ],
  CROSS_WIRE: [
    'Wire Ferrules',
    'Ring Terminals',
    'Fork Terminals',
    'Cable Management',
  ],
  CROSS_WIRE_IPV: [],
  READY_TO_TEST: [],
  TEST_1ST_PASS: [
    'Measurement & Shunts',
    'Counters & Timers',
  ],
  PWR_CHECK: [
    'Circuit Protection',
    'Control Power',
    'Power Conversion',
  ],
  READY_FOR_BIQ: [],
  BIQ: [],
}

// ============================================================================
// COMPONENT IMAGE GRID
// ============================================================================

function ComponentImageGrid({
  components,
  onSelect,
}: {
  components: NormalizedAssignmentComponent[]
  onSelect: (component: NormalizedAssignmentComponent) => void
}) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (componentId: string) => {
    setImageErrors(prev => new Set(prev).add(componentId))
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {components.map(component => {
        const imageSrc = component.referenceImage?.src || component.icon?.src
        const hasError = imageErrors.has(component.componentId)

        return (
          <button
            key={component.componentId}
            onClick={() => onSelect(component)}
            className="group flex flex-col items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="relative w-16 h-16 bg-white rounded border overflow-hidden">
              {imageSrc && !hasError ? (
                <Image
                  src={imageSrc}
                  alt={component.description || component.deviceId}
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={() => handleImageError(component.componentId)}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className="text-xs font-mono text-center truncate w-full">
              {component.deviceId}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// COMPONENT LIST VIEW
// ============================================================================

function ComponentListView({
  components,
  onSelect,
}: {
  components: NormalizedAssignmentComponent[]
  onSelect: (component: NormalizedAssignmentComponent) => void
}) {
  return (
    <div className="space-y-2">
      {components.map(component => (
        <button
          key={component.componentId}
          onClick={() => onSelect(component)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
        >
          <div className="shrink-0 w-10 h-10 bg-white rounded border overflow-hidden flex items-center justify-center">
            {component.icon?.src ? (
              <Image
                src={component.icon.src}
                alt=""
                width={32}
                height={32}
                className="object-contain"
              />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {component.fullDeviceId}
              </span>
              {component.category && (
                <Badge variant="outline" className="text-xs">
                  {component.category}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {component.primaryPartNumber || 'No part number'}
              {component.description && ` - ${component.description}`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}

// ============================================================================
// COMPONENT DETAIL SHEET
// ============================================================================

function ComponentDetailSheet({
  component,
  open,
  onOpenChange,
}: {
  component: NormalizedAssignmentComponent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!component) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono">{component.fullDeviceId}</SheetTitle>
          <SheetDescription>
            {component.description || 'Component details'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Reference Image */}
          {component.referenceImage && (
            <div className="relative aspect-square w-full bg-white rounded-lg border overflow-hidden">
              <Image
                src={component.referenceImage.src}
                alt={component.description || component.deviceId}
                fill
                className="object-contain p-4"
              />
            </div>
          )}

          {/* Part Number Info */}
          {component.primaryPartNumber && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Part Number</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-mono">
                  {component.primaryPartNumber}
                </Badge>
                {component.partNumbers.filter(pn => pn !== component.primaryPartNumber).map(pn => (
                  <Badge key={pn} variant="outline" className="font-mono text-muted-foreground">
                    {pn}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          {component.category && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Category</h4>
              <Badge>{component.category}</Badge>
            </div>
          )}

          {/* Wire Connections */}
          {component.wireConnections.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Wire Connections</h4>
              <div className="rounded-lg border divide-y">
                {component.wireConnections.slice(0, 5).map((conn, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {conn.fromOrTo}
                    </Badge>
                    <span className="font-mono text-xs">{conn.wireId}</span>
                    <span className="text-muted-foreground">to</span>
                    <span className="font-mono text-xs">{conn.otherDeviceId}</span>
                  </div>
                ))}
                {component.wireConnections.length > 5 && (
                  <div className="p-2 text-xs text-muted-foreground">
                    +{component.wireConnections.length - 5} more connections
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match Confidence */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Match Confidence</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    component.confidence >= 80 ? 'bg-emerald-500' :
                      component.confidence >= 50 ? 'bg-amber-500' : 'bg-slate-400'
                  )}
                  style={{ width: `${component.confidence}%` }}
                />
              </div>
              <span className="text-sm font-medium">{component.confidence}%</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {component.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// CATEGORY SECTION
// ============================================================================

function CategorySection({
  category,
  components,
  viewMode,
  onSelectComponent,
}: {
  category: PartCategory
  components: NormalizedAssignmentComponent[]
  viewMode: 'grid' | 'list'
  onSelectComponent: (component: NormalizedAssignmentComponent) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-accent/50 transition-colors">
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span className="font-medium text-sm">{category}</span>
        <Badge variant="secondary" className="ml-auto">
          {components.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 pl-6">
        {viewMode === 'grid' ? (
          <ComponentImageGrid components={components} onSelect={onSelectComponent} />
        ) : (
          <ComponentListView components={components} onSelect={onSelectComponent} />
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StageCatalogPanel({
  stageId,
  stageTitle,
  componentSummary,
  relevantCategories,
  defaultExpanded = false,
  className,
}: StageCatalogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedComponent, setSelectedComponent] = useState<NormalizedAssignmentComponent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Get relevant categories for this stage
  const categories = relevantCategories || STAGE_CATEGORY_MAP[stageId] || []

  // Filter components by relevant categories
  const relevantComponents = componentSummary?.components.filter(c =>
    c.category && categories.includes(c.category)
  ) || []

  // Group by category
  const componentsByCategory = new Map<PartCategory, NormalizedAssignmentComponent[]>()
  for (const component of relevantComponents) {
    if (component.category) {
      const existing = componentsByCategory.get(component.category) || []
      existing.push(component)
      componentsByCategory.set(component.category, existing)
    }
  }

  const handleSelectComponent = (component: NormalizedAssignmentComponent) => {
    setSelectedComponent(component)
    setDetailOpen(true)
  }

  // Don't render if no relevant components
  if (relevantComponents.length === 0) {
    return null
  }

  return (
    <>
      <Card className={cn('overflow-hidden', className)}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  Components & Reference ({relevantComponents.length})
                </CardTitle>
                <Badge variant="outline" className="ml-auto">
                  {componentsByCategory.size} categories
                </Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* View Mode Toggle */}
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Category Sections */}
              <div className="space-y-4">
                {Array.from(componentsByCategory.entries()).map(([category, components]) => (
                  <CategorySection
                    key={category}
                    category={category}
                    components={components}
                    viewMode={viewMode}
                    onSelectComponent={handleSelectComponent}
                  />
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Component Detail Sheet */}
      <ComponentDetailSheet
        component={selectedComponent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
