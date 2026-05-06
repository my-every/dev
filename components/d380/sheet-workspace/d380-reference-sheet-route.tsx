'use client'

/**
 * D380 Reference Sheet Route
 * 
 * Renders reference sheets (white labels, blue labels, part numbers, etc.)
 * in a dedicated view that clearly identifies them as reference/extraction data,
 * NOT as wire list assignments.
 */

import Link from 'next/link'
import { AlertCircle, ArrowLeft, FileSpreadsheet, Tag, Hash, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { useSheetRoute } from '@/hooks/use-sheet-route'
import { PartNumberListView } from '@/components/part-number-list/pn-table-view'
import { ReferenceColumnListView } from '@/components/part-number-list/ref-column-view'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface D380ReferenceSheetRouteProps {
  projectId: string
  sheetName: string
}

// Detect Part Number List sheets (Device ID / Part Number / Description rows)
function isPartNumberListSheet(sheetName: string): boolean {
  const n = sheetName.toLowerCase().replace(/\s+/g, '')
  return (n.includes('partnumber') && !n.includes('cable')) || n.includes('partlist') || n.includes('part_number')
}

// Detect Cable Part Numbers sheet
function isCablePartNumbersSheet(sheetName: string): boolean {
  const n = sheetName.toLowerCase().replace(/\s+/g, '')
  return n.includes('cable') && (n.includes('partnumber') || n.includes('partno') || n.includes('part'))
}

// Detect columnar label sheets: Blue Labels, White Labels, Heat Shrink Labels
function isColumnarLabelSheet(sheetName: string): boolean {
  const n = sheetName.toLowerCase().replace(/\s+/g, '')
  return (
    n.includes('bluelabel') ||
    n.includes('whitelabel') ||
    n.includes('heatshrink') ||
    n.includes('heat_shrink') ||
    n.includes('heat-shrink')
  )
}

// Detect Blue Labels specifically
function isBlueLabelsSheet(sheetName: string): boolean {
  const n = sheetName.toLowerCase().replace(/\s+/g, '')
  return n.includes('bluelabel') || n.includes('blue_label')
}

// Detect White Labels specifically
function isWhiteLabelsSheet(sheetName: string): boolean {
  const n = sheetName.toLowerCase().replace(/\s+/g, '')
  return n.includes('whitelabel') || n.includes('white_label')
}

// Get reference sheet type info
function getReferenceSheetInfo(sheetName: string): {
  type: string
  icon: typeof FileSpreadsheet
  description: string
  badgeColor: string
} {
  if (isBlueLabelsSheet(sheetName)) {
    return {
      type: 'Blue Labels',
      icon: Tag,
      description: 'Device location sequence data for layout matching and proximity detection',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    }
  }
  if (isWhiteLabelsSheet(sheetName)) {
    return {
      type: 'White Labels',
      icon: Tag,
      description: 'Wire identification labels for terminal marking and documentation',
      badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
    }
  }
  if (isColumnarLabelSheet(sheetName)) {
    return {
      type: 'Heat Shrink Labels',
      icon: Tag,
      description: 'Heat shrink label data for wire identification',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    }
  }
  if (isPartNumberListSheet(sheetName) || isCablePartNumbersSheet(sheetName)) {
    return {
      type: 'Part Numbers',
      icon: Hash,
      description: 'Device and component part number reference data',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    }
  }
  return {
    type: 'Reference Data',
    icon: FileSpreadsheet,
    description: 'Supporting reference data for the project',
    badgeColor: 'bg-muted text-muted-foreground border-border',
  }
}

export function D380ReferenceSheetRoute({ projectId, sheetName }: D380ReferenceSheetRouteProps) {
  const { project, sheetEntry, sheetSchema, isLoading, error, found } = useSheetRoute({
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
            <p className="text-muted-foreground">Loading reference sheet...</p>
          </div>
        </motion.div>
      </main>
    )
  }

  // Error state
  if (error || !found || !project || !sheetEntry || !sheetSchema) {
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
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="mt-4 text-3xl font-semibold text-foreground">Sheet Not Found</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
                {error || 'The requested reference sheet could not be found.'}
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

  const sheetInfo = getReferenceSheetInfo(sheetEntry.name)
  const SheetIcon = sheetInfo.icon

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/45 px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-primary/[0.03]" />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative mx-auto max-w-360 space-y-6"
      >
        {/* Reference Sheet Header */}
        <Card className="rounded-4xl border border-border/70 bg-card/95 shadow-xl">
          <CardContent className="px-5 py-5 sm:px-7 sm:py-7 xl:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className={`rounded-2xl p-4 ${sheetInfo.badgeColor}`}>
                  <SheetIcon className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                      Reference Sheet
                    </Badge>
                    <Badge className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${sheetInfo.badgeColor}`}>
                      {sheetInfo.type}
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                    {sheetEntry.name}
                  </h1>
                  <p className="text-base text-foreground/66">
                    {sheetInfo.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span>{sheetEntry.rowCount.toLocaleString()} rows</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{sheetEntry.columnCount} columns</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>Project: {project.name}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/380/projects/${projectId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Project
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reference Sheet Content */}
        <div className="rounded-4xl border border-border/70 bg-card/95 p-6 shadow-lg">
          {isPartNumberListSheet(sheetEntry.name) || isCablePartNumbersSheet(sheetEntry.name) ? (
            <PartNumberListView
              sheetSchema={sheetSchema}
              metadata={sheetSchema.metadata}
              title={sheetEntry.name}
              projectId={projectId}
              currentSheetSlug={sheetEntry.slug}
            />
          ) : isColumnarLabelSheet(sheetEntry.name) ? (
            <ReferenceColumnListView
              sheetSchema={sheetSchema}
              metadata={sheetSchema.metadata}
              title={sheetEntry.name}
              projectId={projectId}
              currentSheetSlug={sheetEntry.slug}
            />
          ) : (
            <ReferenceColumnListView
              sheetSchema={sheetSchema}
              metadata={sheetSchema.metadata}
              title={sheetEntry.name}
              projectId={projectId}
              currentSheetSlug={sheetEntry.slug}
            />
          )}
        </div>

        {/* Clarification Banner */}
        <Card className="rounded-4xl border border-amber-200/70 bg-amber-50/50 shadow-sm">
          <CardContent className="px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-amber-900">Reference Data Only</h3>
                <p className="mt-1 text-sm text-amber-700">
                  This sheet contains reference/extraction data and is not a wire list assignment. 
                  Reference sheets like {sheetInfo.type.toLowerCase()} provide supporting data for 
                  operational wire lists and are used for lookups, validation, and documentation purposes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}
