'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Plus } from 'lucide-react'

import { StationBadge } from '@/components/d380/project-board/station-badge'
import { StationProgressBar } from '@/components/d380/project-board/station-progress-bar'
import { UserBadge } from '@/components/d380/project-board/user-badge'
import { cn } from '@/lib/utils'
import type { ProjectBoardWorkAreaKind } from '@/types/d380-project-board'

interface AssignedProject {
  id: string
  name: string
  tag: string
  progress: number
}

interface AssignedMember {
  id: string
  name: string
  initials: string
}

/** Station type variants affect card dimensions */
export type StationSizeVariant = 'buildup' | 'wiring' | 'test'

/** Zone color variants for different LWC areas */
export type ZoneColorVariant = 'onskid' | 'offskid' | 'newflex'

const stationCardVariants = cva(
  'group relative flex flex-1 flex-col overflow-hidden rounded-lg border-2 transition-all',
  {
    variants: {
      size: {
        buildup: 'min-w-[250px] max-h-[200px] w-[300px]',
        wiring: 'min-w-[300px] w-[350px]',
        test: 'min-w-[300px] w-[450px]',
      },
      zone: {
        onskid: '',
        offskid: '',
        newflex: '',
      },
      isEmpty: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      // ONSKID zone colors (blue)
      { zone: 'onskid', isEmpty: true, className: 'border-slate-300/60 bg-slate-200/60 hover:border-slate-400/70 hover:bg-slate-200/80' },
      { zone: 'onskid', isEmpty: false, className: 'border-[#3b9dd9] bg-[#3b9dd9] hover:border-[#2d8bc7]' },
      // OFFSKID zone colors (yellow/amber)
      { zone: 'offskid', isEmpty: true, className: 'border-amber-300/60 bg-amber-100/60 hover:border-amber-400/70 hover:bg-amber-100/80' },
      { zone: 'offskid', isEmpty: false, className: 'border-amber-500 bg-amber-500 hover:border-amber-600' },
      // NEW/FLEX zone colors (green)
      { zone: 'newflex', isEmpty: true, className: 'border-emerald-300/60 bg-emerald-100/60 hover:border-emerald-400/70 hover:bg-emerald-100/80' },
      { zone: 'newflex', isEmpty: false, className: 'border-emerald-500 bg-emerald-500 hover:border-emerald-600' },
    ],
    defaultVariants: {
      size: 'buildup',
      zone: 'onskid',
      isEmpty: true,
    },
  }
)

const tagVariants = cva('rounded px-3 py-1 text-xs font-semibold shadow-sm', {
  variants: {
    zone: {
      onskid: 'bg-amber-400 text-foreground',
      offskid: 'bg-sky-400 text-white',
      newflex: 'bg-amber-400 text-foreground',
    },
  },
  defaultVariants: {
    zone: 'onskid',
  },
})

interface CompactStationCardProps extends VariantProps<typeof stationCardVariants> {
  /** Station kind determines the badge prefix (B/W/T) */
  kind: ProjectBoardWorkAreaKind
  /** Station number (1-6 for build, 1-5 for wiring, etc.) */
  stationNumber: number | string
  /** Optional assigned project */
  assignment?: AssignedProject | null
  /** Optional assigned member */
  assignedMember?: AssignedMember | null
  /** Click handler - typically opens assign project modal */
  onClick?: () => void
  /** Whether the card is selected */
  isSelected?: boolean
  /** Additional class names */
  className?: string
  /** Whether to show the diagonal stripe pattern (unavailable area) */
  showUnavailable?: boolean
  /** Station size variant - affects dimensions */
  size?: StationSizeVariant
  /** Zone color variant - affects colors */
  zone?: ZoneColorVariant
}

export function CompactStationCard({
  kind,
  stationNumber,
  assignment,
  assignedMember,
  onClick,
  isSelected = false,
  className,
  showUnavailable = false,
  size = 'buildup',
  zone = 'onskid',
}: CompactStationCardProps) {
  const isEmpty = !assignment

  return (
    <div className={cn('flex flex-col items-center gap-2 ', className)}>
      {/* Station Badge */}
      <StationBadge kind={kind} stationNumber={stationNumber} zone={zone} />

      {/* Card */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          stationCardVariants({ size, zone, isEmpty }),
          isSelected && 'ring-2 ring-primary ring-offset-2',
          showUnavailable && 'pointer-events-none'
        )}
        disabled={showUnavailable}
      >
        {/* Unavailable diagonal stripe overlay */}
        {showUnavailable && (
          <div
            className="absolute inset-0 z-10"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                rgba(255,255,255,0.4),
                rgba(255,255,255,0.4) 8px,
                transparent 8px,
                transparent 16px
              )`,
            }}
          />
        )}

        {isEmpty ? (
          /* Empty State */
          <div className="flex flex-1 flex-col items-center justify-center p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/80 text-slate-400 shadow-sm transition-colors group-hover:bg-white group-hover:text-slate-500">
              <Plus className="size-5" strokeWidth={2.5} />
            </div>
            {/* Bottom placeholder bar */}
            <div className="absolute bottom-4 left-3 right-3">
              <div className="h-6 rounded bg-white/60 shadow-sm" />
            </div>
          </div>
        ) : (
          /* Assigned State */
          <div className="flex flex-1 flex-col justify-between p-3">
            {/* Project Name */}
            <div className="text-center">
              <h3 className="text-lg font-bold tracking-wide text-white">
                {assignment.name}
              </h3>
            </div>

            {/* Tag */}
            <div className="flex justify-center">
              <span className={tagVariants({ zone })}>
                {assignment.tag}
              </span>
            </div>

            {/* Progress Bar */}
            <StationProgressBar
              progress={assignment.progress}
              variant={assignment.progress >= 80 ? 'green' : 'mixed'}
            />
          </div>
        )}
      </button>

      {/* Assigned Member Badge (shown below card when assigned) */}
      {assignedMember && (
        <UserBadge
          initials={assignedMember.initials}
          name={assignedMember.name}
        />
      )}
    </div>
  )
}
