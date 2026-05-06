'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import { NotificationsCenter } from '@/components/d380/notifications/notifications-center'
import { buildNotificationsViewModel, getNotificationsDataSet } from '@/lib/view-models/d380-notifications'
import type { D380NotificationsDataSet, NotificationFilterState } from '@/types/d380-notifications'

const DEFAULT_FILTERS: NotificationFilterState = {
  searchText: '',
  projectId: 'ALL',
  type: 'ALL',
  unreadOnly: false,
  statusTab: 'ALL',
}

export function NotificationsRoute() {
  const [dataSet, setDataSet] = useState<D380NotificationsDataSet>(() => getNotificationsDataSet())
  const [filters, setFilters] = useState<NotificationFilterState>(DEFAULT_FILTERS)
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | undefined>()
  const [detailOpen, setDetailOpen] = useState(false)

  const viewModel = useMemo(() => buildNotificationsViewModel({ dataSet, filters }), [dataSet, filters])
  const selectedNotification = viewModel.notifications.find(notification => notification.id === selectedNotificationId)

  function updateFilter<K extends keyof NotificationFilterState>(key: K, value: NotificationFilterState[K]) {
    setFilters(current => ({
      ...current,
      [key]: value,
    }))
  }

  function handleToggleRead(notificationId: string) {
    setDataSet(current => ({
      ...current,
      notifications: current.notifications.map(notification => notification.id === notificationId
        ? {
            ...notification,
            isRead: !notification.isRead,
            unreadFilterKey: notification.isRead ? 'unread' : 'read',
          }
        : notification),
    }))
  }

  function handleInspect(notificationId: string) {
    setSelectedNotificationId(notificationId)
    setDetailOpen(true)
  }

  return (
    <main className="min-h-screen px-6 py-8 text-foreground md:px-10">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="mx-auto max-w-360 space-y-8">
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div className="space-y-4">
            <div className="w-fit rounded-full bg-black px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-[#f4c430]">/380/notifications</div>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Event-driven notifications with project, type, and unread filters.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-foreground/68 md:text-lg">
                This route uses the data provider layer for seamless switching between development and production data sources. Notification UX, filtering behavior, and linked actions are ready for integration.
              </p>
            </div>
          </div>

          <section className="rounded-3xl border border-black/10 bg-black px-5 py-5 text-[#f4c430] shadow-xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#f4c430]/68">Data provider integration</div>
            <p className="mt-3 text-sm leading-6 text-[#f4c430]/78">
              Components and route interactions use the data provider layer for seamless switching between development, Share files, and future Electron integration.
            </p>
          </section>
        </section>

        <NotificationsCenter
          viewModel={viewModel}
          filters={filters}
          onSearchTextChange={value => updateFilter('searchText', value)}
          onProjectChange={value => updateFilter('projectId', value)}
          onTypeChange={value => updateFilter('type', value)}
          onUnreadOnlyChange={value => updateFilter('unreadOnly', value)}
          onStatusTabChange={value => updateFilter('statusTab', value)}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          onToggleRead={handleToggleRead}
          onInspect={handleInspect}
          selectedNotification={selectedNotification}
          detailOpen={detailOpen}
          onDetailOpenChange={setDetailOpen}
        />
      </motion.div>
    </main>
  )
}
