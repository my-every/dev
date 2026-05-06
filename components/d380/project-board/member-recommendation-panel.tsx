import { Star } from 'lucide-react'

import { MemberCapabilityBadge } from '@/components/d380/project-board/member-capability-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ProjectBoardMemberRecommendationViewModel } from '@/types/d380-project-board'

export function MemberRecommendationPanel({
  members,
  selectedMemberIds,
  onToggleMember,
}: {
  members: ProjectBoardMemberRecommendationViewModel[]
  selectedMemberIds: string[]
  onToggleMember: (memberId: string) => void
}) {
  return (
    <div className="space-y-3">
      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">
          No eligible members match this assignment and work area combination.
        </div>
      ) : members.map(member => {
        const isSelected = selectedMemberIds.includes(member.id)

        return (
          <label key={member.id} className={cn('flex cursor-pointer gap-3 rounded-2xl border px-4 py-4 transition-colors', isSelected ? 'border-primary bg-accent/45' : 'border-border/70 bg-card')}>
            <Checkbox checked={isSelected} onCheckedChange={() => onToggleMember(member.id)} className="mt-1" />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 border border-border/70 bg-[#f4c430]">
                    <AvatarFallback className="bg-[#f4c430] text-sm font-semibold text-foreground">{member.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">{member.name}</div>
                    <div className="text-sm text-foreground/58">{member.roleLabel} · {member.shiftLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f4c430]">
                  <Star className="size-3.5" />
                  {member.score}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {member.capabilityBadges.map(badge => <MemberCapabilityBadge key={`${member.id}-${badge.label}`} badge={badge} />)}
              </div>
              <div className="space-y-1 text-sm leading-6 text-foreground/62">
                {member.reasons.map(reason => <div key={reason}>• {reason}</div>)}
              </div>
            </div>
          </label>
        )
      })}
    </div>
  )
}