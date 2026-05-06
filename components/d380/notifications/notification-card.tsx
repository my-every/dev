'use client'

import Link from 'next/link'
import { AlertTriangle, BellRing, CheckCircle2, CircleDot, Eye, MailWarning } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NotificationCardViewModel } from '@/types/d380-notifications'

const severityStyles = {
  info: 'bg-sky-100 text-sky-950',
  success: 'bg-emerald-100 text-emerald-950',
  warning: 'bg-amber-100 text-amber-950',
  error: 'bg-red-100 text-red-950',
} as const

const severityIcons = {
  info: BellRing,
  success: CheckCircle2,
  warning: MailWarning,
  error: AlertTriangle,
} as const

export function NotificationCard({
  notification,
  onToggleRead,
  onInspect,
}: {
  notification: NotificationCardViewModel
  onToggleRead: (notificationId: string) => void
  onInspect: (notificationId: string) => void
}) {
  const SeverityIcon = severityIcons[notification.severity]

  return (
    <article className={cn('rounded-[28px] border p-5 shadow-[0_14px_60px_rgba(0,0,0,0.08)] transition-colors', notification.isRead ? 'border-border/60 bg-card/72' : 'border-border/80 bg-card')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn('rounded-2xl p-3', severityStyles[notification.severity])}>
            <SeverityIcon className="size-5" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{notification.title}</h3>
              {!notification.isRead ? <CircleDot className="size-4 text-[#d99a10]" /> : null}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-foreground/68">{notification.message}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn('border-0', severityStyles[notification.severity])}>{notification.severity}</Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-background text-[11px] uppercase tracking-[0.2em] text-foreground/62">
            {notification.eventTypeLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-foreground/62 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Project</div>
          <div className="mt-1 font-medium text-foreground">{notification.pdNumber} · {notification.projectName}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Assignment</div>
          <div className="mt-1 font-medium text-foreground">{notification.sheetName ?? 'Project-level event'}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Stage</div>
          <div className="mt-1 font-medium text-foreground">{notification.stage ?? 'Project'}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Recipients</div>
          <div className="mt-1 font-medium text-foreground">{notification.recipientSummary}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="text-xs uppercase tracking-[0.18em] text-foreground/48">
          {notification.createdAtLabel} · badge {notification.createdByBadge}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => onInspect(notification.id)}>
            <Eye className="size-4" />
            Inspect
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => onToggleRead(notification.id)}>
            {notification.isRead ? 'Mark unread' : 'Mark read'}
          </Button>
          <Button asChild className="rounded-full">
            <Link href={notification.routeHref}>{notification.routeLabel}</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}