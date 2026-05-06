'use client'

/**
 * D380 Wire List Route
 * 
 * Renders the wire list for a specific sheet within a project.
 * This is the D380-specific wire list view with workflow integration.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { SemanticWireListWithSidebar } from '@/components/wire-list/semantic-wire-list-with-sidebar'
import { WireListPageHeader } from '@/components/wire-list/wire-list-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSheetRoute } from '@/hooks/use-sheet-route'
import { useProjectContext } from '@/contexts/project-context'
import { SWS_TYPE_REGISTRY, type SwsTypeId } from '@/lib/assignment/sws-detection'

interface WireListRouteProps {
  projectId: string
  sheetName: string
}

export function WireListRoute({ projectId, sheetName }: WireListRouteProps) {
  const { project, sheetEntry, sheetSchema, isLoading, error, found } = useSheetRoute({
    projectId,
    sheetName,
  })
  
  // Get assignment mappings for SWS type
  const { assignmentMappings } = useProjectContext()

  const semanticRows = sheetSchema?.rows ?? []
  
  // Get SWS type info for this sheet from assignment mappings
  const swsType = useMemo(() => {
    if (!sheetEntry) return undefined
    const assignment = assignmentMappings.find(a => a.sheetSlug === sheetEntry.slug)
    if (!assignment) return undefined
    const swsInfo = SWS_TYPE_REGISTRY[assignment.selectedSwsType as SwsTypeId]
    if (!swsInfo) return undefined
    return {
      id: swsInfo.id,
      label: swsInfo.label,
      shortLabel: swsInfo.shortLabel,
      color: swsInfo.color,
    }
  }, [sheetEntry, assignmentMappings])

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen bg-backgroundpx-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mx-auto max-w-[1480px]"
        >
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading wire list...</p>
          </div>
        </motion.div>
      </main>
    )
  }

  // Error state
  if (error || !found || !project || !sheetEntry || !sheetSchema) {
    return (
      <main className="min-h-screen bg-backgroundpx-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mx-auto max-w-[1480px] space-y-7"
        >
          <Card className="rounded-[36px] border border-dashed border-border/80 bg-card/82 py-0">
            <CardContent className="px-8 py-14 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="mt-4 text-3xl font-semibold text-foreground">Wire List Not Found</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
                {error || 'The requested wire list could not be found.'}
              </p>
              <Button variant="outline" asChild className="mt-6">
                <Link href={`/380/projects/${projectId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-backgroundpx-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mx-auto max-w-[1480px] space-y-6"
      >
        {/* Header */}
        <WireListPageHeader
          project={project}
          sheet={sheetEntry}
          headerDetection={sheetSchema.headerDetection}
        />

        {/* Wire List */}
        {semanticRows.length > 0 ? (
          <SemanticWireListWithSidebar
            rows={semanticRows}
            metadata={sheetSchema.metadata}
            diagnostics={sheetSchema.warnings}
            title={sheetEntry.name}
            currentSheetName={sheetEntry.name}
            projectId={projectId}
            sheetSlug={sheetEntry.slug}
            featureConfig={{
              showCheckboxColumns: true,
              showFromCheckbox: true,
              showToCheckbox: true,
              showIPVCheckbox: true,
              showComments: true,
              groupByLocation: true,
              stickyGroupHeaders: true,
              showPartNumber: false,
            }}
            showSidebar={false}
            swsType={swsType}
          />
        ) : (
          <Card className="rounded-[36px] border border-dashed border-border/80 bg-card/82 py-0">
            <CardContent className="px-8 py-14 text-center">
              <h2 className="text-xl font-semibold text-foreground">No Wire Data</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
                This sheet does not contain semantic wire list data.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </main>
  )
}
