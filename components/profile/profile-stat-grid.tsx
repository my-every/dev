'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Users,
  Folder,
  CheckCircle,
  Clock,
  Clipboard,
  TrendingUp,
  AlertTriangle,
  BarChart,
  Star,
  Shield,
  Tag,
  Target,
  Wrench,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProfileStat } from '@/types/profile'

// ============================================================================
// ICON MAPPING
// ============================================================================

const STAT_ICONS: Record<string, typeof Users> = {
  users: Users,
  folder: Folder,
  check: CheckCircle,
  'check-circle': CheckCircle,
  clock: Clock,
  clipboard: Clipboard,
  'trending-up': TrendingUp,
  alert: AlertTriangle,
  'alert-triangle': AlertTriangle,
  'bar-chart': BarChart,
  star: Star,
  shield: Shield,
  tag: Tag,
  target: Target,
  wrench: Wrench,
  zap: Zap,
}

// ============================================================================
// COLOR MAPPING
// ============================================================================

const STAT_COLORS: Record<string, string> = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
}

const STAT_BG_COLORS: Record<string, string> = {
  default: 'bg-slate-100 dark:bg-slate-800',
  success: 'bg-emerald-100 dark:bg-emerald-900/30',
  warning: 'bg-amber-100 dark:bg-amber-900/30',
  danger: 'bg-red-100 dark:bg-red-900/30',
  info: 'bg-blue-100 dark:bg-blue-900/30',
}

// ============================================================================
// PROFILE STAT GRID COMPONENT
// ============================================================================

interface ProfileStatGridProps {
  stats: ProfileStat[]
  className?: string
  compact?: boolean
  expandable?: boolean
  selectedStatId?: string | null
  onSelectStat?: (id: string | null) => void
  renderDetail?: (stat: ProfileStat) => React.ReactNode
}

export function ProfileStatGrid({
  stats,
  className,
  compact = false,
  expandable = true,
  selectedStatId,
  onSelectStat,
  renderDetail,
}: ProfileStatGridProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null)

  const activeStatId = selectedStatId !== undefined ? selectedStatId : internalSelected

  if (stats.length === 0) return null

  const handleSelect = (id: string) => {
    const next = activeStatId === id ? null : id
    if (onSelectStat) {
      onSelectStat(next)
      return
    }
    setInternalSelected(next)
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 max-w-[430px]',
        className
      )}
    >
      {stats.map((stat) => (
        <ProfileStatItem
          key={stat.id}
          stat={stat}
          compact={compact}
          expandable={expandable}
          expanded={activeStatId === stat.id}
          onToggle={() => handleSelect(stat.id)}
          renderDetail={renderDetail}
        />
      ))}
    </div>
  )
}

// ============================================================================
// INDIVIDUAL STAT ITEM
// ============================================================================

interface ProfileStatItemProps {
  stat: ProfileStat
  compact?: boolean
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  renderDetail?: (stat: ProfileStat) => React.ReactNode
}

function ProfileStatItem({
  stat,
  compact = false,
  expandable = false,
  expanded = false,
  onToggle,
  renderDetail,
}: ProfileStatItemProps) {
  const Icon = stat.icon ? STAT_ICONS[stat.icon] : null
  const colorClass = STAT_COLORS[stat.color || 'default']
  const bgColorClass = STAT_BG_COLORS[stat.color || 'default']
  const statusTone = stat.color || 'default'

  const defaultDetail = (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      <p>
        {stat.label} is currently <span className={cn('font-semibold', colorClass)}>{stat.value}</span>.
      </p>
      {stat.changeLabel && (
        <p>
          Trend: {stat.change !== undefined ? `${stat.change > 0 ? '+' : ''}${stat.change}% ` : ''}
          {stat.changeLabel}
        </p>
      )}
      <div className="flex items-center gap-1.5 pt-1">
        <span className="text-[10px] uppercase tracking-wide">Tone</span>
        <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize">{statusTone}</span>
      </div>
    </div>
  )

  const detailContent = renderDetail ? renderDetail(stat) : defaultDetail

  return (
    <motion.button
      type="button"
      layout
      onClick={expandable ? onToggle : undefined}
      aria-expanded={expandable ? expanded : undefined}
      aria-label={expandable ? `${stat.label} stat${expanded ? ', expanded' : ''}` : undefined}
      className={cn(
        'group relative overflow-hidden rounded-xl w-full gap-4 border border-border/50 bg-card text-left backdrop-blur-sm transition-all hover:border-border hover:shadow-sm',
        expandable && expanded && 'border-primary/40 shadow-sm',
        expandable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-5">
          <p
            className={cn(
              'uppercase text-xs font-medium text-foreground/80',
              compact && 'text-[10px]'
            )}
          >
            {stat.label}
          </p>
          <p
            className={cn(
              'mt-1 truncate font-bold tabular-nums',
              compact ? 'text-lg' : 'text-2xl',
              colorClass
            )}
          >
            {stat.value}
          </p>
          {stat.changeLabel && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {stat.change !== undefined && (
                <span
                  className={cn(
                    'mr-1 font-medium',
                    stat.change > 0 && 'text-emerald-600 dark:text-emerald-400',
                    stat.change < 0 && 'text-red-600 dark:text-red-400'
                  )}
                >
                  {stat.change > 0 ? '+' : ''}
                  {stat.change}%
                </span>
              )}
              {stat.changeLabel}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {expandable && (
            <ChevronRight
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expanded && 'rotate-90',
              )}
            />
          )}

          {Icon && (
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                bgColorClass
              )}
            >
              <Icon className={cn('h-4 w-4', colorClass)} />
            </div>
          )}
        </div>
      </div>

      {expandable && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 310, damping: 28, mass: 0.6 }}
              className="overflow-hidden border-t border-dashed border-border/60 pt-3"
            >
              {detailContent}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.button>
  )
}
