'use client'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import type { ProjectBoardWorkAreaKind } from '@/types/d380-project-board'

import type { ZoneColorVariant } from './compact-station-card'

/**
 * Map station kind to badge prefix
 * B = Build Up Table
 * W = Wiring Table
 * T = Test Station (changed from S)
 */
function getStationPrefix(kind: ProjectBoardWorkAreaKind): string {
  switch (kind) {
    case 'BUILDUP_TABLE':
      return 'B'
    case 'WIRING_TABLE':
      return 'W'
    case 'TEST_STATION':
      return 'T'
    default:
      return ''
  }
}

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm',
  {
    variants: {
      kind: {
        BUILDUP_TABLE: '',
        WIRING_TABLE: '',
        TEST_STATION: '',
        FLOAT: 'bg-muted text-foreground',
        NTB: 'bg-muted text-foreground',
        OFFICE_AREA: 'bg-muted text-foreground',
      },
      zone: {
        onskid: '',
        offskid: '',
        newflex: '',
      },
    },
    compoundVariants: [
      // ONSKID zone
      { zone: 'onskid', kind: 'BUILDUP_TABLE', className: 'bg-slate-400/90 text-white' },
      { zone: 'onskid', kind: 'WIRING_TABLE', className: 'bg-[#3b9dd9] text-white' },
      { zone: 'onskid', kind: 'TEST_STATION', className: 'bg-slate-500/90 text-white' },
      // OFFSKID zone (yellow/amber tones)
      { zone: 'offskid', kind: 'BUILDUP_TABLE', className: 'bg-amber-400/90 text-foreground' },
      { zone: 'offskid', kind: 'WIRING_TABLE', className: 'bg-amber-500 text-white' },
      { zone: 'offskid', kind: 'TEST_STATION', className: 'bg-amber-600/90 text-white' },
      // NEW/FLEX zone (green tones)
      { zone: 'newflex', kind: 'BUILDUP_TABLE', className: 'bg-emerald-400/90 text-foreground' },
      { zone: 'newflex', kind: 'WIRING_TABLE', className: 'bg-emerald-500 text-white' },
      { zone: 'newflex', kind: 'TEST_STATION', className: 'bg-emerald-600/90 text-white' },
    ],
    defaultVariants: {
      kind: 'BUILDUP_TABLE',
      zone: 'onskid',
    },
  }
)

interface StationBadgeProps extends VariantProps<typeof badgeVariants> {
  kind: ProjectBoardWorkAreaKind
  stationNumber: number | string
  zone?: ZoneColorVariant
  className?: string
}

export function StationBadge({ kind, stationNumber, zone = 'onskid', className }: StationBadgeProps) {
  const prefix = getStationPrefix(kind)
  
  if (!prefix) return null
  
  return (
    <div className={cn(badgeVariants({ kind, zone }), className)}>
      {prefix}{stationNumber}
    </div>
  )
}
