"use client"

/**
 * Revision Sidebar
 * 
 * A side panel that shows all file revisions for the current project/sheet.
 * Features two tabs:
 * - Layout: Shows layout revisions with preview cards
 * - Wire List: Shows the wire list for the selected revision
 * 
 * Supports comparing previous/current revisions side by side.
 */

import { useState, useCallback, useMemo } from "react"
import {
  History,
  FileText,
  Layout,
  ChevronRight,
  ChevronLeft,
  GitCompare,
  Check,
  Clock,
  Upload,
  ArrowUpDown,
  MousePointerClick,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FileRevision, RevisionInfo } from "@/lib/revision/types"
import type { LayoutPagePreview } from "@/lib/layout-matching"
import type { ProjectUnitRecord } from "@/types/d380-project-details"
import { ProjectUnitSwitcher } from "@/components/projects/project-unit-switcher"
import { LayoutPreviewModal } from "@/components/projects/layout-preview-modal"

// ============================================================================
// Props
// ============================================================================

interface RevisionSidebarProps {
  /** Wire list revisions */
  wireListRevisions: FileRevision[]
  /** Layout revisions */
  layoutRevisions: FileRevision[]
  /** Currently selected wire list revision */
  currentWireListRevision: FileRevision | null
  /** Currently selected layout revision */
  currentLayoutRevision: FileRevision | null
  /** Sheet name for context */
  sheetName?: string
  /** Project name for context */
  projectName?: string
  /** Callback when a wire list revision is selected */
  onSelectWireListRevision?: (revision: FileRevision) => void
  /** Callback when a layout revision is selected */
  onSelectLayoutRevision?: (revision: FileRevision) => void
  /** Callback to open comparison modal */
  onOpenComparison?: (sourceRevision: FileRevision, targetRevision: FileRevision) => void
  /** Collapsed state */
  collapsed?: boolean
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Currently selected wire list revision in the page view */
  selectedWireListRevision?: FileRevision | null
  /** Currently selected layout revision in the page view */
  selectedLayoutRevision?: FileRevision | null
  /** Rendered content for the List tab */
  listPanel?: React.ReactNode
  /** Select the current in-page sheet state */
  onSelectCurrentSheet?: () => void
  /** Whether the current in-page sheet is selected */
  isCurrentSheetSelected?: boolean
  /** Select the current in-page layout state */
  onSelectCurrentLayout?: () => void
  /** Whether the current in-page layout is selected */
  isCurrentLayoutSelected?: boolean
  /** Upload a replacement layout revision */
  onUploadLayoutRevision?: (file: File) => void
  /** Whether a layout revision is being loaded or uploaded */
  isLayoutLoading?: boolean
  /** Whether a paired revision upload is in progress */
  isRevisionUploadLoading?: boolean
  /** Current in-page layout preview page */
  currentLayoutPage?: LayoutPagePreview | null
  /** Whether both workbook and layout inputs are available */
  hasRequiredFiles?: boolean
  /** Project-level revision string (e.g. "B.14 M.1") used as fallback label */
  projectRevision?: string
  /** Open the shared revision upload flow */
  onOpenRevisionUpload?: () => void
  /** Preview for the actively uploaded layout revision */
  uploadedLayoutPage?: LayoutPagePreview | null
  /** Uploaded layout revision metadata */
  uploadedLayoutRevision?: FileRevision | null
  /** Uploaded wire list revision metadata (for compare cards) */
  uploadedWireListRevision?: FileRevision | null
  /** Select the uploaded layout revision */
  onSelectUploadedLayoutRevision?: () => void
  /** Whether the uploaded layout revision is selected */
  isUploadedLayoutRevisionSelected?: boolean
  /** Whether the compare selection mode is active */
  isCompareMode?: boolean
  /** Enter compare selection mode */
  onEnterCompareMode?: () => void
  /** Exit compare selection mode */
  onExitCompareMode?: () => void
  /** Currently selected "from" revision for comparison */
  compareFromRevision?: FileRevision | null
  /** Currently selected "to" revision for comparison */
  compareToRevision?: FileRevision | null
  /** Select a "from" revision for comparison */
  onSelectCompareFrom?: (revision: FileRevision) => void
  /** Select a "to" revision for comparison */
  onSelectCompareTo?: (revision: FileRevision) => void
  /** Confirm the compare selection and open comparison modal */
  onConfirmCompare?: () => void
  /** Callback when a revision is deleted */
  onDeleteRevision?: (revision: FileRevision) => void
  /** Project units for the unit switcher */
  units?: ProjectUnitRecord[]
  /** Currently active unit id */
  currentUnitId?: string
  /** PD number for display */
  pdNumber?: string
  /** LWC short label */
  lwcLabel?: string
  /** Due date */
  dueDate?: string
  /** Callback when a unit is selected */
  onSelectUnit?: (unit: ProjectUnitRecord) => void
  /** Callback to open unit creation flow */
  onCreateUnit?: () => void
  /** Endpoint for the shared Layouts */
  layoutWorkspaceEndpoint?: string | null
}

// ============================================================================
// Helper Components
// ============================================================================

function RevisionBadge({ revision, isCurrent }: { revision: RevisionInfo; isCurrent?: boolean }) {
  return (
    <Badge
      variant={isCurrent ? "default" : "outline"}
      className={cn(
        "font-mono text-xs",
        isCurrent && "bg-primary",
        revision.isModified && "border-amber-500 text-amber-600 dark:text-amber-400"
      )}
    >
      {revision.displayVersion}
      {revision.isModified && <span className="ml-1 text-[10px]">(mod)</span>}
    </Badge>
  )
}

function RevisionListItem({
  revision,
  isCurrent,
  isSelected,
  onClick,
  onCompare,
  canCompare,
  onDelete,
  canDelete,
}: {
  revision: FileRevision
  isCurrent?: boolean
  isSelected?: boolean
  onClick?: () => void
  onCompare?: () => void
  canCompare?: boolean
  onDelete?: () => void
  canDelete?: boolean
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
        isSelected
          ? "bg-background text-accent-foreground"
          : "hover:bg-background/50",
        isCurrent && "border-l-2 border-primary"
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {revision.category === "LAYOUT" ? (
          <Layout className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <RevisionBadge revision={revision.revisionInfo} isCurrent={isCurrent} />
          {isCurrent && (
            <span className="text-[10px] text-primary font-medium uppercase">
              Current
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {revision.filename}
        </p>
        {revision.lastModified && (
          <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {revision.lastModified}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {canCompare && onCompare && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCompare()
                  }}
                >
                  <GitCompare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Compare with current</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {canDelete && onDelete && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Delete revision</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

function CurrentLayoutPreviewItem({
  page,
  isSelected,
  onClick,
  title = "Current Layout",
  subtitle,
  onOpenWorkspace,
}: {
  page?: LayoutPagePreview | null
  isSelected?: boolean
  onClick?: () => void
  title?: string
  subtitle?: string
  onOpenWorkspace?: () => void
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) {
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "w-full rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? "border-primary bg-background text-accent-foreground"
          : "border-border bg-background hover:bg-background/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <p className="truncate text-xs font-medium text-foreground">
          {page?.title || "Current layout"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {subtitle || "Using current layout preview state"}
        </p>
        {onOpenWorkspace ? (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={(event) => {
                event.stopPropagation()
                onOpenWorkspace()
              }}
            >
              Open Layout Workspace
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function RevisionSidebar({
  wireListRevisions,
  layoutRevisions,
  currentWireListRevision,
  currentLayoutRevision,
  sheetName,
  projectName,
  onSelectWireListRevision,
  onSelectLayoutRevision,
  onOpenComparison,
  collapsed = false,
  onCollapsedChange,
  selectedWireListRevision,
  selectedLayoutRevision,
  listPanel,
  onSelectCurrentSheet,
  isCurrentSheetSelected = true,
  onSelectCurrentLayout,
  isCurrentLayoutSelected = true,
  onUploadLayoutRevision,
  isLayoutLoading = false,
  isRevisionUploadLoading = false,
  currentLayoutPage,
  hasRequiredFiles = true,
  projectRevision,
  onOpenRevisionUpload,
  uploadedLayoutPage,
  uploadedLayoutRevision,
  uploadedWireListRevision,
  onSelectUploadedLayoutRevision,
  isUploadedLayoutRevisionSelected = false,
  isCompareMode = false,
  onEnterCompareMode,
  onExitCompareMode,
  compareFromRevision,
  compareToRevision,
  onSelectCompareFrom,
  onSelectCompareTo,
  onConfirmCompare,
  onDeleteRevision,
  units = [],
  currentUnitId,
  pdNumber,
  lwcLabel,
  dueDate,
  onSelectUnit,
  onCreateUnit,
  layoutWorkspaceEndpoint = null,
}: RevisionSidebarProps) {
  const [activeTab, setActiveTab] = useState<"layout" | "list">("layout")
  const [isLayoutWorkspaceOpen, setIsLayoutWorkspaceOpen] = useState(false)

  // Sort revisions by score (newest first for display)
  const sortedWireListRevisions = useMemo(() => {
    return [...wireListRevisions].sort(
      (a, b) => b.revisionInfo.sortScore - a.revisionInfo.sortScore
    )
  }, [wireListRevisions])

  const displayedWireListRevisions = useMemo(() => {
    if (!onSelectCurrentSheet || !currentWireListRevision) {
      return sortedWireListRevisions
    }

    return sortedWireListRevisions.filter(
      (revision) => revision.filename !== currentWireListRevision.filename
    )
  }, [currentWireListRevision, onSelectCurrentSheet, sortedWireListRevisions])

  const sortedLayoutRevisions = useMemo(() => {
    return [...layoutRevisions].sort(
      (a, b) => b.revisionInfo.sortScore - a.revisionInfo.sortScore
    )
  }, [layoutRevisions])

  const displayedLayoutRevisions = useMemo(() => {
    if (!onSelectCurrentLayout || !currentLayoutRevision) {
      return sortedLayoutRevisions
    }

    return sortedLayoutRevisions.filter(
      (revision) => revision.filename !== currentLayoutRevision.filename
    )
  }, [currentLayoutRevision, onSelectCurrentLayout, sortedLayoutRevisions])

  // Handle comparison
  const handleCompare = useCallback(
    (sourceRevision: FileRevision) => {
      if (currentWireListRevision && onOpenComparison) {
        onOpenComparison(sourceRevision, currentWireListRevision)
      }
    },
    [currentWireListRevision, onOpenComparison]
  )

  // Build a combined list of unique revision versions for the compare picker
  // Use wire list revisions as the canonical source since comparison diffs wire list rows
  const allRevisionCards = useMemo(() => {
    const revs: FileRevision[] = []
    const seen = new Set<string>()

    // Add current wire list first (if available)
    if (currentWireListRevision && !seen.has(currentWireListRevision.filename)) {
      seen.add(currentWireListRevision.filename)
      revs.push(currentWireListRevision)
    }

    // Then all other wire list revisions
    for (const rev of sortedWireListRevisions) {
      if (!seen.has(rev.filename)) {
        seen.add(rev.filename)
        revs.push(rev)
      }
    }

    // Include uploaded wire list revision if not already in the list
    if (uploadedWireListRevision && !seen.has(uploadedWireListRevision.filename)) {
      seen.add(uploadedWireListRevision.filename)
      revs.push(uploadedWireListRevision)
    }

    return revs
  }, [currentWireListRevision, sortedWireListRevisions, uploadedWireListRevision])

  // Collapsed view
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange?.(false)}
          className="h-8 w-8"
          title="Show revisions"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Version count indicator */}
        <div className="mt-4 flex flex-col items-center gap-1 text-xs">
          <div
            className="flex items-center gap-0.5 text-muted-foreground"
            title="Wire list revisions"
          >
            <FileText className="h-3 w-3" />
            <span>{wireListRevisions.length}</span>
          </div>
          <div
            className="flex items-center gap-0.5 text-muted-foreground"
            title="Layout revisions"
          >
            <Layout className="h-3 w-3" />
            <span>{layoutRevisions.length}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 flex-shrink-0 border-r border-border bg-sidebar flex h-full flex-col overflow-hidden">
      {/* Header */}


      {/* Unit Switcher / Context info */}

      {projectName && (
        <ProjectUnitSwitcher
          projectName={projectName}
          pdNumber={pdNumber}
          revision={projectRevision}
          lwcLabel={lwcLabel}
          dueDate={dueDate}
          units={units}
          currentUnitId={currentUnitId}
          onSelectUnit={onSelectUnit}
          onCreateUnit={onCreateUnit}
        />
      )}

      {sheetName && !projectName && (
        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted-foreground truncate">{sheetName}</p>
        </div>
      )}

      {sheetName && projectName && (
        <div className="px-4 py-2 border-b border-border">
          <p className="text-xs text-muted-foreground truncate">{sheetName}</p>
        </div>
      )}

      {!hasRequiredFiles && (
        <div className="border-b border-border bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Upload both the wirelist and layout PDF to enable comparisons.
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "layout" | "list")}
        className="flex-1 flex flex-col min-h-0 gap-0"
      >
        <TabsList className="w-full justify-start rounded-none border-b px-2 h-10 bg-transparent">
          <TabsTrigger
            value="layout"
            className="gap-1.5 w-full data-[state=active]:bg-background"
          >
            <History className="h-3.5 w-3.5" />
            {currentLayoutRevision?.revisionInfo.displayVersion || projectRevision || "Layout"}
            {layoutRevisions.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {layoutRevisions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="gap-1.5 w-full data-[state=active]:bg-background"
          >
            <FileText className="h-3.5 w-3.5" />
            Wire List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="flex-1 min-h-0 mt-0 flex flex-col overflow-hidden h-full">
          <div className="border-b border-border px-2 py-2 space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 w-[175px] gap-2"
                disabled={!onOpenRevisionUpload || isRevisionUploadLoading}
                onClick={onOpenRevisionUpload}
              >
                <Upload className="h-4 w-4" />
                {isRevisionUploadLoading ? "Uploading..." : "Version"}
              </Button>
              <Button
                type="button"
                variant={isCompareMode ? "default" : "outline"}
                size="sm"
                className="gap-2 flex-1 w-[175px]"
                disabled={allRevisionCards.length < 2}
                onClick={isCompareMode ? onExitCompareMode : onEnterCompareMode}
              >
                <GitCompare className="h-4 w-4" />
                Compare
              </Button>
            </div>
          </div>

          {isCompareMode ? (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-4">
                {/* FROM selection */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">From</p>
                  <div className="grid grid-cols-2 gap-2">
                    {allRevisionCards.map((rev) => {
                      const isFrom = compareFromRevision?.filename === rev.filename
                      const isTo = compareToRevision?.filename === rev.filename
                      return (
                        <button
                          key={`from-${rev.filename}`}
                          type="button"
                          disabled={isTo}
                          onClick={() => onSelectCompareFrom?.(rev)}
                          className={cn(
                            "relative rounded-lg border-2 p-2.5 text-left transition-all",
                            isFrom
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : isTo
                                ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                                : "border-border bg-background hover:border-primary/50 hover:bg-background/50",
                          )}
                        >
                          {/* Selection indicator */}
                          <div className={cn(
                            "absolute top-2 right-2 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            isFrom ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                          )}>
                            {isFrom && <Check className="h-3 w-3" />}
                          </div>

                          <p className="text-sm font-medium pr-6">{rev.revisionInfo.displayVersion}</p>

                          {/* Hover overlay */}
                          <div className={cn(
                            "absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 opacity-0 transition-opacity",
                            !isFrom && !isTo && "hover:opacity-100",
                          )}>
                            <span className="text-sm font-medium">Select</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center">
                  <ArrowUpDown className="h-8 w-8 text-muted-foreground/40" />
                </div>

                {/* TO selection */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">To</p>
                  {compareFromRevision ? (
                    <div className="grid grid-cols-2 gap-2">
                      {allRevisionCards.map((rev) => {
                        const isFrom = compareFromRevision?.filename === rev.filename
                        const isTo = compareToRevision?.filename === rev.filename
                        return (
                          <button
                            key={`to-${rev.filename}`}
                            type="button"
                            disabled={isFrom}
                            onClick={() => onSelectCompareTo?.(rev)}
                            className={cn(
                              "relative rounded-lg border-2 p-2.5 text-left transition-all",
                              isTo
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : isFrom
                                  ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                                  : "border-border bg-background hover:border-primary/50 hover:bg-background/50",
                            )}
                          >
                            {/* Selection indicator */}
                            <div className={cn(
                              "absolute top-2 right-2 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              isTo ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                            )}>
                              {isTo && <Check className="h-3 w-3" />}
                            </div>

                            <p className="text-sm font-medium pr-6">{rev.revisionInfo.displayVersion}</p>

                            <div className={cn(
                              "absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 opacity-0 transition-opacity",
                              !isTo && !isFrom && "hover:opacity-100",
                            )}>
                              <span className="text-sm font-medium">Select</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/30 px-4 py-8 text-center">
                      <MousePointerClick className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Choose from<br />version first.
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm comparison button */}
                {compareFromRevision && compareToRevision && (
                  <Button
                    type="button"
                    className="w-full gap-2"
                    onClick={onConfirmCompare}
                  >
                    <GitCompare className="h-4 w-4" />
                    Compare {compareFromRevision.revisionInfo.displayVersion} → {compareToRevision.revisionInfo.displayVersion}
                  </Button>
                )}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {onSelectCurrentLayout && (
                  <CurrentLayoutPreviewItem
                    page={currentLayoutPage}
                    isSelected={isCurrentLayoutSelected}
                    onClick={onSelectCurrentLayout}
                    title={currentLayoutRevision?.revisionInfo.displayVersion || projectRevision || "Current Layout"}
                    onOpenWorkspace={layoutWorkspaceEndpoint ? () => setIsLayoutWorkspaceOpen(true) : undefined}
                  />
                )}
                {uploadedLayoutRevision && uploadedLayoutPage ? (
                  <CurrentLayoutPreviewItem
                    page={uploadedLayoutPage}
                    isSelected={isUploadedLayoutRevisionSelected}
                    onClick={onSelectUploadedLayoutRevision}
                    title={uploadedLayoutRevision.revisionInfo.displayVersion}
                    subtitle="Uploaded layout revision"
                    onOpenWorkspace={layoutWorkspaceEndpoint ? () => setIsLayoutWorkspaceOpen(true) : undefined}
                  />
                ) : null}
                {displayedLayoutRevisions.length === 0 && !uploadedLayoutRevision ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    <Layout className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p>No layout revisions found</p>
                  </div>
                ) : (
                  displayedLayoutRevisions.map((rev) => {
                    const isCurrent =
                      currentLayoutRevision?.filename === rev.filename
                    const isSelected = selectedLayoutRevision
                      ? selectedLayoutRevision.filename === rev.filename
                      : isCurrentLayoutSelected && isCurrent
                    return (
                      <RevisionListItem
                        key={rev.filename}
                        revision={rev}
                        isCurrent={isCurrent}
                        isSelected={isSelected}
                        onClick={() => onSelectLayoutRevision?.(rev)}
                        onDelete={() => onDeleteRevision?.(rev)}
                        canDelete={!isCurrent && Boolean(onDeleteRevision)}
                      />
                    )
                  })
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="list" className="flex-1 min-h-0 mt-0 flex flex-col overflow-hidden">
          {listPanel ?? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Original wire list navigation is unavailable.
            </div>
          )}
        </TabsContent>

      </Tabs>
      {layoutWorkspaceEndpoint ? (
        <LayoutPreviewModal
          endpoint={layoutWorkspaceEndpoint}
          isOpen={isLayoutWorkspaceOpen}
          onClose={() => setIsLayoutWorkspaceOpen(false)}
        />
      ) : null}
    </div>
  )
}
