'use client'

import { useState } from 'react'

import { AssignProjectModal } from '@/components/d380/project-board/assign-project-modal'
import { CompactStationCard } from '@/components/d380/project-board/compact-station-card'
import { cn } from '@/lib/utils'
import type {
  ProjectBoardAssignmentViewModel,
  ProjectBoardWorkAreaCardViewModel,
  ProjectBoardWorkAreaKind,
} from '@/types/d380-project-board'

interface OffskidFloorLayoutProps {
  // Build Up Tables (6 total, numbered #1-#6)
  buildUpTable1?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable2?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable3?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable4?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable5?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable6?: ProjectBoardWorkAreaCardViewModel | null

  // Wiring Tables (4 total, numbered #1-#4)
  wiringTable1?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable2?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable3?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable4?: ProjectBoardWorkAreaCardViewModel | null

  // Test Stations (8 total, numbered #1-#8)
  station1?: ProjectBoardWorkAreaCardViewModel | null
  station2?: ProjectBoardWorkAreaCardViewModel | null
  station3?: ProjectBoardWorkAreaCardViewModel | null
  station4?: ProjectBoardWorkAreaCardViewModel | null
  station5?: ProjectBoardWorkAreaCardViewModel | null
  station6?: ProjectBoardWorkAreaCardViewModel | null
  station7?: ProjectBoardWorkAreaCardViewModel | null
  station8?: ProjectBoardWorkAreaCardViewModel | null

  /** Available projects for assignment */
  availableProjects: ProjectBoardAssignmentViewModel[]
  /** Callback when a project is assigned */
  onAssignProject: (workAreaId: string, projectId: string) => void
  /** Optional section title */
  title?: string
  /** Additional class names */
  className?: string
}

function getStationNumber(stationCode: string): string {
  const match = stationCode.match(/\d+/)
  return match ? match[0] : stationCode
}

function mapWorkAreaToCard(workArea: ProjectBoardWorkAreaCardViewModel) {
  const activeAssignment = workArea.activeAssignments[0]
  const assignedMember = workArea.assignedMembers[0]

  return {
    id: workArea.id,
    kind: workArea.kind,
    stationNumber: getStationNumber(workArea.stationCode),
    stationCode: workArea.stationCode,
    label: workArea.label,
    assignment: activeAssignment
      ? {
        id: activeAssignment.id,
        name: activeAssignment.sheetName,
        tag: activeAssignment.pdNumber,
        progress: activeAssignment.progressPercent,
      }
      : null,
    assignedMember: assignedMember
      ? {
        id: assignedMember.id,
        name: assignedMember.name,
        initials: assignedMember.initials,
      }
      : null,
  }
}

// Diagonal stripe pattern for unavailable areas  
function DiagonalStripeArea({ className, variant = 'amber' }: { className?: string; variant?: 'amber' | 'gray' }) {
  const bgColor = variant === 'amber' ? 'bg-amber-200/40' : 'bg-slate-200/60'
  const stripeColor = variant === 'amber' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)'

  return (
    <div
      className={cn("rounded-lg", bgColor, className)}
      style={{
        backgroundImage: `repeating-linear-gradient(
          45deg,
          ${stripeColor},
          ${stripeColor} 10px,
          transparent 10px,
          transparent 20px
        )`,
      }}
    />
  )
}

// Staging area component for "Ready to Lay" and "Ready for Visual"
function StagingArea({
  label,
  className
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border-2 border-sky-400 bg-sky-100/80 p-4",
        className
      )}
    >
      <span className="text-sm font-bold min-w-max uppercase tracking-wide text-blue-800">
        {label}
      </span>
    </div>
  )
}

// Fixed label workarea slot (empty placeholder with label)
function WorkareaSlot({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {label}
      </span>
      <div className="flex h-[100px] w-full items-center justify-center rounded-lg border-2 border-dashed border-amber-400/60 bg-amber-100/40">
        <span className="text-xs text-amber-500/60">Empty</span>
      </div>
    </div>
  )
}

// Station card wrapper with label
function LabeledStationCard({
  label,
  workArea,
  size,
  onCardClick,
}: {
  label: string
  workArea?: ProjectBoardWorkAreaCardViewModel | null
  size: 'buildup' | 'wiring' | 'test'
  onCardClick: (workArea: ProjectBoardWorkAreaCardViewModel) => void
}) {
  if (!workArea) {
    return <WorkareaSlot label={label} />
  }

  const card = mapWorkAreaToCard(workArea)

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {label}
      </span>
      <CompactStationCard
        kind={card.kind}
        stationNumber={card.stationNumber}
        assignment={card.assignment}
        assignedMember={card.assignedMember}
        onClick={() => onCardClick(workArea)}
        size={size}
        zone="offskid"
      />
    </div>
  )
}

export function OffskidFloorLayout({
  buildUpTable1,
  buildUpTable2,
  buildUpTable3,
  buildUpTable4,
  buildUpTable5,
  buildUpTable6,
  wiringTable1,
  wiringTable2,
  wiringTable3,
  wiringTable4,
  station1,
  station2,
  station3,
  station4,
  station5,
  station6,
  station7,
  station8,
  availableProjects,
  onAssignProject,
  title = 'OFFSKID',
  className,
}: OffskidFloorLayoutProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedWorkArea, setSelectedWorkArea] = useState<{
    id: string
    kind: ProjectBoardWorkAreaKind
    stationNumber: string
    label: string
  } | null>(null)

  const handleCardClick = (workArea: ProjectBoardWorkAreaCardViewModel) => {
    setSelectedWorkArea({
      id: workArea.id,
      kind: workArea.kind,
      stationNumber: getStationNumber(workArea.stationCode),
      label: workArea.label,
    })
    setModalOpen(true)
  }

  const handleAssign = (projectId: string) => {
    if (selectedWorkArea) {
      onAssignProject(selectedWorkArea.id, projectId)
    }
  }

  return (
    <div className={cn('relative rounded-xl bg-amber-200/60 p-4', className)}>
      {/* Section Header */}
      <div className="mb-4 flex justify-center">
        <h2 className="rounded-md bg-amber-500 px-8 py-2 text-lg font-bold tracking-wider text-white shadow-md">
          {title}
        </h2>
      </div>

      {/* Main Layout Container */}
      <div className="flex gap-4">
        {/* Left Section: Build Up Tables + Wiring Tables + Staging Areas */}
        <div className="flex flex-col gap-3">
          {/* Row 1: Build Up Tables #3, #2, #1 */}
          <div className="flex gap-2">
            <LabeledStationCard label="BUILD UP TABLE #3" workArea={buildUpTable3} size="buildup" onCardClick={handleCardClick} />
            <LabeledStationCard label="BUILD UP TABLE #2" workArea={buildUpTable2} size="buildup" onCardClick={handleCardClick} />
            <LabeledStationCard label="BUILD UP TABLE #1" workArea={buildUpTable1} size="buildup" onCardClick={handleCardClick} />
          </div>

          {/* Row 2: Build Up Tables #6, #5, #4 */}
          <div className="flex gap-2">
            <LabeledStationCard label="BUILD UP TABLE #6" workArea={buildUpTable6} size="buildup" onCardClick={handleCardClick} />
            <LabeledStationCard label="BUILD UP TABLE #5" workArea={buildUpTable5} size="buildup" onCardClick={handleCardClick} />
            <LabeledStationCard label="BUILD UP TABLE #4" workArea={buildUpTable4} size="buildup" onCardClick={handleCardClick} />
          </div>

          {/* Row 3: Wiring Tables #2, #1 + Ready to Lay */}
          <div className="flex gap-2">
            <LabeledStationCard label="WIRING TABLE #2" workArea={wiringTable2} size="wiring" onCardClick={handleCardClick} />
            <LabeledStationCard label="WIRING TABLE #1" workArea={wiringTable1} size="wiring" onCardClick={handleCardClick} />
            <div className="flex flex-col gap-1">
              <div className="h-3" /> {/* Spacer for label alignment */}
              <StagingArea label="Ready to Lay" className="h-[100px] w-[120px]" />
            </div>
          </div>

          {/* Row 4: Wiring Tables #4, #3 + Ready for Visual */}
          <div className="flex gap-2">
            <LabeledStationCard label="WIRING TABLE #4" workArea={wiringTable4} size="wiring" onCardClick={handleCardClick} />
            <LabeledStationCard label="WIRING TABLE #3" workArea={wiringTable3} size="wiring" onCardClick={handleCardClick} />
            <div className="flex flex-col gap-1">
              <div className="h-3" /> {/* Spacer for label alignment */}
              <StagingArea label="Ready for Visual" className="h-[100px] w-[120px]" />
            </div>
          </div>
        </div>

        {/* Right Section: Test Stations + Garage/Exit */}
        <div className="flex gap-2">
          {/* Stations Grid */}
          <div className="flex flex-col gap-3">
            {/* Row 1: Stations #4, #3, #2, #1 */}
            <div className="flex gap-2">
              <LabeledStationCard label="STATION #4" workArea={station4} size="test" onCardClick={handleCardClick} />
              <LabeledStationCard label="STATION #3" workArea={station3} size="test" onCardClick={handleCardClick} />
              <LabeledStationCard label="STATION #2" workArea={station2} size="test" onCardClick={handleCardClick} />
              <LabeledStationCard label="STATION #1" workArea={station1} size="test" onCardClick={handleCardClick} />
            </div>

            {/* Row 2: Stations #8, #7, #6, #5 */}
            <div className="flex gap-2">
              <LabeledStationCard label="STATION #8" workArea={station8} size="test" onCardClick={handleCardClick} />
              <LabeledStationCard label="STATION #7" workArea={station7} size="test" onCardClick={handleCardClick} />
              <LabeledStationCard label="STATION #6" workArea={station6} size="test" onCardClick={handleCardClick} />
              <LabeledStationCard label="STATION #5" workArea={station5} size="test" onCardClick={handleCardClick} />
            </div>

            {/* Bottom spacer row with striped area */}
            <div className="flex gap-2">
              <div className="w-[110px]" />
              <div className="w-[110px]" />
              <DiagonalStripeArea variant="gray" className="h-[100px] w-[230px]" />
            </div>
          </div>

          {/* Garage & Exit Markers */}
          <div className="flex flex-col gap-2">
            <div className="flex h-[120px] w-10 items-center justify-center rounded-md bg-sky-200">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-700" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                Garage
              </span>
            </div>
            <div className="flex h-16 w-10 items-center justify-center rounded-md bg-red-600">
              <span className="text-xs font-bold uppercase tracking-widest text-white" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                Exit
              </span>
            </div>
            <DiagonalStripeArea variant="gray" className="h-[100px] w-10" />
          </div>
        </div>
      </div>

      {/* Assign Project Modal */}
      {selectedWorkArea && (
        <AssignProjectModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          stationKind={selectedWorkArea.kind}
          stationNumber={selectedWorkArea.stationNumber}
          stationLabel={selectedWorkArea.label}
          availableProjects={availableProjects}
          onAssign={handleAssign}
        />
      )}
    </div>
  )
}
