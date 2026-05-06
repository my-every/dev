'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Factory, LayoutPanelTop } from 'lucide-react'

import { OnskidFloorLayout } from '@/components/d380/project-board/onskid-floor-layout'
import { OffskidFloorLayout } from '@/components/d380/project-board/offskid-floor-layout'
import { NewflexFloorLayout } from '@/components/d380/project-board/newflex-floor-layout'
import { AssignmentBacklogPanel } from '@/components/d380/project-board/assignment-backlog-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildProjectBoardViewModel,
  getProjectBoardDataSet,
  simulateProjectBoardPlacement,
} from '@/lib/view-models/d380-project-board'
import type {
  D380ProjectBoardDataSet,
  ProjectBoardPlacementSelection,
} from '@/types/d380-project-board'

type ZoneTab = 'all' | 'onskid' | 'offskid' | 'newflex'

export function ProjectBoardRoute() {
  const [dataSet, setDataSet] = useState<D380ProjectBoardDataSet>(() => getProjectBoardDataSet())
  const [selectedWorkAreaId, setSelectedWorkAreaId] = useState<string | undefined>(dataSet.workAreas[0]?.id)
  const [activeZone, setActiveZone] = useState<ZoneTab>('all')

  const viewModel = useMemo(
    () => buildProjectBoardViewModel({
      dataSet,
      selectedWorkAreaId,
      selectedAssignmentId: undefined,
      placement: undefined,
    }),
    [dataSet, selectedWorkAreaId],
  )

  function handleFloorLayoutAssign(workAreaId: string, projectId: string) {
    const assignment = dataSet.assignments.find(a => a.id === projectId)
    if (!assignment) return

    const placement: ProjectBoardPlacementSelection = {
      workAreaId,
      assignmentId: projectId,
      memberIds: [],
      traineePairing: false,
      mode: 'place',
    }
    setDataSet(current => simulateProjectBoardPlacement(current, placement))
  }

  // Extract work areas per LWC zone
  const onskidSection = viewModel.sections.find(s => s.id === 'ONSKID')
  const offskidSection = viewModel.sections.find(s => s.id === 'OFFSKID')
  const newflexSection = viewModel.sections.find(s => s.id === 'NEW_FLEX')

  const buildZoneData = (section: typeof onskidSection) => ({
    buildupTables: section?.workAreas.filter(wa => wa.kind === 'BUILDUP_TABLE') ?? [],
    wiringTables: section?.workAreas.filter(wa => wa.kind === 'WIRING_TABLE') ?? [],
    testStations: section?.workAreas.filter(wa => wa.kind === 'TEST_STATION') ?? [],
  })

  const onskid = buildZoneData(onskidSection)
  const offskid = buildZoneData(offskidSection)
  const newflex = buildZoneData(newflexSection)

  // Offskid named slots
  const offskidSlots = {
    buildUpTable1: offskid.buildupTables[0] ?? null,
    buildUpTable2: offskid.buildupTables[1] ?? null,
    buildUpTable3: offskid.buildupTables[2] ?? null,
    buildUpTable4: offskid.buildupTables[3] ?? null,
    buildUpTable5: offskid.buildupTables[4] ?? null,
    buildUpTable6: offskid.buildupTables[5] ?? null,
    wiringTable1: offskid.wiringTables[0] ?? null,
    wiringTable2: offskid.wiringTables[1] ?? null,
    wiringTable3: offskid.wiringTables[2] ?? null,
    wiringTable4: offskid.wiringTables[3] ?? null,
    station1: offskid.testStations[0] ?? null,
    station2: offskid.testStations[1] ?? null,
    station3: offskid.testStations[2] ?? null,
    station4: offskid.testStations[3] ?? null,
    station5: offskid.testStations[4] ?? null,
    station6: offskid.testStations[5] ?? null,
    station7: offskid.testStations[6] ?? null,
    station8: offskid.testStations[7] ?? null,
  }

  const availableProjects = [
    ...viewModel.backlog.unassigned,
    ...viewModel.backlog.recommended,
  ]

  const showOnskid = activeZone === 'all' || activeZone === 'onskid'
  const showOffskid = activeZone === 'all' || activeZone === 'offskid'
  const showNewflex = activeZone === 'all' || activeZone === 'newflex'

  const totalStations = viewModel.sections.reduce((sum, s) => sum + s.workAreas.length, 0)
  const occupiedStations = viewModel.sections.reduce(
    (sum, s) => sum + s.workAreas.filter(wa => wa.activeAssignments.length > 0).length, 0,
  )

  return (
    <main className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white">
        <div className="container mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <Factory className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Project Board</h1>
                <p className="text-sm text-white/70">Floor layout &amp; resource allocation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {occupiedStations}/{totalStations} stations active
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {viewModel.backlog.unassigned.length} unassigned
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Tabs */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <Tabs value={activeZone} onValueChange={(v) => setActiveZone(v as ZoneTab)} className="py-2">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs gap-1.5">
                <LayoutPanelTop className="h-3.5 w-3.5" />
                All Zones
              </TabsTrigger>
              <TabsTrigger value="onskid" className="text-xs gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3b9dd9]" />
                ONSKID
              </TabsTrigger>
              <TabsTrigger value="offskid" className="text-xs gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                OFFSKID
              </TabsTrigger>
              <TabsTrigger value="newflex" className="text-xs gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                NEW/FLEX
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(16rem,20rem)_1fr] gap-6">
          {/* Backlog sidebar */}
          <div className="hidden xl:block">
            <AssignmentBacklogPanel backlog={viewModel.backlog} />
          </div>

          {/* Floor layouts */}
          <div className="space-y-8">
            {showOnskid && (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <OnskidFloorLayout
                  buildupTables={onskid.buildupTables}
                  wiringTables={onskid.wiringTables}
                  testStations={onskid.testStations}
                  availableProjects={availableProjects}
                  onAssignProject={handleFloorLayoutAssign}
                  title="ONSKID"
                />
              </motion.div>
            )}

            {showOffskid && (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <OffskidFloorLayout
                  {...offskidSlots}
                  availableProjects={availableProjects}
                  onAssignProject={handleFloorLayoutAssign}
                  title="OFFSKID"
                />
              </motion.div>
            )}

            {showNewflex && (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <NewflexFloorLayout
                  buildupTables={newflex.buildupTables}
                  wiringTables={newflex.wiringTables}
                  testStations={newflex.testStations}
                  availableProjects={availableProjects}
                  onAssignProject={handleFloorLayoutAssign}
                  title="NEW / FLEX"
                />
              </motion.div>
            )}

            {viewModel.sections.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center">
                <Factory className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h2 className="text-xl font-semibold">{viewModel.emptyState.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{viewModel.emptyState.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
