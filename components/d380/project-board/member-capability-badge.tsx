import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProjectBoardMemberCapabilityBadgeViewModel } from '@/types/d380-project-board'

const toneClasses: Record<ProjectBoardMemberCapabilityBadgeViewModel['tone'], string> = {
  neutral: 'border-border/70 bg-muted/50 text-foreground/72',
  positive: 'border-emerald-300/80 bg-emerald-500/12 text-emerald-700',
  attention: 'border-amber-300/90 bg-amber-400/18 text-amber-900',
}

export function MemberCapabilityBadge({ badge }: { badge: ProjectBoardMemberCapabilityBadgeViewModel }) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2.5 py-1 text-[11px] tracking-[0.14em] uppercase', toneClasses[badge.tone])}
    >
      {badge.label}
    </Badge>
  )
}