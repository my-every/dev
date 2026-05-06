'use client'

import { BellRing, FlagTriangleRight, FolderKanban, ShieldAlert } from 'lucide-react'

import { NotificationEmptyState } from '@/components/d380/notifications/notification-empty-state'
import { NotificationDetailSheet } from '@/components/d380/notifications/notification-detail-sheet'
import { NotificationFilterBar } from '@/components/d380/notifications/notification-filter-bar'
import { NotificationList } from '@/components/d380/notifications/notification-list'
import { NotificationStatusTabs } from '@/components/d380/notifications/notification-status-tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import type { D380NotificationsViewModel, NotificationFilterState } from '@/types/d380-notifications'

export function NotificationsCenter({
  viewModel,
  filters,
  onSearchTextChange,
  onProjectChange,
  onTypeChange,
  onUnreadOnlyChange,
  onStatusTabChange,
  onReset,
  onToggleRead,
  onInspect,
  selectedNotification,
  detailOpen,
  onDetailOpenChange,
}: {
  viewModel: D380NotificationsViewModel
  filters: NotificationFilterState
  onSearchTextChange: (value: string) => void
  onProjectChange: (value: string) => void
  onTypeChange: (value: NotificationFilterState['type']) => void
  onUnreadOnlyChange: (value: boolean) => void
  onStatusTabChange: (value: NotificationFilterState['statusTab']) => void
  onReset: () => void
  onToggleRead: (notificationId: string) => void
  onInspect: (notificationId: string) => void
  selectedNotification?: D380NotificationsViewModel['notifications'][number]
  detailOpen: boolean
  onDetailOpenChange: (open: boolean) => void
}) {
  return (
    <>
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[28px] border-border/70 bg-card/82 py-0 shadow-[0_18px_80px_rgba(0,0,0,0.1)]">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42"><BellRing className="size-4" /> Total events</div>
            <div className="mt-3 text-3xl font-semibold text-foreground">{viewModel.summary.total}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/70 bg-card/82 py-0 shadow-[0_18px_80px_rgba(0,0,0,0.1)]">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42"><FlagTriangleRight className="size-4" /> Unread</div>
            <div className="mt-3 text-3xl font-semibold text-foreground">{viewModel.summary.unread}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/70 bg-card/82 py-0 shadow-[0_18px_80px_rgba(0,0,0,0.1)]">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42"><ShieldAlert className="size-4" /> Blockers</div>
            <div className="mt-3 text-3xl font-semibold text-foreground">{viewModel.summary.blocked}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/70 bg-card/82 py-0 shadow-[0_18px_80px_rgba(0,0,0,0.1)]">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42"><FolderKanban className="size-4" /> Active projects</div>
            <div className="mt-3 text-3xl font-semibold text-foreground">{viewModel.summary.projects}</div>
          </CardContent>
        </Card>
      </div>

      <NotificationFilterBar
        filters={filters}
        projectOptions={viewModel.projectOptions}
        typeOptions={viewModel.typeOptions}
        onSearchTextChange={onSearchTextChange}
        onProjectChange={onProjectChange}
        onTypeChange={onTypeChange}
        onUnreadOnlyChange={onUnreadOnlyChange}
        onReset={onReset}
      />

      <Tabs value={filters.statusTab} className="space-y-4">
        <NotificationStatusTabs tabs={viewModel.statusTabs} activeTab={filters.statusTab} onChange={onStatusTabChange} />
      </Tabs>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-foreground/62">Operating date {viewModel.operatingDateLabel}</div>
        <Badge variant="secondary" className="bg-black text-[#f4c430]">
          Event feed
        </Badge>
      </div>

      {viewModel.notifications.length > 0 ? (
        <NotificationList notifications={viewModel.notifications} onToggleRead={onToggleRead} onInspect={onInspect} />
      ) : (
        <NotificationEmptyState title={viewModel.emptyState.title} description={viewModel.emptyState.description} />
      )}
    </section>
    <NotificationDetailSheet notification={selectedNotification} open={detailOpen} onOpenChange={onDetailOpenChange} />
    </>
  )
}
