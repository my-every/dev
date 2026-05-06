'use client'

/**
 * Wire List Standalone Tool
 * 
 * A complete wire list management tool that can be embedded anywhere.
 * Integrates project upload, project selection, and wire list viewing.
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet,
  Upload,
  FolderOpen,
  ChevronRight,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Trash2,
  Plus,
  Layers,
  BookOpen,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { SemanticWireList } from '@/components/wire-list/semantic-wire-list'
import { useProjectContext } from '@/contexts/project-context'
import type { ProjectManifest } from '@/types/project-manifest'
import { parseWorkbook, validateWorkbookFile } from '@/lib/workbook/parse-workbook'
import { buildProjectModel } from '@/lib/workbook/build-project-model'
import { getOperationalSheets, getReferenceSheets } from '@/lib/workbook/build-project-model'
import { ACCEPTED_FILE_EXTENSIONS } from '@/lib/workbook/constants'
import { cn } from '@/lib/utils'
import type { ProjectSheetSummary } from '@/lib/workbook/types'

type ViewMode = 'projects' | 'sheets' | 'viewer'

export function WireListStandaloneTool() {
  const {
    currentProject,
    allProjects,
    loadProject,
    deleteProject,
    saveProject,
    clearCurrentProject,
    isLoading,
  } = useProjectContext()

  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get sheets from current project
  const operationalSheets = useMemo(() => {
    if (!currentProject) return []
    return getOperationalSheets(currentProject)
  }, [currentProject])

  const referenceSheets = useMemo(() => {
    if (!currentProject) return []
    return getReferenceSheets(currentProject)
  }, [currentProject])

  // Get selected sheet data
  const selectedSheet = useMemo(() => {
    if (!currentProject || !selectedSheetId) return null
    const summary = currentProject.sheets.find((s) => s.id === selectedSheetId)
    const data = currentProject.sheetData[selectedSheetId]
    if (!summary || !data) return null
    return { summary, data }
  }, [currentProject, selectedSheetId])

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const excelFile = fileArray.find(f =>
      ACCEPTED_FILE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
    )

    if (!excelFile) {
      setUploadError('Please select an Excel workbook file')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const validation = validateWorkbookFile(excelFile)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid file')
      }

      const result = await parseWorkbook(excelFile)
      if (!result.success || !result.workbook) {
        throw new Error(result.errors.join('; ') || 'Failed to parse workbook')
      }

      const projectModel = buildProjectModel(result.workbook)
      saveProject(projectModel)
      setViewMode('sheets')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setUploadError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }, [saveProject])

  // Handle project selection
  const handleSelectProject = useCallback((projectId: string) => {
    loadProject(projectId)
    setSelectedSheetId(null)
    setViewMode('sheets')
  }, [loadProject])

  // Handle sheet selection
  const handleSelectSheet = useCallback((sheetId: string) => {
    setSelectedSheetId(sheetId)
    setViewMode('viewer')
  }, [])

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (viewMode === 'viewer') {
      setViewMode('sheets')
      setSelectedSheetId(null)
    } else if (viewMode === 'sheets') {
      setViewMode('projects')
      clearCurrentProject()
    }
  }, [viewMode, clearCurrentProject])

  // Handle delete project
  const handleDeleteProject = useCallback((projectId: string) => {
    deleteProject(projectId)
    if (currentProject?.id === projectId) {
      setViewMode('projects')
      setSelectedSheetId(null)
    }
  }, [deleteProject, currentProject])

  // Full screen viewer
  if (isFullScreen && selectedSheet && currentProject) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">{selectedSheet.summary.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {currentProject.name} • {selectedSheet.data.semanticRows?.length ?? 0} rows
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/380/projects/${currentProject.id}/${selectedSheet.summary.slug}/wire-list`}>
                <Button variant="outline" size="sm" className="gap-2 rounded-full">
                  <ExternalLink className="size-3.5" />
                  Open in workspace
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsFullScreen(false)}
                className="rounded-full"
              >
                <Minimize2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setIsFullScreen(false)
                  setViewMode('sheets')
                }}
                className="rounded-full"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <SemanticWireList
              rows={selectedSheet.data.semanticRows ?? []}
              metadata={selectedSheet.data.metadata}
              diagnostics={selectedSheet.data.parserDiagnostics}
              title={selectedSheet.summary.name}
              currentSheetName={selectedSheet.summary.name}
              projectId={currentProject.id}
              sheetSlug={selectedSheet.summary.slug}
              featureConfig={{
                showCheckboxColumns: false,
                showFromCheckbox: false,
                showToCheckbox: false,
                showIPVCheckbox: false,
                showComments: false,
                groupByLocation: true,
                stickyGroupHeaders: true,
                showPartNumber: false,
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="rounded-3xl border-border/70 bg-card/90 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl border-border/70 bg-card/90 shadow-xl">
      {/* Header */}
      <CardHeader className="border-b border-border/50 px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {viewMode !== 'projects' && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                className="rounded-full"
              >
                <ChevronRight className="size-4 rotate-180" />
              </Button>
            )}
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <FileSpreadsheet className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold sm:text-xl">
                {viewMode === 'projects' && 'Wire List Tool'}
                {viewMode === 'sheets' && currentProject?.name}
                {viewMode === 'viewer' && selectedSheet?.summary.name}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {viewMode === 'projects' && 'Upload and browse project wire lists'}
                {viewMode === 'sheets' && `${operationalSheets.length} wire lists, ${referenceSheets.length} reference sheets`}
                {viewMode === 'viewer' && `${selectedSheet?.data.semanticRows?.length ?? 0} rows`}
              </CardDescription>
            </div>
          </div>
          {viewMode === 'viewer' && selectedSheet && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsFullScreen(true)}
                className="rounded-full"
              >
                <Maximize2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {/* Projects View */}
          {viewMode === 'projects' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Upload Section */}
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 transition-colors',
                  'border-muted-foreground/25 hover:border-muted-foreground/40'
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleFileUpload(e.dataTransfer.files)
                }}
              >
                <div className="rounded-full bg-muted p-4">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Upload Excel Workbook</p>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to browse
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="sr-only"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Select File
                    </>
                  )}
                </Button>
                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
              </div>

              {/* Existing Projects */}
              {allProjects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground/70">Recent Projects</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onSelect={() => handleSelectProject(project.id)}
                        onDelete={() => handleDeleteProject(project.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {allProjects.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                  <FolderOpen className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No projects yet. Upload a workbook to get started.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Sheets View */}
          {viewMode === 'sheets' && currentProject && (
            <motion.div
              key="sheets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Wire Lists */}
              {operationalSheets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">Wire Lists</h3>
                    <Badge variant="secondary" className="text-xs">
                      {operationalSheets.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {operationalSheets.map((sheet) => (
                      <SheetCard
                        key={sheet.id}
                        sheet={sheet}
                        projectId={currentProject.id}
                        rowCount={currentProject.sheetData[sheet.id]?.semanticRows?.length ?? 0}
                        onSelect={() => handleSelectSheet(sheet.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reference Sheets */}
              {referenceSheets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Reference Data</h3>
                    <Badge variant="outline" className="text-xs">
                      {referenceSheets.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {referenceSheets.map((sheet) => (
                      <SheetCard
                        key={sheet.id}
                        sheet={sheet}
                        projectId={currentProject.id}
                        rowCount={currentProject.sheetData[sheet.id]?.semanticRows?.length ?? 0}
                        onSelect={() => handleSelectSheet(sheet.id)}
                        isReference
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Wire List Viewer */}
          {viewMode === 'viewer' && selectedSheet && currentProject && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Sheet tabs for quick switching */}
              <ScrollArea className="mb-4 w-full">
                <div className="flex gap-2 pb-2">
                  {[...operationalSheets, ...referenceSheets].map((sheet) => (
                    <Button
                      key={sheet.id}
                      variant={selectedSheetId === sheet.id ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0 rounded-full text-xs"
                      onClick={() => setSelectedSheetId(sheet.id)}
                    >
                      {sheet.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {/* Wire list content */}
              <div className="rounded-2xl border border-border/70 bg-background/50 p-3 sm:p-4">
                <SemanticWireList
                  rows={selectedSheet.data.semanticRows ?? []}
                  metadata={selectedSheet.data.metadata}
                  diagnostics={selectedSheet.data.parserDiagnostics}
                  title={selectedSheet.summary.name}
                  currentSheetName={selectedSheet.summary.name}
                  projectId={currentProject.id}
                  sheetSlug={selectedSheet.summary.slug}
                  featureConfig={{
                    showCheckboxColumns: false,
                    showFromCheckbox: false,
                    showToCheckbox: false,
                    showIPVCheckbox: false,
                    showComments: false,
                    groupByLocation: true,
                    stickyGroupHeaders: true,
                    showPartNumber: false,
                  }}
                />
              </div>

              {/* Open in workspace link */}
              <div className="mt-4 flex justify-end">
                <Link href={`/380/projects/${currentProject.id}/${selectedSheet.summary.slug}/wire-list`}>
                  <Button variant="outline" size="sm" className="gap-2 rounded-full">
                    <ExternalLink className="size-3.5" />
                    Open in full workspace
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

// Project Card Component
function ProjectCard({
  project,
  onSelect,
  onDelete,
}: {
  project: ProjectManifest
  onSelect: () => void
  onDelete: () => void
}) {
  const sheetCount = project.sheets.length
  const wireListCount = project.sheets.filter(s => s.kind === 'operational').length

  return (
    <div
      className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 p-3 transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <FileSpreadsheet className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            {wireListCount} wire lists • {sheetCount} total
          </p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Sheet Card Component
function SheetCard({
  sheet,
  projectId,
  rowCount,
  onSelect,
  isReference = false,
}: {
  sheet: ProjectSheetSummary
  projectId: string
  rowCount: number
  onSelect: () => void
  isReference?: boolean
}) {
  return (
    <div
      className="group cursor-pointer rounded-xl border border-border/70 bg-card/70 p-3 transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{sheet.name}</p>
          <p className="text-xs text-muted-foreground">
            {rowCount} rows
          </p>
        </div>
        <Badge variant={isReference ? 'outline' : 'secondary'} className="shrink-0 text-[10px]">
          {isReference ? 'Reference' : 'Wire List'}
        </Badge>
      </div>
    </div>
  )
}
