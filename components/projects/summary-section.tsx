'use client'

import { useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const summarySectionVariants = cva('', {
  variants: {
    variant: {
      grid: '',
      list: '',
      cards: '',
      table: '',
      inline: '',
    },
  },
  defaultVariants: {
    variant: 'grid',
  },
})

export interface SummaryItem {
  id: string
  label: string
  value: string | number
  sublabel?: string
  icon?: LucideIcon
  tone?: 'neutral' | 'positive' | 'warning' | 'error'
  badge?: string
  href?: string
  onClick?: () => void
}

export interface SummarySectionProps extends VariantProps<typeof summarySectionVariants> {
  title: string
  description?: string
  items: SummaryItem[]
  columns?: 2 | 3 | 4 | 5 | 6
  collapsible?: boolean
  defaultOpen?: boolean
  emptyMessage?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const toneColors = {
  neutral: 'text-foreground',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
}

const toneBgColors = {
  neutral: 'bg-muted/50',
  positive: 'bg-emerald-50',
  warning: 'bg-amber-50',
  error: 'bg-red-50',
}

export function SummarySection({
  variant = 'grid',
  title,
  description,
  items,
  columns = 4,
  collapsible = false,
  defaultOpen = true,
  emptyMessage = 'No items to display',
  action,
  className,
}: SummarySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  }

  const renderContent = () => {
    if (items.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )
    }

    switch (variant) {
      case 'grid':
        return (
          <div className={cn('grid gap-3', gridCols[columns])}>
            {items.map((item) => (
              <GridItem key={item.id} item={item} />
            ))}
          </div>
        )

      case 'list':
        return (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <ListItem key={item.id} item={item} />
            ))}
          </div>
        )

      case 'cards':
        return (
          <div className={cn('grid gap-4', gridCols[columns])}>
            {items.map((item) => (
              <CardItem key={item.id} item={item} />
            ))}
          </div>
        )

      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <TableRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'inline':
        return (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <InlineItem key={item.id} item={item} />
            ))}
          </div>
        )

      default:
        return null
    }
  }

  const content = (
    <Card className={cn('rounded-2xl border border-border/70', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <Button variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {collapsible && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  )

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer">{content}</div>
        </CollapsibleTrigger>
        <CollapsibleContent>{/* Content is inside the card */}</CollapsibleContent>
      </Collapsible>
    )
  }

  return content
}

// Item renderers for each variant
function GridItem({ item }: { item: SummaryItem }) {
  const Icon = item.icon
  const Wrapper = item.onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={item.onClick}
      className={cn(
        'rounded-xl p-3 text-left',
        toneBgColors[item.tone || 'neutral'],
        item.onClick && 'cursor-pointer transition-colors hover:opacity-80'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.label}
          </div>
          <div
            className={cn(
              'mt-1 text-xl font-semibold',
              toneColors[item.tone || 'neutral']
            )}
          >
            {item.value}
          </div>
          {item.sublabel && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {item.sublabel}
            </div>
          )}
        </div>
        {Icon && (
          <Icon
            className={cn('h-5 w-5 shrink-0', toneColors[item.tone || 'neutral'])}
          />
        )}
      </div>
      {item.badge && (
        <Badge variant="secondary" className="mt-2 text-xs">
          {item.badge}
        </Badge>
      )}
    </Wrapper>
  )
}

function ListItem({ item }: { item: SummaryItem }) {
  const Icon = item.icon
  const Wrapper = item.onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={item.onClick}
      className={cn(
        'flex w-full items-center justify-between gap-4 py-3 text-left',
        item.onClick && 'cursor-pointer transition-colors hover:bg-muted/50'
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <Icon
            className={cn('h-5 w-5', toneColors[item.tone || 'neutral'])}
          />
        )}
        <div>
          <div className="font-medium">{item.label}</div>
          {item.sublabel && (
            <div className="text-sm text-muted-foreground">{item.sublabel}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn('font-semibold', toneColors[item.tone || 'neutral'])}
        >
          {item.value}
        </span>
        {item.badge && (
          <Badge variant="outline" className="text-xs">
            {item.badge}
          </Badge>
        )}
      </div>
    </Wrapper>
  )
}

function CardItem({ item }: { item: SummaryItem }) {
  const Icon = item.icon
  const Wrapper = item.onClick ? 'button' : 'div'

  return (
    <Card
      as={Wrapper}
      onClick={item.onClick}
      className={cn(
        'p-4 text-left',
        item.onClick && 'cursor-pointer transition-all hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              toneBgColors[item.tone || 'neutral']
            )}
          >
            <Icon
              className={cn('h-5 w-5', toneColors[item.tone || 'neutral'])}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">{item.label}</div>
          <div
            className={cn(
              'text-lg font-semibold',
              toneColors[item.tone || 'neutral']
            )}
          >
            {item.value}
          </div>
          {item.sublabel && (
            <div className="text-xs text-muted-foreground">{item.sublabel}</div>
          )}
        </div>
        {item.badge && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {item.badge}
          </Badge>
        )}
      </div>
    </Card>
  )
}

function TableRow({ item }: { item: SummaryItem }) {
  const Icon = item.icon
  const Wrapper = item.onClick ? 'button' : 'tr'

  return (
    <tr
      onClick={item.onClick}
      className={cn(
        item.onClick && 'cursor-pointer transition-colors hover:bg-muted/50'
      )}
    >
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              className={cn('h-4 w-4', toneColors[item.tone || 'neutral'])}
            />
          )}
          <span className="font-medium">{item.label}</span>
        </div>
      </td>
      <td className="py-2.5 text-muted-foreground">{item.sublabel || '-'}</td>
      <td className="py-2.5 text-right">
        <span
          className={cn('font-semibold', toneColors[item.tone || 'neutral'])}
        >
          {item.value}
        </span>
      </td>
      <td className="py-2.5 text-right">
        {item.badge && (
          <Badge variant="outline" className="text-xs">
            {item.badge}
          </Badge>
        )}
      </td>
    </tr>
  )
}

function InlineItem({ item }: { item: SummaryItem }) {
  const Icon = item.icon

  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1.5 px-3 py-1.5',
        item.onClick && 'cursor-pointer hover:opacity-80'
      )}
      onClick={item.onClick}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="text-muted-foreground">{item.label}:</span>
      <span className={cn('font-semibold', toneColors[item.tone || 'neutral'])}>
        {item.value}
      </span>
    </Badge>
  )
}
