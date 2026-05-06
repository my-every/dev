'use client'

/**
 * Project Assignment Mapping Modal - Accordion Design
 * 
 * A full-screen modal for Team Leads to map sheets to assignments.
 * Features:
 * - Accordion rows that expand to show fields
 * - # column with row count
 * - 50/50 split layout with right panel for layouts
 * - Auto-open layout image on row click
 * - Override Reason only shown when SWS Type/Stage changes
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  X, AlertCircle, FileSpreadsheet, Layers, Save, RotateCcw,
  Image as ImageIcon, ChevronLeft, ChevronDown, ChevronRight,
  Download, Upload, Search, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { ManifestAssignmentNode } from '@/types/project-manifest'
import type { AssignmentStatus, WorkbookSheetKind } from '@/types/d380-assignment'
import { ASSIGNMENT_STATUS_CONFIG } from '@/types/d380-assignment'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { ASSIGNMENT_STAGES } from '@/types/d380-assignment-stages'
import {
  detectSwsType,
  getSwsTypeOptions,
  SWS_TYPE_REGISTRY,
  type SwsTypeId,
} from '@/lib/assignment/sws-detection'
import { autoMapAssignments } from '@/lib/assignment/auto-map-assignments'
import { SwsTypeGrid, SWS_ICON_MAP } from '@/components/projects/sws-type-grid'
import { filterExecutableSheets } from '@/lib/assignment/sheet-classification'
import type { LayoutPagePreview } from '@/lib/layout-matching/types'
import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import {
  type LayoutNamingConfig,
  buildNamingConfigFromMappings,
  exportNamingConfig,
  importNamingConfig,
  resolveLayoutTitle,
} from '@/lib/assignment/layout-naming-config'
export type { MappedAssignment } from '@/lib/assignment/mapped-assignment'

// ============================================================================
// Types
// ============================================================================

export interface ProjectAssignmentMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (mappings: MappedAssignment[], namingConfig: LayoutNamingConfig) => void
  sheets: ManifestAssignmentNode[]
  projectName: string
  existingMappings?: MappedAssignment[]
  layoutPages?: LayoutPagePreview[]
  namingConfig?: LayoutNamingConfig | null
  /**
   * When true, renders only the inner content (assignment list + layout panel + footer)
   * without the backdrop overlay + modal chrome. Used when embedding inside another dialog.
   */
  __embedded?: boolean
  /** Callback to trigger layout PDF upload from the empty state */
  onUploadLayout?: () => void
}

// ============================================================================
// Stage & Status Options
// ============================================================================

// Use only stages that appear in the Assignments column or Kanban columns
const DROPDOWN_STAGE_IDS = new Set<AssignmentStageId>([
  // Assignments column (queue stages)
  'READY_TO_LAY', 'READY_TO_WIRE', 'READY_FOR_VISUAL',
  'READY_TO_HANG', 'READY_TO_CROSS_WIRE', 'READY_TO_TEST', 'READY_FOR_BIQ',
  // Kanban columns (work stages)
  'BUILD_UP', 'WIRING', 'BOX_BUILD', 'CROSS_WIRE', 'TEST_1ST_PASS', 'BIQ',
  // Completed
  'FINISHED_BIQ',
])
const STAGE_OPTIONS = ASSIGNMENT_STAGES.filter((s) => DROPDOWN_STAGE_IDS.has(s.id))

// Status options for the Status dropdown
const STATUS_OPTIONS: { id: AssignmentStatus; label: string }[] = [
  { id: 'NOT_STARTED', label: 'Not Started' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'INCOMPLETE', label: 'Incomplete' },
  { id: 'COMPLETE', label: 'Complete' },
]

const KIND_OPTIONS: { id: WorkbookSheetKind; label: string }[] = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'reference', label: 'Reference' },
  { id: 'other', label: 'Not Applicable' },
]

const SWS_ICON_SIZE: Record<SwsTypeId, { w: number; h: number }> = {
  BLANK: { w: 24, h: 24 },
  RAIL: { w: 24, h: 24 },
  BOX: { w: 24, h: 24 },
  PANEL: { w: 24, h: 24 },
  COMPONENT: { w: 24, h: 24 },
  UNDECIDED: { w: 24, h: 24 },
}

// Status color indicators
const STATUS_COLORS: Record<AssignmentStatus, string> = {
  NOT_STARTED: 'bg-slate-300 dark:bg-slate-600',
  IN_PROGRESS: 'bg-blue-500',
  INCOMPLETE: 'bg-amber-500',
  COMPLETE: 'bg-emerald-500',
}



function getDefaultStageForSwsType(swsType: SwsTypeId): AssignmentStageId {
  switch (swsType) {
    case 'BLANK':
    case 'RAIL':
    case 'BOX':
    case 'PANEL':
    case 'COMPONENT':
    case 'UNDECIDED':
    default:
      return 'READY_TO_LAY'
  }
}

// ============================================================================
// Modal Component
// ============================================================================

export function ProjectAssignmentMappingModal({
  isOpen,
  onClose,
  onSave,
  sheets,
  projectName,
  existingMappings,
  layoutPages = [],
  namingConfig = null,
  __embedded = false,
  onUploadLayout,
}: ProjectAssignmentMappingModalProps) {
  const [expandedLayoutPage, setExpandedLayoutPage] = useState<LayoutPagePreview | null>(null)
  const [expandedRowSlug, setExpandedRowSlug] = useState<string | null>(null)
  const [layoutPageOrder, setLayoutPageOrder] = useState<LayoutPagePreview[]>(layoutPages)
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'selected' | 'not-selected'>('not-selected')
  const [gallerySearch, setGallerySearch] = useState('')

  // Sync layout page order when layoutPages prop changes (e.g. after upload)
  useEffect(() => {
    if (layoutPages.length > 0) {
      setLayoutPageOrder(layoutPages)
    }
  }, [layoutPages])

  const { assignments: executableSheets, summary } = useMemo(
    () => filterExecutableSheets(sheets, undefined, {
      hasLayoutMatch: () => true,
    }),
    [sheets]
  )

  const buildInitialMappings = useCallback((): MappedAssignment[] => {
    // Run domain-aware auto-mapping for all sheets that don't have existing mappings
    const sheetsToAutoMap = executableSheets.filter(
      sheet => !existingMappings?.find(m => m.sheetSlug === (sheet.sheetSlug ?? sheet.slug))
    )
    const autoMap = autoMapAssignments(sheetsToAutoMap, layoutPages)

    const sheetMappings = executableSheets.map((sheet) => {
      const slug = sheet.sheetSlug ?? sheet.slug ?? ''
      const name = sheet.sheetName ?? sheet.name ?? ''
      const existing = existingMappings?.find(m => m.sheetSlug === slug)
      if (existing) {
        return {
          ...existing,
          matchedLayoutTitle: existing.matchedLayoutTitle || existing.sheetName,
        }
      }

      const hasWireRows = sheet.rowCount > 0
      const mapped = autoMap.get(slug)
      const detection = mapped?.swsDetection ?? detectSwsType(sheet, { hasWireRows })
      const defaultStage = getDefaultStageForSwsType(detection.type)

      return {
        sheetSlug: slug,
        sheetName: name,
        rowCount: sheet.rowCount,
        sheetKind: 'assignment' as WorkbookSheetKind,
        detectedSwsType: detection.type,
        detectedConfidence: detection.confidence,
        detectedReasons: detection.reasons,
        selectedSwsType: detection.type,
        selectedStage: defaultStage,
        selectedStatus: 'NOT_STARTED' as AssignmentStatus,
        overrideReason: '',
        isOverride: false,
        requiresWireSws: detection.requiresWireSws ?? hasWireRows,
        requiresCrossWireSws: detection.requiresCrossWireSws ?? false,
        matchedLayoutPage: mapped?.matchedLayoutPage,
        matchedLayoutTitle: mapped?.matchedLayoutTitle ?? name,
      }
    })

    return sheetMappings
  }, [executableSheets, existingMappings, layoutPages])

  const [mappings, setMappings] = useState<MappedAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Add a small delay to show loading state and allow UI to render
    setIsLoading(true)
    const timer = setTimeout(() => {
      setMappings(buildInitialMappings())
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [buildInitialMappings])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (expandedLayoutPage) {
          setExpandedLayoutPage(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, expandedLayoutPage])

  const updateMapping = useCallback((
    sheetSlug: string,
    updates: Partial<MappedAssignment>
  ) => {
    setMappings(prev => {
      let result = prev.map(m => {
        if (m.sheetSlug !== sheetSlug) return m

        const updated = { ...m, ...updates }
        const originalSws = m.detectedSwsType as SwsTypeId
        const originalStage = getDefaultStageForSwsType(originalSws)

        // Check if this is an override
        updated.isOverride =
          updated.selectedSwsType !== originalSws ||
          updated.selectedStage !== originalStage

        // Auto-update stage when SWS type changes
        if (updates.selectedSwsType !== undefined && updates.selectedSwsType !== m.selectedSwsType) {
          updated.selectedStage = getDefaultStageForSwsType(updates.selectedSwsType as SwsTypeId)
        }

        return updated
      })

      return result
    })
  }, [])

  const handleResetAll = useCallback(() => {
    setMappings(buildInitialMappings())
    setExpandedRowSlug(null)
  }, [buildInitialMappings])


  const handleSave = useCallback(() => {
    // Save mappings as-is — no auto-matching; only manually assigned pages are kept
    const enrichedMappings = mappings

    // Build naming config from the final mappings (raw PDF title → display title)
    const updatedConfig = buildNamingConfigFromMappings(
      enrichedMappings.map(m => {
        const rawPdfTitle = m.matchedLayoutPage
          ? layoutPages.find(p => p.pageNumber === m.matchedLayoutPage)?.title
          : undefined
        return { sheetName: m.matchedLayoutTitle || m.sheetName, matchedLayoutTitle: rawPdfTitle }
      })
    )

    onSave(enrichedMappings, updatedConfig)
    onClose()
  }, [mappings, onSave, onClose, layoutPages])

  // Export naming config as JSON file
  const handleExportNamingConfig = useCallback(() => {
    const config = buildNamingConfigFromMappings(
      mappings.map(m => {
        const rawPdfTitle = m.matchedLayoutPage
          ? layoutPages.find(p => p.pageNumber === m.matchedLayoutPage)?.title
          : undefined
        return { sheetName: m.matchedLayoutTitle || m.sheetName, matchedLayoutTitle: rawPdfTitle }
      })
    )
    const json = exportNamingConfig(config)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/[^a-zA-Z0-9]+/g, '_')}_layout-naming.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [mappings, layoutPages, projectName])

  // Import naming config from JSON file
  const handleImportNamingConfig = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const config = importNamingConfig(reader.result as string)
          // Apply the imported config: update layout titles in current mappings
          setMappings(prev => prev.map(m => {
            const rawPdfTitle = m.matchedLayoutPage
              ? layoutPages.find(p => p.pageNumber === m.matchedLayoutPage)?.title
              : undefined
            if (rawPdfTitle && config.entries[rawPdfTitle]) {
              return { ...m, matchedLayoutTitle: config.entries[rawPdfTitle] }
            }
            return m
          }))
        } catch {
          console.error('Failed to import naming config')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [layoutPages])

  // Handle row click - expand row and show its matched layout page
  const handleRowClick = useCallback((mapping: MappedAssignment, index: number) => {
    const isCurrentlyExpanded = expandedRowSlug === mapping.sheetSlug

    // If clicking the same row, collapse it
    if (isCurrentlyExpanded) {
      setExpandedRowSlug(null)
      return
    }

    // Expand the clicked row
    setExpandedRowSlug(mapping.sheetSlug)

    // Show the layout page for this assignment
    if (layoutPages.length > 0 && mapping.matchedLayoutPage) {
      const storedPage = layoutPages.find(p => p.pageNumber === mapping.matchedLayoutPage)
      if (storedPage) {
        setExpandedLayoutPage(storedPage)
        return
      }
    }
  }, [expandedRowSlug, layoutPages])

  const handleCloseExpanded = () => {
    setExpandedLayoutPage(null)
  }

  // Assign a layout page to the currently expanded row
  const handleAssignLayoutToRow = useCallback((page: LayoutPagePreview) => {
    if (!expandedRowSlug) return
    const existing = mappings.find(m => m.sheetSlug === expandedRowSlug)
    updateMapping(expandedRowSlug, {
      matchedLayoutPage: page.pageNumber,
      // Keep existing custom title; only set if empty
      matchedLayoutTitle: existing?.matchedLayoutTitle || existing?.sheetName || page.title,
    })
    setExpandedLayoutPage(page)
  }, [expandedRowSlug, mappings, updateMapping])

  // Clear the layout assignment for the currently expanded row
  const handleClearLayoutAssignment = useCallback(() => {
    if (!expandedRowSlug) return
    updateMapping(expandedRowSlug, {
      matchedLayoutPage: undefined,
      matchedLayoutTitle: undefined,
    })
    setExpandedLayoutPage(null)
  }, [expandedRowSlug, updateMapping])

  const handleLayoutClick = (page: LayoutPagePreview) => {
    if (expandedRowSlug) {
      // If a row is expanded, assign this layout page to it (but stay in gallery view)
      if (!expandedRowSlug) return
      const existing = mappings.find(m => m.sheetSlug === expandedRowSlug)
      updateMapping(expandedRowSlug, {
        matchedLayoutPage: page.pageNumber,
        matchedLayoutTitle: existing?.matchedLayoutTitle || existing?.sheetName || page.title,
      })
      // Move selected page to bottom of gallery order
      setLayoutPageOrder(prev => {
        const without = prev.filter(p => p.pageNumber !== page.pageNumber)
        return [...without, page]
      })
    } else {
      // No row expanded: move clicked page to the bottom of the gallery
      setLayoutPageOrder(prev => {
        const without = prev.filter(p => p.pageNumber !== page.pageNumber)
        return [...without, page]
      })
    }
  }

  const assignmentMappings = useMemo(() => mappings, [mappings])

  const stats = useMemo(() => {
    return {
      total: assignmentMappings.length,
      referenceExcluded: summary.reference,
      otherExcluded: summary.other,
    }
  }, [assignmentMappings, summary])

  // Build a map of page number -> assigned sheet name for gallery badges
  const pageAssignmentMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const m of mappings) {
      if (m.matchedLayoutPage) {
        map.set(m.matchedLayoutPage, m.sheetName)
      }
    }
    return map
  }, [mappings])

  // Filtered layout pages for gallery
  const filteredLayoutPages = useMemo(() => {
    let pages = layoutPageOrder

    // Apply selected/not-selected filter
    if (galleryFilter === 'selected') {
      pages = pages.filter(p => pageAssignmentMap.has(p.pageNumber))
    } else if (galleryFilter === 'not-selected') {
      pages = pages.filter(p => !pageAssignmentMap.has(p.pageNumber))
    }

    // Apply search filter
    if (gallerySearch.trim()) {
      const q = gallerySearch.trim().toLowerCase()
      pages = pages.filter(p => {
        const title = (pageAssignmentMap.get(p.pageNumber) || resolveLayoutTitle(p.title, namingConfig) || '').toLowerCase()
        const pageStr = `page ${p.pageNumber}`
        return title.includes(q) || pageStr.includes(q)
      })
    }

    return pages
  }, [layoutPageOrder, galleryFilter, gallerySearch, pageAssignmentMap, namingConfig])

  const swsOptions = useMemo(() => getSwsTypeOptions(), [])

  // ── Inner content (shared between standalone modal & embedded mode) ──────

  const innerContent = (
    <>
      {/* Header — hidden in embedded mode (parent provides its own) */}
      {!__embedded && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                SWS Mapping
              </h2>
              <div className="text-sm text-muted-foreground">
                {projectName} - {isLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Skeleton className="h-4 w-20 inline-block" />
                    <span>Loading assignments...</span>
                  </span>
                ) : (
                  <>
                    {stats.total} assignments
                    {(stats.referenceExcluded > 0 || stats.otherExcluded > 0) && (
                      <span className="ml-1 text-muted-foreground/70">
                        ({stats.referenceExcluded} reference + {stats.otherExcluded} other excluded)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleImportNamingConfig} className="gap-1.5 text-xs h-8">
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportNamingConfig} className="gap-1.5 text-xs h-8">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content - Stacked on mobile, side-by-side on lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side - Assignment List */}
        <div className="flex-1 overflow-auto min-h-0">
          {/* Header Row */}
          <div className="sticky top-0 bg-muted/50 border-b z-10">
            <div className="grid grid-cols-[1fr_50px] sm:grid-cols-[1fr_60px_80px_100px] gap-2 px-3 sm:px-4 py-2 text-xs font-medium text-muted-foreground">
              <div>Assignment</div>
              <div className="text-center">Rows</div>
              <div className="text-center hidden sm:block">SWS</div>
              <div className="hidden sm:block truncate">Layout</div>
            </div>
          </div>

          {/* Accordion Rows or Loading Skeleton */}
          <div className="divide-y">
            {isLoading ? (
              // Loading Skeleton
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-border/50">
                    <div className="grid grid-cols-[40px_1fr_60px_80px_1fr] gap-4 items-center">
                      {/* Row number */}
                      <Skeleton className="h-6 w-8 rounded-full mx-auto" />
                      {/* Assignment name */}
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-5 w-12 rounded-full" />
                      </div>
                      {/* Rows count */}
                      <Skeleton className="h-4 w-8 rounded mx-auto" />
                      {/* SWS type */}
                      <Skeleton className="h-6 w-16 rounded-full mx-auto" />
                      {/* Layout name */}
                      <Skeleton className="h-4 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Assignment Rows */}
                {assignmentMappings.map((mapping, index) => (
                  <AccordionRow
                    key={mapping.sheetSlug}
                    mapping={mapping}
                    swsOptions={swsOptions}
                    layoutPages={layoutPages}
                    isExpanded={expandedRowSlug === mapping.sheetSlug}
                    onToggle={() => handleRowClick(mapping, index)}
                    onUpdate={(updates) => updateMapping(mapping.sheetSlug, updates)}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right Side - Layout Images */}
        <div className="hidden lg:flex w-1/2 shrink-0 bg-muted/30 flex-col overflow-hidden border-l">
          <AnimatePresence mode="wait">
            {expandedLayoutPage ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseExpanded}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Layouts
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {pageAssignmentMap.get(expandedLayoutPage.pageNumber) || resolveLayoutTitle(expandedLayoutPage.title, namingConfig) || `Layout Page ${expandedLayoutPage.pageNumber}`}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Page {expandedLayoutPage.pageNumber}
                    </Badge>
                  </div>
                </div>
                {/* Assignment link bar */}
                {expandedRowSlug && (() => {
                  const expandedMapping = mappings.find(m => m.sheetSlug === expandedRowSlug)
                  const isAssigned = expandedMapping?.matchedLayoutPage === expandedLayoutPage.pageNumber
                  return (
                    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-muted/40">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        {isAssigned ? (
                          <span className="truncate">
                            Assigned to <span className="font-medium text-foreground">{expandedMapping?.sheetName}</span>
                          </span>
                        ) : (
                          <span className="truncate">
                            Viewing for <span className="font-medium text-foreground">{expandedMapping?.sheetName}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isAssigned && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleAssignLayoutToRow(expandedLayoutPage)}
                          >
                            Assign to Sheet
                          </Button>
                        )}
                        {isAssigned && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1.5 text-muted-foreground"
                            onClick={handleClearLayoutAssignment}
                          >
                            <X className="h-3 w-3" />
                            Unlink
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })()}
                <div className="flex-1 p-4 overflow-auto">
                  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <img
                      src={expandedLayoutPage.imageUrl}
                      alt={expandedLayoutPage.title || `Page ${expandedLayoutPage.pageNumber}`}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="gallery"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                <div className="flex flex-col gap-2 px-4 py-3 border-b bg-background">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {expandedRowSlug ? 'Select a Layout Page' : 'Layout Pages'}
                    </span>
                    {expandedRowSlug && (
                      <span className="text-xs text-muted-foreground">
                        Click a page to assign it to the selected sheet
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {filteredLayoutPages.length}/{layoutPages.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search layouts..."
                        value={gallerySearch}
                        onChange={(e) => setGallerySearch(e.target.value)}
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                    <div className="flex rounded-md border overflow-hidden shrink-0">
                      {(['not-selected', 'selected', 'all'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setGalleryFilter(filter)}
                          className={`px-2.5 py-1 text-xs font-medium transition-colors ${galleryFilter === filter
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-muted text-muted-foreground'
                            }`}
                        >
                          {filter === 'not-selected' ? 'Not Selected' : filter === 'selected' ? 'Selected' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-auto">
                  {isLoading ? (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : filteredLayoutPages.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {filteredLayoutPages.map((page) => (
                        <LayoutCard
                          key={page.pageNumber}
                          page={page}
                          assignedSheetName={pageAssignmentMap.get(page.pageNumber)}
                          resolvedTitle={resolveLayoutTitle(page.title, namingConfig)}
                          isSelectMode={Boolean(expandedRowSlug)}
                          onClick={() => handleLayoutClick(page)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-sm font-medium">No layout pages available</p>
                      <p className="text-xs mt-1">Upload a layout PDF to see pages</p>
                      {onUploadLayout && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 gap-1.5"
                          onClick={onUploadLayout}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload Layout PDF
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t bg-card shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Click a row to expand and edit classification, SWS type, and layout assignment.</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleResetAll} disabled={isLoading} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset All
          </Button>
          <Button onClick={handleSave} disabled={isLoading || mappings.length === 0} className="gap-2">
            <Save className="h-4 w-4" />
            {isLoading ? 'Loading...' : 'Save Assignments'}
          </Button>
        </div>
      </div>
    </>
  )

  // ── Embedded mode: just render the content directly ─────────────────────

  if (__embedded) {
    if (!isOpen) return null
    return <div className="flex flex-col h-full overflow-hidden">{innerContent}</div>
  }

  // ── Standalone mode: render with overlay + modal chrome ─────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col bg-background rounded-xl shadow-2xl border border-border overflow-hidden w-[98vw] h-[98vh] sm:w-[95vw] sm:h-[95vh] md:w-[90vw] md:h-[90vh]"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {innerContent}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Layout Card Component
// ============================================================================

interface LayoutCardProps {
  page: LayoutPagePreview
  assignedSheetName?: string
  resolvedTitle?: string
  isSelectMode?: boolean
  onClick: () => void
}

function LayoutCard({ page, assignedSheetName, resolvedTitle, isSelectMode, onClick }: LayoutCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full rounded-lg border bg-white overflow-hidden transition-all text-left ${isSelectMode
        ? 'hover:ring-2 hover:ring-primary cursor-pointer'
        : 'hover:ring-2 hover:ring-primary/50'
        } ${assignedSheetName ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
    >
      {/* Page label bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <span className="text-xs font-medium">Page {page.pageNumber}</span>
        <span className={`text-[11px] font-medium truncate ml-2 ${assignedSheetName ? 'text-primary' : 'text-muted-foreground'}`}>
          {assignedSheetName || resolvedTitle || page.title || ''}
        </span>
      </div>
      {/* Full image */}
      <div className="w-full bg-white">
        {page.imageUrl ? (
          <img
            src={page.imageUrl}
            alt={`Page ${page.pageNumber}`}
            className="w-full h-auto"
          />
        ) : (
          <div className="w-full aspect-[4/3] flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
    </button>
  )
}

// ============================================================================
// Accordion Row Component
// ============================================================================

interface AccordionRowProps {
  mapping: MappedAssignment
  swsOptions: { id: SwsTypeId; label: string; shortLabel: string; color: string }[]
  layoutPages: LayoutPagePreview[]
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<MappedAssignment>) => void
}

function AccordionRow({
  mapping,
  swsOptions,
  layoutPages,
  isExpanded,
  onToggle,
  onUpdate,
}: AccordionRowProps) {
  const selectedSwsInfo = SWS_TYPE_REGISTRY[mapping.selectedSwsType as SwsTypeId]

  return (
    <div className={`transition-colors ${isExpanded ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
      {/* Collapsed Header Row */}
      <div
        className={`w-full grid grid-cols-[1fr_50px] sm:grid-cols-[1fr_60px_80px_100px] gap-2 px-3 sm:px-4 py-3 items-center text-left transition-colors ${isExpanded ? 'border-b border-primary/20' : ''
          }`}
      >
        {/* Assignment Name - Clickable */}
        <button
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0  rounded px-1 -mx-1 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Image
            src={SWS_ICON_MAP[mapping.selectedSwsType as SwsTypeId] || SWS_ICON_MAP.UNDECIDED}
            width={SWS_ICON_SIZE[mapping.selectedSwsType as SwsTypeId]?.w ?? 30}
            height={SWS_ICON_SIZE[mapping.selectedSwsType as SwsTypeId]?.h ?? 30}
            alt={selectedSwsInfo.shortLabel}
            className="shrink-0 opacity-70 dark:invert"
          />
          <span className="font-medium text-sm truncate">
            {mapping.sheetName}
          </span>
        </button>

        {/* Rows */}
        <div className="text-center">
          <Badge variant="secondary" className="text-xs">
            {mapping.rowCount}
          </Badge>
        </div>

        {/* SWS (for assignments) / Classification (for layout-only) */}
        <div className="text-center hidden sm:block">
          <Badge variant="outline" className="text-xs">
            {selectedSwsInfo.shortLabel}
          </Badge>
        </div>

        {/* Layout Page */}
        <div className="hidden sm:block min-w-0">
          <span className="text-xs text-muted-foreground truncate block">
            {mapping.matchedLayoutPage ? `Page ${mapping.matchedLayoutPage}` : '—'}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-4 py-4 flex flex wrap flex-1 gap-3 sm:gap-4 bg-background">
              {/* Classification */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Classification</label>
                <Select
                  value={mapping.sheetKind}
                  onValueChange={(value: WorkbookSheetKind) => onUpdate({ sheetKind: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* SWS Type — card selector for assignment-classified entries */}
              {mapping.sheetKind === 'assignment' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">SWS Type</label>
                  <SwsTypeGrid
                    selected={mapping.selectedSwsType as SwsTypeId}
                    onSelect={(id) => onUpdate({ selectedSwsType: id })}
                    compact
                  />
                </div>
              )}

              {/* Current Stage — only for assignment-classified entries */}
              {mapping.sheetKind === 'assignment' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Current Stage</label>
                  <Select
                    value={mapping.selectedStage}
                    onValueChange={(value: AssignmentStageId) => onUpdate({ selectedStage: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status — only for assignment-classified entries */}
              {mapping.sheetKind === 'assignment' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select
                    value={mapping.selectedStatus || 'NOT_STARTED'}
                    onValueChange={(value: AssignmentStatus) => onUpdate({ selectedStatus: value })}
                  >
                    <SelectTrigger className="h-9">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[(mapping.selectedStatus || 'NOT_STARTED') as AssignmentStatus]}`} />
                        <span>{STATUS_OPTIONS.find((o) => o.id === (mapping.selectedStatus || 'NOT_STARTED'))?.label}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[option.id]}`} />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Page Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Layout Page</label>
                <Select
                  value={mapping.matchedLayoutPage ? String(mapping.matchedLayoutPage) : 'none'}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      onUpdate({ matchedLayoutPage: undefined, matchedLayoutTitle: undefined })
                    } else {
                      const pageNum = Number(value)
                      // Keep existing custom title; only set from sheet name if empty
                      onUpdate({
                        matchedLayoutPage: pageNum,
                        matchedLayoutTitle: mapping.matchedLayoutTitle || mapping.sheetName,
                      })
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">None</span>
                      </SelectItem>
                      <SelectSeparator />
                      {layoutPages.map((page) => (
                        <SelectItem key={page.pageNumber} value={String(page.pageNumber)}>
                          Pg {page.pageNumber}{page.title ? ` — ${page.title}` : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>


            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
