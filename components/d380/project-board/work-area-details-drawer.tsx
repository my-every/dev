'use client'

import { ClipboardList, LayoutTemplate } from 'lucide-react'

import { AssignmentRecommendationPanel } from '@/components/d380/project-board/assignment-recommendation-panel'
import { WorkAreaAssignmentStack } from '@/components/d380/project-board/work-area-assignment-stack'
import { WorkAreaLoadIndicator } from '@/components/d380/project-board/work-area-load-indicator'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { ProjectBoardWorkAreaDetailsViewModel } from '@/types/d380-project-board'

export function WorkAreaDetailsDrawer({
  open,
  onOpenChange,
  details,
  onSelectAssignment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  details?: ProjectBoardWorkAreaDetailsViewModel
  onSelectAssignment: (assignmentId: string) => void
}) {
  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-xl border-l border-border/70 bg-accent/40">
        {details ? (
          <>
            <DrawerHeader className="border-b border-border/60 px-6 py-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">{details.workArea.stationCode}</div>
              <DrawerTitle className="mt-1 text-2xl text-foreground">{details.workArea.label}</DrawerTitle>
              <DrawerDescription className="text-sm leading-6 text-foreground/60">{details.workArea.kindLabel} · Capacity {details.workArea.capacity} · {details.workArea.notes}</DrawerDescription>
            </DrawerHeader>

            <ScrollArea className="h-full px-6 py-5">
              <div className="space-y-6 pb-8">
                <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/44">
                    <LayoutTemplate className="size-4" />
                    Work area load
                  </div>
                  <div className="mt-4">
                    <WorkAreaLoadIndicator load={details.workArea.load} />
                  </div>
                </div>

                <div className="space-y-4 rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/44">
                    <ClipboardList className="size-4" />
                    Active assignments
                  </div>
                  <WorkAreaAssignmentStack assignments={details.workArea.activeAssignments} onSelectAssignment={onSelectAssignment} />
                </div>

                <Separator className="bg-border" />

                <AssignmentRecommendationPanel
                  title="Recommended assignments"
                  assignments={details.recommendedAssignments}
                  onSelectAssignment={onSelectAssignment}
                />

                <AssignmentRecommendationPanel
                  title="Eligible assignments"
                  assignments={details.eligibleAssignments}
                  onSelectAssignment={onSelectAssignment}
                />
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}