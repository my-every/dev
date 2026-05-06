'use client'

import Link from 'next/link'
import { BellRing } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { DashboardWidgetCard } from '@/components/d380/dashboard/dashboard-widget-card'
import type { DashboardNotification } from '@/types/d380-dashboard'
import { cn } from '@/lib/utils'

interface NotificationsPreviewCardProps {
  notifications: DashboardNotification[]
}

const severityClasses = {
  info: 'bg-sky-100 text-sky-950',
  attention: 'bg-amber-100 text-amber-950',
  critical: 'bg-red-100 text-red-950',
} as const

export function NotificationsPreviewCard({ notifications }: NotificationsPreviewCardProps) {
  return (
    <DashboardWidgetCard
      eyebrow="Notifications"
      title="What needs attention now"
      description="Preview the latest route-worthy notices without drilling into the notifications center."
      badge={`${notifications.length} active`}
      badgeTone="attention"
      accent="obsidian"
      footer="Future providers can replace this list directly"
      actionLabel="Open notifications"
      className="h-full"
    >
      <div className="grid gap-3">
        {notifications.map(notification => (
          <div key={notification.id} className="rounded-2xl border border-[#f4c430]/16 bg-white/7 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-[#f4c430]/12 p-2 text-[#f4c430]">
                  <BellRing className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">{notification.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[#f4c430]/74">{notification.body}</div>
                </div>
              </div>
              <Badge className={cn('border-0 capitalize', severityClasses[notification.severity])}>{notification.severity}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#f4c430]/60">
              <span>{notification.category}</span>
              <span>{notification.timestampLabel}</span>
            </div>
            {notification.actionLabel && notification.linkedRoute ? (
              <div className="mt-3 border-t border-[#f4c430]/12 pt-3 text-sm">
                <Link href={notification.linkedRoute} className="font-medium text-[#f4c430] hover:text-white">
                  {notification.actionLabel}
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </DashboardWidgetCard>
  )
}