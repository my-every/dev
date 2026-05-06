'use client'

import { ArrowRightLeft, GraduationCap, Handshake, UserPlus } from 'lucide-react'

import { MemberRecommendationPanel } from '@/components/d380/project-board/member-recommendation-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type {
  ProjectBoardPlacementDrawerViewModel,
  ProjectBoardPlacementMode,
} from '@/types/d380-project-board'

const modeMeta: Record<ProjectBoardPlacementMode, { label: string; icon: React.ReactNode }> = {
  place: { label: 'Place', icon: <UserPlus className="size-4" /> },
  reassign: { label: 'Reassign', icon: <ArrowRightLeft className="size-4" /> },
  takeover: { label: 'Takeover', icon: <Handshake className="size-4" /> },
}

export function AssignmentPlacementDrawer({
  open,
  onOpenChange,
  placement,
  selectedMemberIds,
  onToggleMember,
  traineePairing,
  onTraineePairingChange,
  mode,
  onModeChange,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  placement?: ProjectBoardPlacementDrawerViewModel
  selectedMemberIds: string[]
  onToggleMember: (memberId: string) => void
  traineePairing: boolean
  onTraineePairingChange: (value: boolean) => void
  mode: ProjectBoardPlacementMode
  onModeChange: (value: ProjectBoardPlacementMode) => void
  onApply: () => void
}) {
  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-2xl border-l border-border/70 bg-card">
        {placement ? (
          <>
            <DrawerHeader className="border-b border-border/60 px-6 py-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">{placement.workArea.stationCode}</div>
              <DrawerTitle className="mt-1 text-2xl text-foreground">Place {placement.assignment.sheetName}</DrawerTitle>
              <DrawerDescription className="text-sm leading-6 text-foreground/60">
                {placement.assignment.projectName} · {placement.assignment.stageLabel} · {placement.assignment.requiredRoleLabel}
              </DrawerDescription>
            </DrawerHeader>

            <ScrollArea className="h-full px-6 py-5">
              <div className="space-y-6 pb-8">
                <div className="rounded-[28px] border border-border/70 bg-accent/40 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-border/70 bg-card px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/62">{placement.assignment.priorityLabel}</Badge>
                    <Badge variant="outline" className="rounded-full border-border/70 bg-card px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/62">{placement.assignment.statusLabel}</Badge>
                    <Badge variant="outline" className="rounded-full border-border/70 bg-card px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/62">{placement.workArea.kindLabel}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-foreground/62">{placement.assignment.statusNote}</p>
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Placement mode</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(['place', 'reassign', 'takeover'] as ProjectBoardPlacementMode[]).map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onModeChange(value)}
                        className={cn('flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors', mode === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-background text-foreground/66')}
                      >
                        {modeMeta[value].icon}
                        {modeMeta[value].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-[24px] border border-border/70 bg-accent/40 px-4 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/44">
                      <GraduationCap className="size-4" />
                      Trainee pairing
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground/60">Allow a less experienced member to ride with an experienced lead for this placement.</p>
                  </div>
                  <Switch checked={traineePairing} onCheckedChange={onTraineePairingChange} />
                </div>

                <Separator className="bg-border" />

                <div className="space-y-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Recommended members</div>
                  <MemberRecommendationPanel members={placement.recommendedMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} />
                </div>

                <div className="space-y-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">All eligible members</div>
                  <MemberRecommendationPanel members={placement.eligibleMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} />
                </div>
              </div>
            </ScrollArea>

            <DrawerFooter className="border-t border-border/60 bg-card px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-foreground/58">{selectedMemberIds.length} member{selectedMemberIds.length === 1 ? '' : 's'} selected</p>
                <Button className="rounded-full px-5" disabled={selectedMemberIds.length === 0} onClick={onApply}>
                  Apply placement
                </Button>
              </div>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}
