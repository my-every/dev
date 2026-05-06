import { cn } from '@/lib/utils'
import type { ProjectBoardWorkAreaLoadViewModel } from '@/types/d380-project-board'

const barClasses: Record<ProjectBoardWorkAreaLoadViewModel['state'], string> = {
  idle: 'bg-black/12',
  balanced: 'bg-emerald-500',
  busy: 'bg-amber-500',
  'over-capacity': 'bg-red-500',
}

const dotClasses: Record<ProjectBoardWorkAreaLoadViewModel['state'], string> = {
  idle: 'bg-black/30',
  balanced: 'bg-emerald-500',
  busy: 'bg-amber-500',
  'over-capacity': 'bg-red-500',
}

export function WorkAreaLoadIndicator({ load }: { load: ProjectBoardWorkAreaLoadViewModel }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-foreground/52">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', dotClasses[load.state])} />
          <span>{load.label}</span>
        </div>
        <span>{Math.round(load.ratio * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/8">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', barClasses[load.state])}
          style={{ width: `${Math.min(load.ratio * 100, 100)}%` }}
        />
      </div>
      <p className="text-xs leading-5 text-foreground/60">{load.detail}</p>
    </div>
  )
}