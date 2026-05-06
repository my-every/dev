'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Play, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { BuildUpSectionViewModel, BuildUpWorkflowSectionId } from '@/types/d380-build-up'

const displayStateClasses: Record<BuildUpSectionViewModel['displayState'], string> = {
  current: 'border-primary/40 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.14)]',
  available: 'border-emerald-300/70 bg-card/92',
  blocked: 'border-red-300/80 bg-red-50/92',
  future: 'border-border/70 bg-card/82',
  complete: 'border-sky-200/80 bg-sky-50/90',
}

const statusClasses: Record<BuildUpSectionViewModel['status'], string> = {
  NOT_STARTED: 'border-border/70 bg-muted/50 text-foreground/70',
  IN_PROGRESS: 'border-primary/22 bg-primary/10 text-primary',
  BLOCKED: 'border-red-300/80 bg-red-500/10 text-red-700',
  COMPLETE: 'border-sky-300/80 bg-sky-500/10 text-sky-700',
}

const itemToneClasses: Record<BuildUpSectionViewModel['items'][number]['tone'], string> = {
  neutral: 'bg-muted/50 text-foreground/74',
  positive: 'bg-emerald-500/10 text-emerald-800',
  attention: 'bg-amber-500/12 text-amber-900',
}

export function BuildUpSectionCard({
  section,
  onStart,
  onComplete,
  onToggleChecklistItem,
  onToggleBlocked,
  onSetComment,
  onSetBlockedReason,
  onAddProgressUpdate,
}: {
  section: BuildUpSectionViewModel
  onStart: (sectionId: BuildUpWorkflowSectionId) => void
  onComplete: (sectionId: BuildUpWorkflowSectionId) => void
  onToggleChecklistItem: (sectionId: BuildUpWorkflowSectionId, checklistItemId: string) => void
  onToggleBlocked: (sectionId: BuildUpWorkflowSectionId) => void
  onSetComment: (sectionId: BuildUpWorkflowSectionId, comment: string) => void
  onSetBlockedReason: (sectionId: BuildUpWorkflowSectionId, reason: string) => void
  onAddProgressUpdate: (sectionId: BuildUpWorkflowSectionId, update: string) => void
}) {
  const [progressInput, setProgressInput] = useState('')

  return (
    <Card className={cn('rounded-[32px] py-0 shadow-[0_14px_50px_rgba(0,0,0,0.08)]', displayStateClasses[section.displayState])}>
      <CardContent className="space-y-6 px-6 py-6 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]', statusClasses[section.status])}>
                {section.statusLabel}
              </Badge>
              {section.isActionable ? (
                <Badge variant="outline" className="rounded-full border-emerald-300/60 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-800">
                  Current gate
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{section.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/64">{section.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {section.canStart ? (
              <Button variant="outline" className="rounded-2xl bg-background/88" onClick={() => onStart(section.id)}>
                <Play className="size-4" />
                {section.status === 'NOT_STARTED' ? 'Start' : 'Resume'}
              </Button>
            ) : null}
            {section.canComplete ? (
              <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onComplete(section.id)}>
                <CheckCircle2 className="size-4" />
                Complete
              </Button>
            ) : null}
            {section.status !== 'COMPLETE' ? (
              <Button variant="ghost" className="rounded-2xl border border-border/70 bg-muted/40" onClick={() => onToggleBlocked(section.id)}>
                <ShieldAlert className="size-4" />
                {section.status === 'BLOCKED' ? 'Unblock' : 'Block'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {section.stats.map(stat => (
                <div key={stat.id} className="rounded-[22px] border border-border/70 bg-muted/50 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">{stat.label}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{stat.value}</div>
                  <p className="mt-2 text-sm leading-6 text-foreground/62">{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Dependencies</div>
                <p className="mt-2 text-sm leading-6 text-foreground/68">{section.dependencySummary}</p>
                <div className="mt-4 text-[11px] uppercase tracking-[0.2em] text-foreground/42">Readiness</div>
                <p className="mt-2 text-sm leading-6 text-foreground/68">{section.readinessSummary}</p>
                <div className="mt-4 rounded-[18px] border border-border/70 bg-muted/55 px-4 py-4 text-sm leading-6 text-foreground/78">
                  {section.note}
                </div>
                {section.startedAtLabel || section.completedAtLabel ? (
                  <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em] text-foreground/46">
                    {section.startedAtLabel ? <span>Started {section.startedAtLabel}</span> : null}
                    {section.completedAtLabel ? <span>Completed {section.completedAtLabel}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/42">
                  <CircleDashed className="size-4" />
                  Checklist
                </div>
                <div className="mt-4 space-y-3">
                  {section.checklist.map(item => (
                    <label key={item.id} className="flex items-start gap-3 rounded-[18px] bg-muted/50 px-3 py-3 text-sm leading-6 text-foreground/72">
                      <Checkbox checked={item.completed} onCheckedChange={() => onToggleChecklistItem(section.id, item.id)} className="mt-1 border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                      <span>
                        {item.label}
                        {item.required ? <span className="ml-2 text-[11px] uppercase tracking-[0.18em] text-foreground/42">Required</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {section.items.map(item => (
                <div key={item.id} className={cn('rounded-[24px] border border-border/70 px-4 py-4', itemToneClasses[item.tone])}>
                  <div className="text-[11px] uppercase tracking-[0.2em]">{item.eyebrow}</div>
                  <h3 className="mt-2 text-base font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6">{item.description}</p>
                  {item.chips.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.chips.map(chip => (
                        <Badge key={`${item.id}-${chip}`} variant="outline" className="rounded-full border-current/20 bg-card/65 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-current">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Commentary</div>
              <Textarea value={section.comment} onChange={event => onSetComment(section.id, event.target.value)} className="mt-3 min-h-32 rounded-[18px] border-border bg-background/80 text-foreground" placeholder="Capture local shift notes, install exceptions, or handoff context." />
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/42">
                <AlertTriangle className="size-4" />
                Block reason
              </div>
              <Input value={section.blockedReason ?? ''} onChange={event => onSetBlockedReason(section.id, event.target.value)} className="mt-3 rounded-[18px] border-border bg-background/80 text-foreground" placeholder="Explain what is preventing this section from closing." />
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Progress log</div>
              <div className="mt-3 flex gap-2">
                <Input value={progressInput} onChange={event => setProgressInput(event.target.value)} className="rounded-[18px] border-border bg-background/80 text-foreground" placeholder="Add a timestamped update for this section." />
                <Button
                  variant="outline"
                  className="rounded-[18px] bg-background/88"
                  onClick={() => {
                    onAddProgressUpdate(section.id, progressInput)
                    setProgressInput('')
                  }}
                >
                  Add
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {section.progressUpdates.length > 0 ? section.progressUpdates.map(update => (
                  <div key={`${section.id}-${update}`} className="rounded-[18px] bg-muted/50 px-3 py-3 text-sm leading-6 text-foreground/70">
                    {update}
                  </div>
                )) : (
                  <div className="rounded-[18px] bg-muted/50 px-3 py-3 text-sm leading-6 text-foreground/58">
                    No progress updates logged yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}