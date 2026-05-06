'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface DashboardWidgetRailProps {
  title: string
  description: string
  children: React.ReactNode
  className?: string
}

export function DashboardWidgetRail({ title, description, children, className }: DashboardWidgetRailProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-foreground/62">{description}</p>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">{children}</div>
      </ScrollArea>
    </section>
  )
}