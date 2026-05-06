'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const metadataCardVariants = cva('transition-all', {
  variants: {
    variant: {
      stat: 'border-l-4',
      info: 'border border-border/70',
      progress: 'border border-border/70',
      status: 'border-l-4',
      compact: 'border-0 bg-muted/50 shadow-none',
    },
    tone: {
      neutral: '',
      positive: '',
      warning: '',
      error: '',
      info: '',
    },
  },
  compoundVariants: [
    { variant: 'stat', tone: 'neutral', className: 'border-l-slate-400' },
    { variant: 'stat', tone: 'positive', className: 'border-l-emerald-500' },
    { variant: 'stat', tone: 'warning', className: 'border-l-amber-500' },
    { variant: 'stat', tone: 'error', className: 'border-l-red-500' },
    { variant: 'stat', tone: 'info', className: 'border-l-blue-500' },
    { variant: 'status', tone: 'neutral', className: 'border-l-slate-400' },
    { variant: 'status', tone: 'positive', className: 'border-l-emerald-500' },
    { variant: 'status', tone: 'warning', className: 'border-l-amber-500' },
    { variant: 'status', tone: 'error', className: 'border-l-red-500' },
    { variant: 'status', tone: 'info', className: 'border-l-blue-500' },
  ],
  defaultVariants: {
    variant: 'stat',
    tone: 'neutral',
  },
})

const iconVariants = cva('shrink-0', {
  variants: {
    tone: {
      neutral: 'text-slate-500',
      positive: 'text-emerald-500',
      warning: 'text-amber-500',
      error: 'text-red-500',
      info: 'text-blue-500',
    },
    size: {
      sm: 'h-5 w-5',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
    },
  },
  defaultVariants: {
    tone: 'neutral',
    size: 'lg',
  },
})

export interface MetadataCardProps extends VariantProps<typeof metadataCardVariants> {
  title: string
  value: string | number
  subtitle?: string
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    direction: 'up' | 'down'
    label?: string
  }
  progress?: {
    value: number
    max?: number
    showLabel?: boolean
  }
  badge?: string
  className?: string
  onClick?: () => void
}

export function MetadataCard({
  variant = 'stat',
  tone = 'neutral',
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  trend,
  progress,
  badge,
  className,
  onClick,
}: MetadataCardProps) {
  const isClickable = !!onClick
  const CardWrapper = isClickable ? 'button' : 'div'

  return (
    <Card
      className={cn(
        metadataCardVariants({ variant, tone }),
        isClickable && 'cursor-pointer hover:shadow-md',
        className
      )}
    >
      <CardContent
        as={CardWrapper}
        onClick={onClick}
        className={cn(
          'flex w-full gap-4 p-4',
          variant === 'compact' && 'p-3',
          isClickable && 'text-left'
        )}
      >
        {/* Icon */}
        {Icon && variant !== 'compact' && (
          <div className="flex items-start">
            <Icon className={iconVariants({ tone, size: variant === 'progress' ? 'md' : 'lg' })} />
          </div>
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-sm text-muted-foreground',
                variant === 'compact' && 'text-xs'
              )}
            >
              {title}
            </span>
            {badge && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {badge}
              </span>
            )}
          </div>

          {/* Value row */}
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-2xl font-bold',
                variant === 'compact' && 'text-lg'
              )}
            >
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-sm font-medium',
                  trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {trend.direction === 'up' ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
                {trend.value}%
                {trend.label && (
                  <span className="ml-1 text-xs text-muted-foreground">{trend.label}</span>
                )}
              </span>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}

          {/* Progress bar */}
          {progress && variant === 'progress' && (
            <div className="mt-2 space-y-1">
              <Progress value={progress.value} max={progress.max || 100} className="h-1.5" />
              {progress.showLabel && (
                <span className="text-xs text-muted-foreground">
                  {progress.value}% complete
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {description && variant !== 'compact' && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* Compact icon */}
        {Icon && variant === 'compact' && (
          <div className="flex items-center">
            <Icon className={iconVariants({ tone, size: 'sm' })} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Grid wrapper for multiple cards
export function MetadataCardGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  )
}
