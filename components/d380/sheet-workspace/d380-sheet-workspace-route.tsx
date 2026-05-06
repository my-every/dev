'use client'

/**
 * D380 Sheet Workspace Route
 * 
 * This component intelligently routes sheets based on their type:
 * - Operational sheets (wire lists) -> AssignmentWorkspaceRoute (assignments)
 * - Reference sheets (white labels, blue labels, part numbers) -> Dedicated reference views
 * 
 * This ensures that reference data (like labels and part numbers) is NOT shown
 * as assignments when they are actually extraction/reference sheets.
 */

import { useSheetRoute } from '@/hooks/use-sheet-route'
import { isReferenceSheetName } from '@/lib/workbook/classify-sheet'
import { AssignmentWorkspaceRoute } from '@/components/d380/assignment-workspace/assignment-workspace-route'
import { D380ReferenceSheetRoute } from '@/components/d380/sheet-workspace/d380-reference-sheet-route'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface D380SheetWorkspaceRouteProps {
  projectId: string
  sheetName: string
}

export function D380SheetWorkspaceRoute({ projectId, sheetName }: D380SheetWorkspaceRouteProps) {
  const { sheetEntry, isLoading, error, found } = useSheetRoute({
    projectId,
    sheetName,
  })

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/45 px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="mx-auto max-w-360"
        >
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading sheet...</p>
          </div>
        </motion.div>
      </main>
    )
  }

  // Error state
  if (error || !found || !sheetEntry) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/45 px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="mx-auto max-w-360 space-y-8"
        >
          <Card className="rounded-4xl border border-dashed border-border/80 bg-card/78 py-0">
            <CardContent className="px-8 py-14 text-center">
              <h1 className="text-3xl font-semibold text-foreground">Sheet Not Found</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
                {error || `The sheet "${sheetName}" could not be found in this project.`}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    )
  }

  // Determine if this is a reference sheet (white labels, blue labels, part numbers, etc.)
  // These should NOT be rendered as assignment workflows
  const isReference = sheetEntry.kind === 'reference' || isReferenceSheetName(sheetEntry.name)

  if (isReference) {
    // Render reference sheet view (labels, part numbers, etc.)
    return <D380ReferenceSheetRoute projectId={projectId} sheetName={sheetName} />
  }

  // Render assignment workspace for operational wire lists
  return <AssignmentWorkspaceRoute projectId={projectId} sheetName={sheetName} />
}
