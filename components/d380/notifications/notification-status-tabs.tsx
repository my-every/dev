'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NotificationStatusTabId, NotificationStatusTabViewModel } from '@/types/d380-notifications'

export function NotificationStatusTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: NotificationStatusTabViewModel[]
  activeTab: NotificationStatusTabId
  onChange: (value: NotificationStatusTabId) => void
}) {
  return (
    <TabsList className="h-auto w-full justify-start rounded-2xl bg-muted/40 p-1.5">
      {tabs.map(tab => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          onClick={() => onChange(tab.id)}
          className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          {tab.label}
          <span className="ml-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] data-[state=active]:bg-primary-foreground/18">
            {tab.count}
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}