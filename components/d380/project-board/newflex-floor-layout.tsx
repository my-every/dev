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

interface NewflexFloorLayoutProps {
  /** Build up tables */
  buildupTables: ProjectBoardWorkAreaCardViewModel[]
  /** Wiring tables */
  wiringTables: ProjectBoardWorkAreaCardViewModel[]
  /** Test stations */
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
      className={cn("rounded-lg bg-emerald-200/40", className)}
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

export function NewflexFloorLayout({
  buildupTables,
  wiringTables,
  testStations,
  availableProjects,
  onAssignProject,
  title = 'NEW/FLEX',
  className,
}: NewflexFloorLayoutProps) {
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

  return (
    <div className={cn('rounded-3xl bg-emerald-300/50 p-6', className)}>
      {/* Section Header */}
      <div className="mb-6 flex justify-center">
        <h2 className="rounded-lg bg-emerald-500 px-8 py-2 text-xl font-bold tracking-wider text-white shadow-md">
          {title}
        </h2>
      </div>

      {/* Floor Grid Layout */}
      <div className="grid grid-cols-5 gap-4">
        {/* Row 1: Build up tables */}
        {buildupCards.slice(0, 3).map((card, i) => (
          <CompactStationCard
            key={card.id}
            kind={card.kind}
            stationNumber={card.stationNumber}
            assignment={card.assignment}
            assignedMember={card.assignedMember}
            onClick={() => handleCardClick(buildupTables[i]!)}
            size="buildup"
            zone="newflex"
          />
        ))}
        {wiringCards.slice(0, 2).map((card, i) => (
          <CompactStationCard
            key={card.id}
            kind={card.kind}
            stationNumber={card.stationNumber}
            assignment={card.assignment}
            assignedMember={card.assignedMember}
            onClick={() => handleCardClick(wiringTables[i]!)}
            size="wiring"
            zone="newflex"
          />
        ))}

        {/* Row 2 */}
        {buildupCards.slice(3, 6).map((card, i) => (
          <CompactStationCard
            key={card.id}
            kind={card.kind}
            stationNumber={card.stationNumber}
            assignment={card.assignment}
            assignedMember={card.assignedMember}
            onClick={() => handleCardClick(buildupTables[i + 3]!)}
            size="buildup"
            zone="newflex"
          />
        ))}
        {wiringCards.slice(2, 4).map((card, i) => (
          <CompactStationCard
            key={card.id}
            kind={card.kind}
            stationNumber={card.stationNumber}
            assignment={card.assignment}
            assignedMember={card.assignedMember}
            onClick={() => handleCardClick(wiringTables[i + 2]!)}
            size="wiring"
            zone="newflex"
          />
        ))}

        {/* Row 3: Test stations */}
        {testCards.slice(0, 2).map((card, i) => (
          <CompactStationCard
            key={card.id}
            kind={card.kind}
            stationNumber={card.stationNumber}
            assignment={card.assignment}
            assignedMember={card.assignedMember}
            onClick={() => handleCardClick(testStations[i]!)}
            size="test"
            zone="newflex"
          />
        ))}
        <DiagonalStripeArea className="min-h-[140px]" />
        {wiringCards.slice(4, 6).map((card, i) => (
          <CompactStationCard
            key={card.id}
            kind={card.kind}
            stationNumber={card.stationNumber}
            assignment={card.assignment}
            assignedMember={card.assignedMember}
            onClick={() => handleCardClick(wiringTables[i + 4]!)}
            size="wiring"
            zone="newflex"
          />
        ))}
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
