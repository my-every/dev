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

interface OnskidFloorLayoutProps {
  /** Build up tables (B1-B6) */
  buildupTables: ProjectBoardWorkAreaCardViewModel[]
  /** Wiring tables (W1-W6) */
  wiringTables: ProjectBoardWorkAreaCardViewModel[]
  /** Test stations (T15) */
  testStations: ProjectBoardWorkAreaCardViewModel[]
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
  // Extract number from station code like "B1", "W4", "T15"
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
function DiagonalStripeArea({ className }: { className?: string }) {
  return (
    <div 
      className={cn("rounded-lg bg-slate-300/40", className)}
      style={{
        backgroundImage: `repeating-linear-gradient(
          45deg,
          rgba(255,255,255,0.5),
          rgba(255,255,255,0.5) 10px,
          transparent 10px,
          transparent 20px
        )`,
      }}
    />
  )
}

export function OnskidFloorLayout({
  buildupTables,
  wiringTables,
  testStations,
  availableProjects,
  onAssignProject,
  title = 'ONSKID',
  className,
}: OnskidFloorLayoutProps) {
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

  // Map work areas to card data
  const buildupCards = buildupTables.map(mapWorkAreaToCard)
  const wiringCards = wiringTables.map(mapWorkAreaToCard)
  const testCards = testStations.map(mapWorkAreaToCard)

  // Get specific cards by index for the grid layout
  // Build tables: B1-B6 (indices 0-5)
  const b1 = buildupCards[0]
  const b2 = buildupCards[1]
  const b3 = buildupCards[2]
  const b4 = buildupCards[3]
  const b5 = buildupCards[4]
  const b6 = buildupCards[5]

  // Wiring tables: W1-W6 (indices 0-5)
  // Layout positions: W4, W5 (row1), W2, W3 (row2), W1, W2 (row3)
  const w1 = wiringCards[0]
  const w2 = wiringCards[1]
  const w3 = wiringCards[2]
  const w4 = wiringCards[3]
  const w5 = wiringCards[4]

  // Test stations: T15
  const t15a = testCards[0]
  const t15b = testCards[1]

  return (
    <div className={cn('rounded-3xl bg-slate-400/70 p-6', className)}>
      {/* Section Header */}
      <div className="mb-6 flex justify-center">
        <h2 className="rounded-lg bg-[#3b9dd9] px-8 py-2 text-xl font-bold tracking-wider text-white shadow-md">
          {title}
        </h2>
      </div>

      {/* Floor Grid Layout - Matching the exact image layout */}
      <div className="grid grid-cols-6 gap-4">
        {/* Row 1: B1, B2, B3, W4, W5, (stripe) */}
        {b1 && (
          <CompactStationCard
            kind={b1.kind}
            stationNumber={b1.stationNumber}
            assignment={b1.assignment}
            assignedMember={b1.assignedMember}
            onClick={() => handleCardClick(buildupTables[0]!)}
            size="buildup"
            zone="onskid"
          />
        )}
        {b2 && (
          <CompactStationCard
            kind={b2.kind}
            stationNumber={b2.stationNumber}
            assignment={b2.assignment}
            assignedMember={b2.assignedMember}
            onClick={() => handleCardClick(buildupTables[1]!)}
            size="buildup"
            zone="onskid"
          />
        )}
        {b3 && (
          <CompactStationCard
            kind={b3.kind}
            stationNumber={b3.stationNumber}
            assignment={b3.assignment}
            assignedMember={b3.assignedMember}
            onClick={() => handleCardClick(buildupTables[2]!)}
            size="buildup"
            zone="onskid"
          />
        )}
        {w4 && (
          <CompactStationCard
            kind={w4.kind}
            stationNumber={w4.stationNumber}
            assignment={w4.assignment}
            assignedMember={w4.assignedMember}
            onClick={() => handleCardClick(wiringTables[3]!)}
            size="wiring"
            zone="onskid"
          />
        )}
        {w5 && (
          <CompactStationCard
            kind={w5.kind}
            stationNumber={w5.stationNumber}
            assignment={w5.assignment}
            assignedMember={w5.assignedMember}
            onClick={() => handleCardClick(wiringTables[4]!)}
            size="wiring"
            zone="onskid"
          />
        )}
        <DiagonalStripeArea className="min-h-[140px]" />

        {/* Row 2: B4, B5, B6, W2, W3, (stripe) */}
        {b4 && (
          <CompactStationCard
            kind={b4.kind}
            stationNumber={b4.stationNumber}
            assignment={b4.assignment}
            assignedMember={b4.assignedMember}
            onClick={() => handleCardClick(buildupTables[3]!)}
            size="buildup"
            zone="onskid"
          />
        )}
        {b5 && (
          <CompactStationCard
            kind={b5.kind}
            stationNumber={b5.stationNumber}
            assignment={b5.assignment}
            assignedMember={b5.assignedMember}
            onClick={() => handleCardClick(buildupTables[4]!)}
            size="buildup"
            zone="onskid"
          />
        )}
        {b6 && (
          <CompactStationCard
            kind={b6.kind}
            stationNumber={b6.stationNumber}
            assignment={b6.assignment}
            assignedMember={b6.assignedMember}
            onClick={() => handleCardClick(buildupTables[5]!)}
            size="buildup"
            zone="onskid"
          />
        )}
        {w2 && (
          <CompactStationCard
            kind={w2.kind}
            stationNumber={w2.stationNumber}
            assignment={w2.assignment}
            assignedMember={w2.assignedMember}
            onClick={() => handleCardClick(wiringTables[1]!)}
            size="wiring"
            zone="onskid"
          />
        )}
        {w3 && (
          <CompactStationCard
            kind={w3.kind}
            stationNumber={w3.stationNumber}
            assignment={w3.assignment}
            assignedMember={w3.assignedMember}
            onClick={() => handleCardClick(wiringTables[2]!)}
            size="wiring"
            zone="onskid"
          />
        )}
        <DiagonalStripeArea className="min-h-[140px]" />

        {/* Row 3: T15, T15, (empty), W1, W2, (stripe) */}
        {t15a && (
          <CompactStationCard
            kind={t15a.kind}
            stationNumber={t15a.stationNumber}
            assignment={t15a.assignment}
            assignedMember={t15a.assignedMember}
            onClick={() => handleCardClick(testStations[0]!)}
            size="test"
            zone="onskid"
          />
        )}
        {t15b && (
          <CompactStationCard
            kind={t15b.kind}
            stationNumber={t15b.stationNumber}
            assignment={t15b.assignment}
            assignedMember={t15b.assignedMember}
            onClick={() => handleCardClick(testStations[1]!)}
            size="test"
            zone="onskid"
          />
        )}
        {/* Empty cell */}
        <div />
        {w1 && (
          <CompactStationCard
            kind={w1.kind}
            stationNumber={w1.stationNumber}
            assignment={w1.assignment}
            assignedMember={w1.assignedMember}
            onClick={() => handleCardClick(wiringTables[0]!)}
            size="wiring"
            zone="onskid"
          />
        )}
        {/* W2 appears again in row 3 per image - using same card */}
        {w2 && (
          <CompactStationCard
            kind={w2.kind}
            stationNumber={w2.stationNumber}
            assignment={w2.assignment}
            assignedMember={w2.assignedMember}
            onClick={() => handleCardClick(wiringTables[1]!)}
            size="wiring"
            zone="onskid"
          />
        )}
        <DiagonalStripeArea className="min-h-[140px]" />
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
