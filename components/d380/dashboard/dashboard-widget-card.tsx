'use client'

import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DashboardWidgetCardProps {
  eyebrow?: string
  title: string
  description?: string
  badge?: string
  badgeTone?: 'neutral' | 'positive' | 'attention'
  accent?: 'obsidian' | 'amber' | 'cream'
  footer?: string
  actionLabel?: string
  className?: string
  children?: React.ReactNode
}

const badgeToneClasses = {
  neutral: 'bg-muted text-foreground',
  positive: 'bg-emerald-100 text-emerald-950',
  attention: 'bg-amber-200 text-amber-950',
} as const

const accentClasses = {
  obsidian: 'border-black/10 bg-black text-[#f4c430] shadow-[0_18px_60px_rgba(0,0,0,0.14)]',
  amber: 'border-border/70 bg-[#f4c430]/35 text-foreground',
  cream: 'border-border/70 bg-card/82 text-foreground',
} as const

export function DashboardWidgetCard({
  eyebrow,
  title,
  description,
  badge,
  badgeTone = 'neutral',
  accent = 'cream',
  footer,
  actionLabel,
  className,
  children,
}: DashboardWidgetCardProps) {
  const isDark = accent === 'obsidian'

  return (
    <Card className={cn('gap-0 rounded-[28px] py-0 shadow-none', accentClasses[accent], className)}>
      <CardHeader className="gap-3 px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          {eyebrow ? (
            <div className={cn('text-[11px] font-medium uppercase tracking-[0.28em]', isDark ? 'text-[#f4c430]/68' : 'text-foreground/45')}>
              {eyebrow}
            </div>
          ) : <span />}
          {badge ? <Badge className={cn('border-0', badgeToneClasses[badgeTone])}>{badge}</Badge> : null}
        </div>
        <CardTitle className={cn('text-xl tracking-tight', isDark && 'text-white')}>{title}</CardTitle>
        {description ? (
          <CardDescription className={cn('text-sm leading-6', isDark ? 'text-[#f4c430]/76' : 'text-foreground/62')}>
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      {children ? <CardContent className="px-5 pb-5 pt-4">{children}</CardContent> : null}
      {footer || actionLabel ? (
        <CardFooter className={cn('justify-between px-5 pb-5 pt-0 text-sm', isDark ? 'text-[#f4c430]/72' : 'text-foreground/58')}>
          <span>{footer}</span>
          {actionLabel ? (
            <span className={cn('inline-flex items-center gap-2 font-medium', isDark ? 'text-[#f4c430]' : 'text-foreground')}>
              {actionLabel}
              <ArrowRight className="size-4" />
            </span>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}