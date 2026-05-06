'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Play, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WiringSectionDisplayState, WiringSectionId, WiringSectionState } from '@/types/d380-wiring'

const displayStateClasses: Record<WiringSectionDisplayState, string> = {
  current: 'border-primary/40 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.14)]',
  available: 'border-emerald-300/70 bg-card/92',
  blocked: 'border-red-300/80 bg-red-50/92',
  future: 'border-border/70 bg-card/82',
  complete: 'border-sky-200/80 bg-sky-50/90',
}

const statusClasses: Record<WiringSectionState['status'], string> = {
  NOT_STARTED: 'border-border/70 bg-muted/50 text-foreground/70',
  IN_PROGRESS: 'border-primary/22 bg-primary/10 text-primary',
  BLOCKED: 'border-red-300/80 bg-red-500/10 text-red-700',
  COMPLETE: 'border-sky-300/80 bg-sky-500/10 text-sky-700',
}

export function WiringSectionCard({
  section,
  displayState,
  isActionable,
  canStart,
  canComplete,
  dependencySummary,
  categoryBadges,
  onStart,
  onComplete,
  onBlock,
  onSetComment,
  onToggleChecklistItem,
}: {
  section: WiringSectionState
  displayState: WiringSectionDisplayState
  isActionable: boolean
  canStart: boolean
  canComplete: boolean
  dependencySummary: string
  categoryBadges: string[]
  onStart: (sectionId: WiringSectionId) => void
  onComplete: (sectionId: WiringSectionId) => void
  onBlock: (sectionId: WiringSectionId, reason: string) => void
  onSetComment: (sectionId: WiringSectionId, value: string) => void
  onToggleChecklistItem: (sectionId: WiringSectionId, itemId: string) => void
}) {
  const [blockedReason, setBlockedReason] = useState(section.blockedReason ?? '')
  const commentValue = section.comments.join('\n')

  return (
    <Card className={cn('rounded-[32px] py-0 shadow-[0_14px_50px_rgba(0,0,0,0.08)]', displayStateClasses[displayState])}>
      <CardContent className="space-y-6 px-6 py-6 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]', statusClasses[section.status])}>{section.status.replaceAll('_', ' ')}</Badge>
              {isActionable ? <Badge variant="outline" className="rounded-full border-emerald-300/60 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-800">Current gate</Badge> : null}
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{section.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/64">{section.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryBadges.map(badge => (
                <Badge key={`${section.id}-${badge}`} variant="outline" className="rounded-full border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/62">{badge}</Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canStart ? (
              <Button variant="outline" className="rounded-2xl bg-background/88" onClick={() => onStart(section.id)}>
                <Play className="size-4" />
                {section.status === 'NOT_STARTED' ? 'Start' : 'Resume'}
              </Button>
            ) : null}
            {canComplete ? (
              <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onComplete(section.id)}>
                <CheckCircle2 className="size-4" />
                Complete
              </Button>
            ) : null}
            {section.status !== 'COMPLETE' ? (
              <Button variant="ghost" className="rounded-2xl border border-border/70 bg-muted/40" onClick={() => onBlock(section.id, blockedReason)}>
                <ShieldAlert className="size-4" />
                {section.status === 'BLOCKED' ? 'Unblock' : 'Block'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Dependencies</div>
              <p className="mt-2 text-sm leading-6 text-foreground/68">{dependencySummary}</p>
              {section.completedAt ? <div className="mt-4 text-xs uppercase tracking-[0.18em] text-foreground/46">Completed {section.completedAt}</div> : null}
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Checklist</div>
              <div className="mt-4 space-y-3">
                {section.checklist.map(item => (
                  <label key={item.id} className="flex items-start gap-3 rounded-[18px] bg-muted/50 px-3 py-3 text-sm leading-6 text-foreground/72">
                    <Checkbox checked={item.checked} onCheckedChange={() => onToggleChecklistItem(section.id, item.id)} className="mt-1 border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Comments</div>
              <Textarea value={commentValue} onChange={event => onSetComment(section.id, event.target.value)} className="mt-3 min-h-28 rounded-[18px] border-border bg-background/80 text-foreground" placeholder="Capture wiring notes, pull-test context, or handoff commentary." />
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/42"><AlertTriangle className="size-4" />Block reason</div>
              <Input value={blockedReason} onChange={event => setBlockedReason(event.target.value)} className="mt-3 rounded-[18px] border-border bg-background/80 text-foreground" placeholder="Explain what is preventing this wiring section from closing." />
              {section.blockedReason ? <p className="mt-3 text-sm leading-6 text-red-700">Current: {section.blockedReason}</p> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}