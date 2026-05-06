"use client"

/**
 * ProjectSidePanel
 * 
 * A collapsible side panel that wraps the project detail page content.
 * Two tabs:
 *   - Revisions: Lists available revisions, allows uploading new revisions,
 *     and navigating between them. Active revision drives the assignment data.
 *   - Assignments: Groups assignment cards by SWS type for quick navigation.
 * 
 * The panel replaces the old "Upload Layout" modal and centralizes
 * revision management at the project level.
 */

import { useState, useMemo, useCallback } from "react"
import {
  History,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  FileText,
  Check,
  Clock,
  Trash2,
  LayoutTemplate,
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
import type { FileRevision, ProjectRevisionHistory, RevisionInfo } from "@/lib/revision/types"
import type { MappedAssignment } from "./project-assignment-mapping-modal"
import type { SwsTypeId, SwsTypeMetadata } from "@/lib/assignment/sws-detection"
import { SWS_TYPE_REGISTRY } from "@/lib/assignment/sws-detection"
import { SWS_ICON_MAP } from "@/components/projects/sws-type-grid"
import { ASSIGNMENT_STATUS_CONFIG, type AssignmentStatus } from "@/types/d380-assignment"
import type { LwcType } from "@/lib/workbook/types"
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types"
import type { ProjectManifest } from "@/types/project-manifest"
import type { LayoutPagePreview } from "@/lib/layout-matching"
import { LayoutPreviewModal } from "./layout-preview-modal"
import { ProjectUnitSwitcher } from "./project-unit-switcher"
import type { ProjectUnitRecord } from "@/types/d380-project-details"

// ============================================================================
// Types
// ============================================================================

interface ProjectSidePanelProps {
  /** Current project manifest */
  project: ProjectManifest
  /** Current revision string being viewed */
  activeRevision: string | null
  /** All fetched revision history */
  revisionHistory: ProjectRevisionHistory | null
  /** Whether revision history is loading */
  isRevisionLoading: boolean
  /** Assignment mappings for the current revision */
  assignments: MappedAssignment[]
  /** Rendered layout page previews for thumbnail display */
  layoutPages?: LayoutPagePreview[]
  /** Callback when user selects a different revision */
  onRevisionSelect?: (revision: FileRevision) => void
  /** Callback to open the revision upload flow */
  onUploadRevision?: () => void
  /** Callback when user clicks an assignment in the sidebar */
  onAssignmentClick?: (assignment: MappedAssignment) => void
  /** Whether the panel is expanded */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void
  /** Callback when a revision is deleted */
  onDeleteRevision?: (revision: FileRevision) => void
  /** Project units for the unit switcher */
  units?: ProjectUnitRecord[]
  /** Currently active unit id */
  currentUnitId?: string
  /** Callback when a unit is selected */
  onSelectUnit?: (unit: ProjectUnitRecord) => void
  /** Callback to open unit creation flow */
  onCreateUnit?: () => void
}

// Custom icon sizes — RAIL is landscape (301×226) while others are portrait (~81×154)
const SWS_ICON_SIZE: Record<SwsTypeId, { w: number; h: number }> = {
  BLANK: { w: 16, h: 16 },
  RAIL: { w: 24, h: 18 },
  BOX: { w: 16, h: 16 },
  PANEL: { w: 16, h: 16 },
  COMPONENT: { w: 16, h: 16 },
  UNDECIDED: { w: 16, h: 16 },
}

// Correct plural display labels for each SWS category
const SWS_PLURAL_LABELS: Record<SwsTypeId, string> = {
  BLANK: "Blanks",
  RAIL: "Rails",
  BOX: "Boxes",
  PANEL: "Panels",
  COMPONENT: "Components",
  UNDECIDED: "Undecided",
}

// Ordered SWS types for grouping display
const SWS_GROUP_ORDER: SwsTypeId[] = [
  "PANEL",
  "BOX",
  "RAIL",
  "COMPONENT",
  "BLANK",
  "UNDECIDED",
]

// Status badge variants
const STATUS_DOT_COLORS: Record<AssignmentStatus, string> = {
  NOT_STARTED: "bg-muted-foreground/40",
  IN_PROGRESS: "bg-blue-500",
  INCOMPLETE: "bg-amber-500",
  COMPLETE: "bg-emerald-500",
}

// ============================================================================
// Helper: Revision Card
// ============================================================================

function RevisionCard({
  revision,
  pairedRevision,
  isCurrent,
  isActive,
  onClick,
  onDelete,
  canDelete,
}: {
  revision: FileRevision
  pairedRevision?: FileRevision | null
  isCurrent: boolean
  isActive: boolean
  onClick: () => void
  onDelete?: () => void
  canDelete?: boolean
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
          "hover:bg-muted/50",
          isActive
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-transparent",
          isCurrent && !isActive && "border-border/50 bg-muted/30",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium truncate flex-1">
            {revision.revisionInfo.displayVersion}
          </span>
          {isCurrent && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
              Current
            </Badge>
          )}
          {isActive && !isCurrent && (
            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 pl-0.5">
          <FileSpreadsheet className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">
            {revision.category === "WIRE_LIST" ? revision.filename : pairedRevision?.filename || "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 pl-0.5">
          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">
            {revision.category === "LAYOUT" ? revision.filename : pairedRevision?.filename || "—"}
          </span>
        </div>
        {revision.lastModified && (
          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 pl-0.5">
            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
            {new Date(revision.lastModified).toLocaleDateString()}
          </p>
        )}
      </button>
      {canDelete && onDelete && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
  )
}

// ============================================================================
// Helper: Assignment Nav Item
// ============================================================================

function AssignmentNavItem({
  assignment,
  layoutPage,
  onClick,
}: {
  assignment: MappedAssignment
  layoutPage?: LayoutPagePreview | null
  onClick: () => void
}) {
  const status = (assignment.selectedStatus || "NOT_STARTED") as AssignmentStatus
  const statusConfig = ASSIGNMENT_STATUS_CONFIG[status]
  const dotColor = STATUS_DOT_COLORS[status]
  const displayTitle = (assignment.sheetName || assignment.sheetSlug || "Untitled").toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-10 w-14 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/50">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
            <span className="text-sm font-medium truncate group-hover:text-foreground text-foreground/80">
              {displayTitle}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 pl-3">
            <span className="text-[10px] text-muted-foreground">
              {statusConfig?.label || status}
            </span>
            <span className="text-muted-foreground/30 text-[10px]">·</span>
            <span className="text-[10px] text-muted-foreground">
              {assignment.rowCount} rows
            </span>
            {assignment.matchedLayoutPage && (
              <>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <span className="text-[10px] text-muted-foreground">
                  Pg {assignment.matchedLayoutPage}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// Helper: SWS Group Section
// ============================================================================

function SwsGroupSection({
  swsTypeId,
  assignments,
  layoutPages,
  onAssignmentClick,
}: {
  swsTypeId: SwsTypeId
  assignments: MappedAssignment[]
  layoutPages: LayoutPagePreview[]
  onAssignmentClick: (assignment: MappedAssignment) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const meta = SWS_TYPE_REGISTRY[swsTypeId]
  const iconPath = SWS_ICON_MAP[swsTypeId]
  const iconSize = SWS_ICON_SIZE[swsTypeId]
  const pluralLabel = SWS_PLURAL_LABELS[swsTypeId]

  // Resolve layout page for a given assignment via persisted page number
  const getLayoutPage = (assignment: MappedAssignment): LayoutPagePreview | null => {
    if (assignment.matchedLayoutPage) {
      return layoutPages.find(p => p.pageNumber === assignment.matchedLayoutPage) ?? null
    }
    return null
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 mb-1 w-full text-left hover:bg-muted/50 rounded-md transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
            !isOpen && "-rotate-90"
          )}
        />
        <Image
          src={iconPath}
          alt={meta.label}
          width={iconSize.w}
          height={iconSize.h}
          className="opacity-70"
        />
        <span className="text-lg font-semibold text-muted-foreground uppercase tracking-wider">
          {pluralLabel}
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto">
          {assignments.length}
        </Badge>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5">
          {assignments.map((assignment) => (
            <AssignmentNavItem
              key={assignment.sheetSlug}
              assignment={assignment}
              layoutPage={getLayoutPage(assignment)}
              onClick={() => onAssignmentClick(assignment)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectSidePanel({
  project,
  activeRevision,
  revisionHistory,
  isRevisionLoading,
  assignments,
  layoutPages = [],
  onRevisionSelect,
  onUploadRevision,
  onAssignmentClick,
  isExpanded = true,
  onExpandedChange,
  onDeleteRevision,
  units = [],
  currentUnitId,
  onSelectUnit,
  onCreateUnit,
}: ProjectSidePanelProps) {
  const [activeTab, setActiveTab] = useState<"revisions" | "assignments">("assignments")
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false)
  const layoutWorkspaceEndpoint = `/api/projects/${encodeURIComponent(project.id)}/layout-pdf`

  // Group assignments by SWS type
  const groupedAssignments = useMemo(() => {
    const groups: Partial<Record<SwsTypeId, MappedAssignment[]>> = {}
    for (const assignment of assignments) {
      const swsType = assignment.selectedSwsType || "UNDECIDED"
      if (!groups[swsType]) {
        groups[swsType] = []
      }
      groups[swsType]!.push(assignment)
    }
    return groups
  }, [assignments])

  // Ordered groups with assignments
  const orderedGroups = useMemo(() => {
    return SWS_GROUP_ORDER
      .filter((type) => groupedAssignments[type] && groupedAssignments[type]!.length > 0)
      .map((type) => ({
        type,
        assignments: groupedAssignments[type]!,
      }))
  }, [groupedAssignments])

  // Build paired revision list — each revision entry represents a wire list + layout pair
  const allRevisions = useMemo(() => {
    if (!revisionHistory) return []
    // Show wire list revisions as the primary items (each version is one entry)
    // Also include layout-only revisions not represented by a wire list
    const wireListVersions = new Set(
      revisionHistory.wireListRevisions.map(r => r.revisionInfo.displayVersion)
    )
    const layoutOnly = revisionHistory.layoutRevisions.filter(
      r => !wireListVersions.has(r.revisionInfo.displayVersion)
    )
    const combined = [...revisionHistory.wireListRevisions, ...layoutOnly]
    combined.sort((a, b) => b.revisionInfo.sortScore - a.revisionInfo.sortScore)
    return combined
  }, [revisionHistory])

  const currentRevisionLabel = activeRevision || project.revision || "Current"

  const handleToggleExpanded = useCallback(() => {
    onExpandedChange?.(!isExpanded)
  }, [isExpanded, onExpandedChange])

  // Collapsed state — just show a minimal icon strip
  if (!isExpanded) {
    return (
      <div className="flex flex-col items-center py-4 px-1 border-r border-border/30 bg-sidebar shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleExpanded}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Show project panel</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="mt-4 flex flex-col items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { onExpandedChange?.(true); setActiveTab("revisions"); }}
                  className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                >
                  <History className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Revisions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { onExpandedChange?.(true); setActiveTab("assignments"); }}
                  className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                >
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Assignments ({assignments.length})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 shrink-0 border-r gap-4 border-border/30 bg-sidebar flex flex-col overflow-hidden h-full">
      {/* Panel Header — Unit Switcher */}
      <div className="flex items-center border-b border-border/30">
        <div className="flex-1 min-w-0">
          <ProjectUnitSwitcher
            projectName={project.name}
            pdNumber={project.pdNumber}
            revision={project.revision}
            lwcLabel={project.lwcType ? LWC_TYPE_REGISTRY[project.lwcType].shortLabel : undefined}
            dueDate={project.dueDate?.toISOString?.() ?? (typeof project.dueDate === 'string' ? project.dueDate : undefined)}
            units={units}
            currentUnitId={currentUnitId}
            onSelectUnit={onSelectUnit}
            onCreateUnit={onCreateUnit}
          />
        </div>

      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "revisions" | "assignments")}
        className="flex-1 flex flex-col min-h-0 px-2"
      >
        <TabsList className="flex w-full flex-1 max-h-max bg-muted/50">
          <TabsTrigger value="revisions" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" />
            Revisions
          </TabsTrigger>
          <TabsTrigger value="assignments" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Assignments
          </TabsTrigger>
        </TabsList>

        {/* Revisions Tab */}
        <TabsContent value="revisions" className="flex-1 min-h-0 m-0 p-0">
          <ScrollArea className="h-full">
            <div className="px-3 py-3 flex flex-col gap-1">
              {/* Layout Workspace entry */}
              {layoutPages.length > 0 && (
                <div
                  className="w-full rounded-lg border border-border/50 mb-3 bg-muted/30 cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setIsLayoutModalOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setIsLayoutModalOpen(true)
                    }
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Layout Workspace
                      </p>
                      <span className="mt-1 block text-sm font-medium text-foreground">
                        {layoutPages[0].title || `Page ${layoutPages[0].pageNumber}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {layoutPages.length} pages
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Revision Badge */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-muted-foreground font-medium">
                  Active: <span className="font-mono text-foreground">{currentRevisionLabel}</span>
                </span>
              </div>

              {/* Upload New Revision */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mb-3 border-dashed"
                onClick={onUploadRevision}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Revision
              </Button>

              {/* Revision List */}
              {isRevisionLoading && (
                <div className="flex flex-col gap-2 px-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              )}

              {!isRevisionLoading && allRevisions.length === 0 && (
                <div className="text-center py-8 px-4">
                  <History className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No revision history yet
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Upload a workbook + layout pair to create the first revision
                  </p>
                </div>
              )}

              {!isRevisionLoading && allRevisions.map((rev) => {
                // Find paired revision (wire list → layout or vice versa)
                const paired = rev.category === "WIRE_LIST"
                  ? revisionHistory?.layoutRevisions.find(
                    r => r.revisionInfo.displayVersion === rev.revisionInfo.displayVersion
                  ) ?? null
                  : revisionHistory?.wireListRevisions.find(
                    r => r.revisionInfo.displayVersion === rev.revisionInfo.displayVersion
                  ) ?? null

                const isCurrent = rev.revisionInfo.displayVersion === currentRevisionLabel
                return (
                  <RevisionCard
                    key={`${rev.category}-${rev.revisionInfo.displayVersion}`}
                    revision={rev}
                    pairedRevision={paired}
                    isCurrent={isCurrent}
                    isActive={activeRevision === rev.revisionInfo.displayVersion}
                    onClick={() => onRevisionSelect?.(rev)}
                    onDelete={() => onDeleteRevision?.(rev)}
                    canDelete={!isCurrent && Boolean(onDeleteRevision)}
                  />
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="flex-1 min-h-0 m-0 p-0">
          <ScrollArea className="h-full">
            <div className="px-1 py-3">
              {/* Summary */}
              <div className="flex items-center justify-between mb-3 px-3">
                <span className="text-xs text-muted-foreground font-medium">
                  {assignments.length} assignments
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {orderedGroups.length} groups
                </span>
              </div>

              {assignments.length === 0 && (
                <div className="text-center py-8 px-4">
                  <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No assignments mapped
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Open the mapping editor to classify sheets
                  </p>
                </div>
              )}

              {orderedGroups.map(({ type, assignments: groupAssignments }) => (
                <SwsGroupSection
                  key={type}
                  swsTypeId={type}
                  assignments={groupAssignments}
                  layoutPages={layoutPages}
                  onAssignmentClick={onAssignmentClick ?? (() => { })}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>


      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleExpanded}
        className="h-7 w-7 p-0 shrink-0 mr-2"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Layout Preview Modal — all pages */}
      {layoutPages.length > 0 && (
        <LayoutPreviewModal
          endpoint={layoutWorkspaceEndpoint}
          isOpen={isLayoutModalOpen}
          onClose={() => setIsLayoutModalOpen(false)}
        />
      )}
    </div>
  )
}
