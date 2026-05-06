'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, Users } from 'lucide-react'

import { WorkAreaAssignmentStack } from '@/components/d380/project-board/work-area-assignment-stack'
import { WorkAreaLoadIndicator } from '@/components/d380/project-board/work-area-load-indicator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProjectBoardWorkAreaCardViewModel } from '@/types/d380-project-board'

export function WorkAreaCard({
  workArea,
  isSelected,
  onSelect,
  onOpenDetails,
}: {
  workArea: ProjectBoardWorkAreaCardViewModel
  isSelected: boolean
  onSelect: () => void
  onOpenDetails: () => void
}) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      <Card className={cn('overflow-hidden rounded-[28px] border bg-card/88 py-0 shadow-[0_20px_80px_rgba(0,0,0,0.1)] transition-colors', isSelected ? 'border-primary bg-accent/70' : 'border-border/70')}>
        <button type="button" className="w-full text-left" onClick={onSelect}>
          <CardContent className="space-y-5 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">{workArea.stationCode}</div>
                <h3 className="mt-1 text-xl font-semibold text-foreground">{workArea.label}</h3>
                <p className="mt-1 text-sm text-foreground/60">{workArea.kindLabel}</p>
              </div>
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/62">
                Cap {workArea.capacity}
              </Badge>
            </div>

            <WorkAreaLoadIndicator load={workArea.load} />

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-foreground/44">
                  <Users className="size-4" />
                  Assigned members
                </div>
                <div className="flex flex-wrap gap-2">
                  {workArea.assignedMembers.length > 0 ? workArea.assignedMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/68">
                      <Avatar className="size-6 border border-border/70 bg-card">
                        <AvatarFallback className="bg-[#f4c430] text-[10px] font-semibold text-foreground">{member.initials}</AvatarFallback>
                      </Avatar>
                      <span>{member.name}</span>
                    </div>
                  )) : (
                    <div className="rounded-full border border-dashed border-border/80 px-3 py-1.5 text-xs text-muted-foreground">No members assigned</div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl bg-black px-4 py-3 text-[#f4c430]">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#f4c430]/68">Active work</div>
                <div className="mt-2 text-2xl font-semibold text-white">{workArea.activeAssignments.length}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/44">Assignments</div>
              <WorkAreaAssignmentStack assignments={workArea.activeAssignments} />
            </div>
          </CardContent>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-4">
          <p className="max-w-sm text-sm leading-6 text-foreground/58">{workArea.notes}</p>
          <Button variant="secondary" size="sm" className="rounded-full" onClick={onOpenDetails}>
            Details
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}