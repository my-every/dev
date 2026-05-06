'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { NotificationCardViewModel } from '@/types/d380-notifications'

const severityClasses = {
  info: 'bg-sky-100 text-sky-950',
  success: 'bg-emerald-100 text-emerald-950',
  warning: 'bg-amber-100 text-amber-950',
  error: 'bg-red-100 text-red-950',
} as const

export function NotificationDetailSheet({
  notification,
  open,
  onOpenChange,
}: {
  notification?: NotificationCardViewModel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl border-l border-border/70 bg-accent/35 sm:max-w-xl">
        {notification ? (
          <>
            <SheetHeader className="border-b border-border/60 px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={severityClasses[notification.severity]}>{notification.severity}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background text-[11px] uppercase tracking-[0.2em] text-foreground/62">
                  {notification.eventTypeLabel}
                </Badge>
              </div>
              <SheetTitle className="mt-3 text-2xl text-foreground">{notification.title}</SheetTitle>
              <SheetDescription className="text-sm leading-6 text-foreground/62">
                {notification.createdAtLabel} · created by badge {notification.createdByBadge}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-6 py-6">
              <section className="rounded-3xl border border-border/70 bg-card/82 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Message</div>
                <p className="mt-3 text-sm leading-7 text-foreground/72">{notification.rawMessage}</p>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-border/70 bg-card/82 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Project</div>
                  <div className="mt-3 text-base font-semibold text-foreground">{notification.rawPdNumber} · {notification.projectName}</div>
                </div>
                <div className="rounded-3xl border border-border/70 bg-card/82 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Assignment</div>
                  <div className="mt-3 text-base font-semibold text-foreground">{notification.rawSheetName ?? 'Project-level event'}</div>
                </div>
                <div className="rounded-3xl border border-border/70 bg-card/82 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Stage</div>
                  <div className="mt-3 text-base font-semibold text-foreground">{notification.stage ?? 'Project'}</div>
                </div>
                <div className="rounded-3xl border border-border/70 bg-card/82 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Recipients</div>
                  <div className="mt-3 text-base font-semibold text-foreground">{notification.recipientSummary}</div>
                </div>
              </section>

              <section className="rounded-3xl border border-black/10 bg-black p-5 text-[#f4c430] shadow-[0_14px_42px_rgba(0,0,0,0.16)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/66">Linked action</div>
                <div className="mt-2 text-sm leading-6 text-[#f4c430]/78">Use this seam to inspect the event here, then jump to the project or assignment route that would eventually be backed by persisted notification state.</div>
                <Button asChild className="mt-4 rounded-full" variant="secondary">
                  <Link href={notification.routeHref}>{notification.routeLabel}</Link>
                </Button>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}