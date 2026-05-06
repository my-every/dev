'use client'

import { FileText, FolderOpen, LayoutGrid, Share2, TrendingUp, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const tabIcons: Record<string, React.ElementType> = {
  OVERVIEW: LayoutGrid,
  ASSIGNMENTS: FileText,
  FILES: FolderOpen,
  PROGRESS: TrendingUp,
  TEAM_ASSIGNMENTS: Users,
  EXPORTS: Share2,
}

export function ProjectWorkspaceTabs({
  tabs,
  activeTab,
}: {
  tabs: Array<{
    id: string
    label: string
    badge?: string
  }>
  activeTab: string
}) {
  return (
    <TabsList className="h-auto w-full flex-wrap justify-start gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1.5 backdrop-blur-sm">
      {tabs.map(tab => {
        const Icon = tabIcons[tab.id]
        const isActive = activeTab === tab.id
        const hasBadge = tab.badge && tab.badge !== '0'

        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
              'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
              'data-[state=inactive]:text-foreground/60 data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground/80'
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-primary' : 'text-foreground/50'
                )}
              />
            )}
            <span>{tab.label}</span>
            {hasBadge && (
              <Badge
                variant={isActive ? 'default' : 'secondary'}
                className={cn(
                  'ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-[10px] font-semibold',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-foreground/10 text-foreground/60'
                )}
              >
                {tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
