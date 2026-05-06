import { BellOff } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

export function NotificationEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-[28px] border border-dashed border-border/80 bg-card/78 py-0 shadow-[0_18px_80px_rgba(0,0,0,0.1)]">
      <CardContent className="flex flex-col items-center px-8 py-14 text-center">
        <div className="rounded-full bg-black p-3 text-[#f4c430]">
          <BellOff className="size-5" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/62">{description}</p>
      </CardContent>
    </Card>
  )
}