"use client"

/**
 * useRevisionPanel
 *
 * Custom hook that encapsulates the full revision-panel lifecycle:
 * state, effects, callbacks, sidebar JSX, and overlay modals.
 *
 * Returns a state object with `sidebar` / `overlays` React nodes that the
 * caller can drop straight into WorkspaceLayout slots, plus wire-list state
 * needed by the sheet content area.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { History, GitCompare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RevisionSidebar } from "./revision-sidebar"
import { RevisionComparisonModal } from "./revision-comparison-modal"
import { RevisionWireListPanel } from "./revision-wire-list-panel"
import { ProjectUploadFlow, type RevisionUploadCompleteResult } from "@/components/projects/project-upload-flow"
import { ProjectUnitCreateFlow } from "@/components/projects/project-unit-create-flow"
import { useProjectRevisions } from "@/hooks/use-project-revisions"
import { useProjectDetailsV2 } from "@/hooks/use-project-details-v2"
import { useToast } from "@/hooks/use-toast"
import { useLayout } from "@/contexts/layout-context"
import type { FileRevision } from "@/lib/revision/types"
import { LWC_TYPE_REGISTRY, type LwcType, type SemanticWireListRow, type ProjectModel } from "@/lib/workbook/types"
import type { ProjectManifest } from "@/types/project-manifest"
import { parseWorkbook } from "@/lib/workbook/parse-workbook"
import { buildProjectModel, findSheetBySlug } from "@/lib/workbook/build-project-model"
import { normalizeSheetName } from "@/lib/workbook/normalize-sheet-name"
import {
  cleanupPreviewUrls,
  renderPdfPagesToImages,
  type LayoutPagePreview,
} from "@/lib/layout-matching"
import { loadRevisionSelection, saveRevisionSelection } from "@/lib/persistence/project-storage"

// ============================================================================
// Types
// ============================================================================

export interface UseRevisionPanelOptions {
  /** Project ID */
  projectId: string
  /** Active project model for layout matching */
  project?: ProjectModel | ProjectManifest | null
  /** Current sheet name */
  sheetName?: string
  /** Project name for display */
  projectName?: string
  /** Current sheet's semantic rows (for comparison) */
  currentRows?: SemanticWireListRow[]
  /** Current sheet slug */
  sheetSlug?: string
  /** Whether to show revision panel by default */
  defaultExpanded?: boolean
}

export interface RevisionPanelState {
  sidebar: React.ReactNode
  overlays: React.ReactNode
  activeRows: SemanticWireListRow[]
  activeRowId: string | null
  clearActiveRow: () => void
  activeWireListRevision: FileRevision | null
  isRevisionLoading: boolean
}

// ============================================================================
// Toggle Button (shown when sidebar is collapsed)
// ============================================================================

function RevisionToggleButton({
  onClick,
  revisionCount,
  hasComparison,
}: {
  onClick: () => void
  revisionCount: number
  hasComparison: boolean
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Revisions</span>
            {revisionCount > 1 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {revisionCount}
              </Badge>
            )}
            {hasComparison && (
              <GitCompare className="h-3.5 w-3.5 text-amber-500" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Show revision history</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useRevisionPanel({
  projectId,
  project,
  sheetName,
  projectName,
  currentRows = [],
  sheetSlug,
  defaultExpanded = false,
}: UseRevisionPanelOptions): RevisionPanelState {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [activeWireListRevision, setActiveWireListRevision] = useState<FileRevision | null>(null)
  const [activeLayoutRevision, setActiveLayoutRevision] = useState<FileRevision | null>(null)
  const [activeRows, setActiveRows] = useState<SemanticWireListRow[]>(currentRows)
  const [isRevisionLoading, setIsRevisionLoading] = useState(false)
  const [isLayoutLoading, setIsLayoutLoading] = useState(false)
  const [comparisonSourceRows, setComparisonSourceRows] = useState<SemanticWireListRow[]>([])
  const [comparisonTargetRows, setComparisonTargetRows] = useState<SemanticWireListRow[]>(currentRows)
  const [isComparisonLoading, setIsComparisonLoading] = useState(false)
  const [isRevisionUploadDialogOpen, setIsRevisionUploadDialogOpen] = useState(false)
  const [isRevisionUploadLoading, setIsRevisionUploadLoading] = useState(false)
  const [uploadedWireListRevision, setUploadedWireListRevision] = useState<FileRevision | null>(null)
  const [uploadedLayoutRevision, setUploadedLayoutRevision] = useState<FileRevision | null>(null)
  const [uploadedRows, setUploadedRows] = useState<SemanticWireListRow[]>([])
  const [uploadedLayoutPage, setUploadedLayoutPage] = useState<LayoutPagePreview | null>(null)
  const [uploadedLayoutPages, setUploadedLayoutPages] = useState<LayoutPagePreview[]>([])
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [compareFromRevision, setCompareFromRevision] = useState<FileRevision | null>(null)
  const [compareToRevision, setCompareToRevision] = useState<FileRevision | null>(null)
  const hasRestoredSelectionRef = useRef(false)
  const isMountedRef = useRef(false)
  const baselineLayoutPagesRef = useRef<LayoutPagePreview[] | null>(null)
  const { toast } = useToast()
  const {
    layoutPages,
    setLayoutPages,
    setCompatibility,
  } = useLayout()

  // Fetch revision history
  const {
    history,
    isLoading,
    hasMultipleRevisions,
    isComparisonOpen,
    openComparison,
    closeComparison,
    selectedSourceRevision,
    comparisonTarget,
    refresh,
  } = useProjectRevisions({ projectId, pdNumber: project?.pdNumber })

  // Project details V2 (units)
  const {
    projectRecord: projectDetailsRecord,
    createUnit,
    switchUnit,
  } = useProjectDetailsV2(projectId)

  const [isUnitCreateFlowOpen, setIsUnitCreateFlowOpen] = useState(false)

  const handleCreateUnit = useCallback(async (input: import('@/lib/services/contracts/project-details-v2-service').CreateProjectUnitInput) => {
    await createUnit(input)
  }, [createUnit])

  const units = projectDetailsRecord?.units ?? []
  const currentUnitId = projectDetailsRecord?.currentUnitId

  // Derive LWC label from the first unit or project model
  const lwcLabel = useMemo(() => {
    if (units.length > 0) {
      const activeUnit = units.find(u => u.id === currentUnitId) ?? units[0]
      const lwc = activeUnit?.lwcType as LwcType | undefined
      return lwc && LWC_TYPE_REGISTRY[lwc] ? LWC_TYPE_REGISTRY[lwc].shortLabel : undefined
    }
    if (project?.lwcType && LWC_TYPE_REGISTRY[project.lwcType]) {
      return LWC_TYPE_REGISTRY[project.lwcType].shortLabel
    }
    return undefined
  }, [units, currentUnitId, project?.lwcType])

  // Synthesize a "current" wire list revision from the project model
  // when Legal Drawings history doesn't exist yet (fresh upload).
  const syntheticCurrentWireList = useMemo<FileRevision | null>(() => {
    if (history?.currentWireList) return null // real history available
    if (!project) return null
    const revision = project.revision || 'Current'
    return {
      filename: project.filename || projectId,
      filePath: '',
      category: 'WIRE_LIST',
      revisionInfo: {
        revision,
        isModified: false,
        displayVersion: revision,
        sortScore: Number.MAX_SAFE_INTEGER,
      },
      fileSize: 0,
      lastModified: '',
    }
  }, [history?.currentWireList, project, projectId])

  const effectiveCurrentWireList = history?.currentWireList ?? syntheticCurrentWireList

  useEffect(() => {
    if (activeLayoutRevision) {
      return
    }

    if (layoutPages.length > 0) {
      baselineLayoutPagesRef.current = layoutPages
    }
  }, [activeLayoutRevision, layoutPages])

  const currentLayoutPage: LayoutPagePreview | null = null
  const hasSheetFile = Boolean(project && sheetSlug)
  const hasLayoutFile = Boolean(
    currentLayoutPage ||
    history?.currentLayout ||
    (history?.layoutRevisions.length ?? 0) > 0,
  )
  const hasRequiredFiles = hasSheetFile && hasLayoutFile

  // Stabilise the currentRows reference so effects don't loop when the parent
  // produces a structurally-identical but referentially-new array each render.
  const stableCurrentRowsRef = useRef(currentRows)
  if (
    currentRows !== stableCurrentRowsRef.current &&
    (currentRows.length !== stableCurrentRowsRef.current.length ||
      currentRows.some((r, i) => r.__rowId !== stableCurrentRowsRef.current[i]?.__rowId))
  ) {
    stableCurrentRowsRef.current = currentRows
  }
  const stableCurrentRows = stableCurrentRowsRef.current

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!activeWireListRevision) {
      setActiveRows(stableCurrentRows)
    }
  }, [activeWireListRevision, stableCurrentRows])

  useEffect(() => {
    if (!isComparisonOpen) {
      setComparisonTargetRows(stableCurrentRows)
    }
  }, [stableCurrentRows, isComparisonOpen])

  useEffect(() => {
    return () => {
      cleanupPreviewUrls(uploadedLayoutPages)
    }
  }, [uploadedLayoutPages])

  const loadRevisionRows = useCallback(async (revision: FileRevision): Promise<SemanticWireListRow[]> => {
    if (!history?.folderName) {
      throw new Error("Revision source folder is unavailable")
    }

    const url = `/api/projects/files?project=${encodeURIComponent(history.folderName)}&file=${encodeURIComponent(revision.filename)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load revision file: ${revision.filename}`)
    }

    const blob = await response.blob()
    const revisionFile = new File([blob], revision.filename, { type: blob.type || "application/octet-stream" })
    const result = await parseWorkbook(revisionFile)

    if (!result.success || !result.workbook) {
      throw new Error(result.errors.join("; ") || `Failed to parse revision workbook: ${revision.filename}`)
    }

    const projectModel = buildProjectModel(result.workbook)
    const slug = sheetSlug || normalizeSheetName(sheetName || "")
    const fallbackSummary = projectModel.sheets.find((sheet) => normalizeSheetName(sheet.name) === slug)
    const matchedSheet = findSheetBySlug(projectModel, slug)
      ?? (fallbackSummary ? { summary: fallbackSummary, data: projectModel.sheetData[fallbackSummary.id] } : null)

    return matchedSheet?.data.semanticRows ?? []
  }, [history?.folderName, sheetName, sheetSlug])

  const persistSelection = useCallback((wireFilename: string | null, layoutFilename: string | null) => {
    if (!sheetSlug) {
      return
    }

    void saveRevisionSelection(projectId, sheetSlug, {
      wireListFilename: wireFilename,
      layoutFilename,
    })
  }, [projectId, sheetSlug])

  const loadLayoutRevision = useCallback(async (revision: FileRevision, options?: { announce?: boolean }) => {
    if (!history?.folderName || !project) {
      throw new Error("Layout revision source is unavailable")
    }

    const url = `/api/projects/files?project=${encodeURIComponent(history.folderName)}&file=${encodeURIComponent(revision.filename)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load layout revision: ${revision.filename}`)
    }

    const blob = await response.blob()
    const pdfFile = new File([blob], revision.filename, { type: blob.type || "application/pdf" })
    const pages = await renderPdfPagesToImages(pdfFile, {
      scale: 1.5,
      extractFullText: true,
    })

    cleanupPreviewUrls(layoutPages)
    setLayoutPages(pages)
    setCompatibility(null)

    if (options?.announce !== false) {
      toast({
        title: "Layout revision applied",
        description: `${revision.revisionInfo.displayVersion} layout loaded with ${pages.length} pages.`,
      })
    }
  }, [history?.folderName, layoutPages, project, projectId, setCompatibility, setLayoutPages, toast])

  const selectCurrentSheet = useCallback(() => {
    if (!isMountedRef.current) {
      return
    }

    setActiveWireListRevision(null)
    setActiveRows(currentRows)
    setActiveRowId(null)
    persistSelection(null, activeLayoutRevision?.filename ?? null)
  }, [activeLayoutRevision?.filename, currentRows, persistSelection])

  const selectCurrentLayout = useCallback(async () => {
    if (!isMountedRef.current) {
      return
    }

    if (!history?.currentLayout) {
      if (baselineLayoutPagesRef.current) {
        setLayoutPages(baselineLayoutPagesRef.current)
      }
      setActiveLayoutRevision(null)
      persistSelection(activeWireListRevision?.filename ?? null, null)
      return
    }

    setIsLayoutLoading(true)
    try {
      await loadLayoutRevision(history.currentLayout, { announce: true })

      if (!isMountedRef.current) {
        return
      }

      setActiveLayoutRevision(null)
      persistSelection(activeWireListRevision?.filename ?? null, null)
    } catch (error) {
      if (isMountedRef.current) {
        console.error('[RevisionPanel] Failed to restore current layout:', error)
        toast({
          title: 'Current layout failed',
          description: error instanceof Error ? error.message : 'Unable to restore the current layout.',
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setIsLayoutLoading(false)
      }
    }
  }, [activeWireListRevision?.filename, history?.currentLayout, loadLayoutRevision, persistSelection, toast])

  // Handle revision selection (navigate to that version)
  const handleSelectWireListRevision = useCallback(async (revision: FileRevision, options?: { persist?: boolean }) => {
    if (!isMountedRef.current) {
      return
    }

    setIsRevisionLoading(true)
    try {
      const rows = await loadRevisionRows(revision)

      if (!isMountedRef.current) {
        return
      }

      setActiveWireListRevision(revision)
      setActiveRows(rows)
      setActiveRowId(null)
      if (options?.persist !== false) {
        persistSelection(revision.filename, activeLayoutRevision?.filename ?? null)
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('[RevisionPanel] Failed to load wire list revision:', error)
      }
    } finally {
      if (isMountedRef.current) {
        setIsRevisionLoading(false)
      }
    }
  }, [activeLayoutRevision?.filename, loadRevisionRows, persistSelection])

  const handleSelectLayoutRevision = useCallback(async (revision: FileRevision, options?: { persist?: boolean; announce?: boolean }) => {
    if (!isMountedRef.current) {
      return
    }

    setIsLayoutLoading(true)
    try {
      await loadLayoutRevision(revision, { announce: options?.announce })

      if (!isMountedRef.current) {
        return
      }

      setActiveLayoutRevision(revision)
      if (options?.persist !== false) {
        persistSelection(activeWireListRevision?.filename ?? null, revision.filename)
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('[RevisionPanel] Failed to load layout revision:', error)
        toast({
          title: 'Layout revision failed',
          description: error instanceof Error ? error.message : 'Unable to load selected layout revision.',
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setIsLayoutLoading(false)
      }
    }
  }, [activeWireListRevision?.filename, loadLayoutRevision, persistSelection, toast])

  const handleUploadLayoutRevision = useCallback(async (file: File) => {
    if (!isMountedRef.current) {
      return
    }

    setIsLayoutLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('baseRevision', activeLayoutRevision?.revisionInfo.revision ?? history?.currentLayout?.revisionInfo.revision ?? 'UPLOADED')

      const response = await fetch(`/api/projects/revisions/${encodeURIComponent(projectId)}/files`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Layout upload failed' })) as { error?: string }
        throw new Error(payload.error || 'Layout upload failed')
      }

      const payload = await response.json() as { revision: FileRevision }
      refresh()
      await handleSelectLayoutRevision(payload.revision, { persist: true, announce: true })

      if (isMountedRef.current) {
        toast({
          title: 'Layout revision uploaded',
          description: `${payload.revision.filename} is now active for ${sheetName || sheetSlug || 'this sheet'}.`,
        })
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('[RevisionPanel] Failed to upload layout revision:', error)
        toast({
          title: 'Layout upload failed',
          description: error instanceof Error ? error.message : 'Unable to upload the replacement layout file.',
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setIsLayoutLoading(false)
      }
    }
  }, [activeLayoutRevision?.revisionInfo.revision, handleSelectLayoutRevision, history?.currentLayout?.revisionInfo.revision, projectId, refresh, sheetName, sheetSlug, toast])

  useEffect(() => {
    if (!history || !sheetSlug || hasRestoredSelectionRef.current) {
      return
    }

    hasRestoredSelectionRef.current = true

    void loadRevisionSelection(projectId, sheetSlug).then(async (selection) => {
      if (!isMountedRef.current) {
        return
      }

      const wireRevision = selection.wireListFilename
        ? history.wireListRevisions.find((revision) => revision.filename === selection.wireListFilename) ?? null
        : null
      const layoutRevision = selection.layoutFilename
        ? history.layoutRevisions.find((revision) => revision.filename === selection.layoutFilename) ?? null
        : null

      if (wireRevision) {
        await handleSelectWireListRevision(wireRevision, { persist: false })
      }

      if (layoutRevision) {
        await handleSelectLayoutRevision(layoutRevision, { persist: false, announce: false })
      }
    }).catch((error) => {
      if (isMountedRef.current) {
        console.error('[RevisionPanel] Failed to restore revision selection:', error)
      }
    })
  }, [handleSelectLayoutRevision, handleSelectWireListRevision, history, projectId, sheetSlug])

  // Handle comparison open
  const handleOpenComparison = useCallback((
    source: FileRevision,
    target: FileRevision,
    options?: { sourceRows?: SemanticWireListRow[]; targetRows?: SemanticWireListRow[] },
  ) => {
    if (!isMountedRef.current) {
      return
    }

    setComparisonSourceRows(options?.sourceRows ?? [])
    setComparisonTargetRows(options?.targetRows ?? activeRows)
    setIsComparisonLoading(true)
    openComparison(source, target)

    if (options?.sourceRows) {
      setIsComparisonLoading(false)
      return
    }

    loadRevisionRows(source)
      .then((rows) => {
        if (isMountedRef.current) {
          setComparisonSourceRows(rows)
        }
      })
      .catch((error) => {
        if (isMountedRef.current) {
          console.error('[RevisionPanel] Failed to load comparison revision:', error)
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsComparisonLoading(false)
        }
      })
  }, [activeRows, loadRevisionRows, openComparison])

  const handleRevisionUploadComplete = useCallback((result: RevisionUploadCompleteResult) => {
    cleanupPreviewUrls(uploadedLayoutPages)
    setUploadedWireListRevision(result.wireListRevision ?? null)
    setUploadedLayoutRevision(result.layoutRevision ?? null)
    setUploadedRows(result.matchedRows)
    setUploadedLayoutPage(result.matchedLayoutPage)
    setUploadedLayoutPages(result.layoutPages)
    setIsRevisionUploadDialogOpen(false)
    setIsRevisionUploadLoading(false)
    void refresh()

    const displayVersion = result.wireListRevision?.revisionInfo.displayVersion
      ?? result.layoutRevision?.revisionInfo.displayVersion
      ?? "UPLOADED";

    if (result.wireListRevision && effectiveCurrentWireList) {
      handleOpenComparison(effectiveCurrentWireList, result.wireListRevision, {
        sourceRows: currentRows,
        targetRows: result.matchedRows,
      })
    }

    const updatedFile = result.wireListRevision && result.layoutRevision
      ? "Revision pair"
      : result.wireListRevision ? "Wire list" : "Layout";
    toast({
      title: `${updatedFile} uploaded`,
      description: `${displayVersion} was uploaded with ${result.layoutPages.length} layout pages.`,
    })
  }, [currentRows, effectiveCurrentWireList, handleOpenComparison, refresh, toast, uploadedLayoutPages])

  const handleSelectUploadedRevision = useCallback(() => {
    if (!uploadedWireListRevision || !uploadedLayoutRevision) {
      return
    }

    if (!isMountedRef.current) {
      return
    }

    cleanupPreviewUrls(layoutPages)
    setLayoutPages(uploadedLayoutPages)
    setCompatibility(null)
    setActiveWireListRevision(uploadedWireListRevision)
    setActiveLayoutRevision(uploadedLayoutRevision)
    setActiveRows(uploadedRows)
    setActiveRowId(null)
    persistSelection(uploadedWireListRevision.filename, uploadedLayoutRevision.filename)

    toast({
      title: "Revision activated",
      description: `${uploadedLayoutRevision.revisionInfo.displayVersion} is now active for ${sheetName || sheetSlug || 'this sheet'}.`,
    })
  }, [layoutPages, persistSelection, setCompatibility, setLayoutPages, sheetName, sheetSlug, toast, uploadedLayoutPages, uploadedLayoutRevision, uploadedRows, uploadedWireListRevision])

  const handleEnterCompareMode = useCallback(() => {
    setIsCompareMode(true)
    setCompareFromRevision(null)
    setCompareToRevision(null)
  }, [])

  const handleExitCompareMode = useCallback(() => {
    setIsCompareMode(false)
    setCompareFromRevision(null)
    setCompareToRevision(null)
  }, [])

  const handleConfirmCompare = useCallback(async () => {
    if (!compareFromRevision || !compareToRevision) return

    setIsCompareMode(false)
    setIsComparisonLoading(true)
    openComparison(compareFromRevision, compareToRevision)

    const isCurrentFrom = effectiveCurrentWireList?.filename === compareFromRevision.filename
    const isCurrentTo = effectiveCurrentWireList?.filename === compareToRevision.filename

    try {
      const [fromRows, toRows] = await Promise.all([
        isCurrentFrom ? Promise.resolve(currentRows) : loadRevisionRows(compareFromRevision),
        isCurrentTo ? Promise.resolve(currentRows) : loadRevisionRows(compareToRevision),
      ])

      if (isMountedRef.current) {
        setComparisonSourceRows(fromRows)
        setComparisonTargetRows(toRows)
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('[RevisionPanel] Failed to load comparison revisions:', error)
        toast({
          title: 'Comparison failed',
          description: error instanceof Error ? error.message : 'Unable to load revision data for comparison.',
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setIsComparisonLoading(false)
      }
    }
  }, [compareFromRevision, compareToRevision, currentRows, effectiveCurrentWireList?.filename, loadRevisionRows, openComparison, toast])

  const handleDeleteRevision = useCallback(async (revision: FileRevision) => {
    if (!isMountedRef.current) return

    const confirmed = window.confirm(
      `Delete ${revision.filename}? This will permanently remove the file.`
    )
    if (!confirmed) return

    try {
      const pdParam = project?.pdNumber ? `?pdNumber=${encodeURIComponent(project.pdNumber)}` : ""
      const response = await fetch(
        `/api/projects/revisions/${encodeURIComponent(projectId)}/files/${encodeURIComponent(revision.filename)}${pdParam}`,
        { method: "DELETE" },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Delete failed" })) as { error?: string }
        throw new Error(payload.error || "Delete failed")
      }

      // If the deleted revision was actively selected, fall back to current
      if (activeWireListRevision?.filename === revision.filename) {
        setActiveWireListRevision(null)
        setActiveRows(currentRows)
        setActiveRowId(null)
      }
      if (activeLayoutRevision?.filename === revision.filename) {
        setActiveLayoutRevision(null)
        // Restore baseline layout
        if (baselineLayoutPagesRef.current) {
          setLayoutPages(baselineLayoutPagesRef.current)
        }
      }

      refresh()

      toast({
        title: "Revision deleted",
        description: `${revision.filename} has been removed.`,
      })
    } catch (error) {
      if (isMountedRef.current) {
        console.error("[RevisionPanel] Failed to delete revision:", error)
        toast({
          title: "Delete failed",
          description: error instanceof Error ? error.message : "Unable to delete revision.",
          variant: "destructive",
        })
      }
    }
  }, [activeLayoutRevision?.filename, activeWireListRevision?.filename, currentRows, projectId, refresh, setLayoutPages, toast])

  // Calculate total revision count
  const totalRevisions =
    (history?.wireListRevisions.length || 0) +
    (history?.layoutRevisions.length || 0)
  const shouldShowSidebar = Boolean(hasSheetFile)

  // Build sidebar node
  const sidebarNode = (
    <>
      {isExpanded && shouldShowSidebar && (
        <RevisionSidebar
          wireListRevisions={history?.wireListRevisions ?? []}
          layoutRevisions={history?.layoutRevisions ?? []}
          currentWireListRevision={effectiveCurrentWireList}
          currentLayoutRevision={history?.currentLayout ?? null}
          selectedWireListRevision={activeWireListRevision}
          selectedLayoutRevision={activeLayoutRevision}
          currentLayoutPage={currentLayoutPage}
          sheetName={sheetName}
          projectName={projectName}
          projectRevision={project?.revision}
          onSelectWireListRevision={handleSelectWireListRevision}
          onSelectLayoutRevision={handleSelectLayoutRevision}
          onSelectCurrentLayout={selectCurrentLayout}
          onUploadLayoutRevision={handleUploadLayoutRevision}
          isLayoutLoading={isLayoutLoading}
          isRevisionUploadLoading={isRevisionUploadLoading}
          hasRequiredFiles={hasRequiredFiles}
          onOpenRevisionUpload={() => setIsRevisionUploadDialogOpen(true)}
          uploadedLayoutPage={uploadedLayoutPage}
          uploadedLayoutRevision={uploadedLayoutRevision}
          uploadedWireListRevision={uploadedWireListRevision}
          onSelectUploadedLayoutRevision={handleSelectUploadedRevision}
          isUploadedLayoutRevisionSelected={Boolean(
            uploadedLayoutRevision &&
            uploadedWireListRevision &&
            activeLayoutRevision?.filename === uploadedLayoutRevision.filename &&
            activeWireListRevision?.filename === uploadedWireListRevision.filename
          )}
          isCompareMode={isCompareMode}
          onEnterCompareMode={handleEnterCompareMode}
          onExitCompareMode={handleExitCompareMode}
          compareFromRevision={compareFromRevision}
          compareToRevision={compareToRevision}
          onSelectCompareFrom={setCompareFromRevision}
          onSelectCompareTo={setCompareToRevision}
          onConfirmCompare={handleConfirmCompare}
          onOpenComparison={handleOpenComparison}
          onSelectCurrentSheet={selectCurrentSheet}
          isCurrentSheetSelected={!activeWireListRevision}
          isCurrentLayoutSelected={!activeLayoutRevision}
          listPanel={(
            <RevisionWireListPanel
              rows={activeRows}
              projectId={projectId}
              sheetName={sheetName || sheetSlug || "sheet"}
              activeRowId={activeRowId}
              onScrollToRow={setActiveRowId}
            />
          )}
          collapsed={false}
          onCollapsedChange={(collapsed) => setIsExpanded(!collapsed)}
          onDeleteRevision={handleDeleteRevision}
          units={units}
          currentUnitId={currentUnitId}
          pdNumber={project?.pdNumber}
          lwcLabel={lwcLabel}
          dueDate={project?.dueDate?.toISOString?.() ?? (typeof project?.dueDate === 'string' ? project.dueDate : undefined)}
          onSelectUnit={(unit) => {
            void switchUnit(unit.id)
          }}
          onCreateUnit={() => setIsUnitCreateFlowOpen(true)}
          layoutWorkspaceEndpoint={`/api/projects/${encodeURIComponent(projectId)}/layout-pdf`}
        />
      )}

      {/* Toggle button (shown when collapsed) */}
      {!isExpanded && shouldShowSidebar && (
        <div className="mb-4 flex items-center justify-start px-2 shrink-0">
          <RevisionToggleButton
            onClick={() => setIsExpanded(true)}
            revisionCount={history?.wireListRevisions.length || 0}
            hasComparison={hasMultipleRevisions}
          />
        </div>
      )}
    </>
  )

  // Build overlay node (modals / dialogs)
  const overlayNode = (
    <>
      <RevisionComparisonModal
        open={isComparisonOpen}
        onOpenChange={(open) => {
          if (!open) {
            setComparisonSourceRows([])
            setComparisonTargetRows(currentRows)
            closeComparison()
          }
        }}
        sourceRevision={selectedSourceRevision}
        targetRevision={comparisonTarget}
        sourceRows={comparisonSourceRows}
        targetRows={comparisonTargetRows}
        sheetName={sheetName}
        isLoading={isComparisonLoading || (comparisonSourceRows.length === 0 && isComparisonOpen)}
      />

      <Dialog open={isRevisionUploadDialogOpen} onOpenChange={setIsRevisionUploadDialogOpen}>
        <DialogContent className="max-h-[90vh] min-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Revision Pair</DialogTitle>
            <DialogDescription>
              Upload the next workbook and layout PDF for {projectName || projectId}. The flow will match the active sheet and add the new layout revision item to the sidebar.
            </DialogDescription>
          </DialogHeader>
          <ProjectUploadFlow
            mode="revision"
            projectId={projectId}
            currentSheetSlug={sheetSlug}
            initialProjectName={projectName}
            initialPdNumber={project?.pdNumber}
            initialUnitNumber={project?.unitNumber}
            initialRevision={project?.revision}
            initialLwcType={project?.lwcType}
            initialDueDate={project?.dueDate instanceof Date ? project.dueDate : undefined}
            onCancel={() => {
              if (!isRevisionUploadLoading) {
                setIsRevisionUploadDialogOpen(false)
              }
            }}
            onRevisionComplete={(result) => {
              setIsRevisionUploadLoading(true)
              handleRevisionUploadComplete(result)
            }}
          />
        </DialogContent>
      </Dialog>

      <ProjectUnitCreateFlow
        open={isUnitCreateFlowOpen}
        onClose={() => setIsUnitCreateFlowOpen(false)}
        projectId={projectId}
        projectName={projectName || projectId}
        defaultPdNumber={project?.pdNumber}
        defaultUnitNumber={project?.unitNumber}
        defaultLwcType={project?.lwcType}
        defaultRevision={project?.revision}
        existingUnits={units}
        onCreateUnit={handleCreateUnit}
        onUploadRevision={(seed) => {
          // Open the revision upload dialog seeded with unit values
          setIsUnitCreateFlowOpen(false)
          setIsRevisionUploadDialogOpen(true)
          // The upload flow will pick up values from the project model
          // For full seed integration, the parent page handles this
        }}
      />
    </>
  )

  return {
    sidebar: sidebarNode,
    overlays: overlayNode,
    activeRows,
    activeRowId,
    clearActiveRow: () => setActiveRowId(null),
    activeWireListRevision,
    isRevisionLoading,
  }
}
