'use client'

import { motion } from 'framer-motion'
import { BarChart3, CalendarDays, Megaphone, Sparkles, Trophy, Users2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { DashboardHeroSlide } from '@/types/d380-dashboard'
import { cn } from '@/lib/utils'

interface HeroSlideRendererProps {
  slide: DashboardHeroSlide
  isActive: boolean
}

export function HeroSlideRenderer({ slide, isActive }: HeroSlideRendererProps) {
  return (
    <motion.div
      initial={{ opacity: 0.65, y: 10 }}
      animate={{ opacity: isActive ? 1 : 0.82, y: 0, scale: isActive ? 1 : 0.985 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="grid h-full min-h-105 gap-8 rounded-4xl border border-black/10 bg-black px-7 py-7 text-[#f4c430] shadow-[0_28px_120px_rgba(0,0,0,0.22)] md:grid-cols-[1.05fr_0.95fr] md:px-8"
    >
      <div className="space-y-5">
        <Badge variant="secondary" className="bg-[#f4c430] text-foreground">
          {slide.eyebrow}
        </Badge>
        <div className="space-y-3">
          <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">{slide.title}</h2>
          <p className="max-w-2xl text-base leading-7 text-[#f4c430]/76 md:text-lg">{slide.description}</p>
        </div>
        {slide.ctaLabel ? (
          <div className="inline-flex rounded-full border border-[#f4c430]/20 bg-[#f4c430]/10 px-4 py-2 text-sm font-medium text-[#f4c430]">
            {slide.ctaLabel}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-65 items-stretch">
        {slide.type === 'WELCOME' ? (
          <div className="grid w-full gap-4 rounded-[28px] bg-[#f4c430]/10 p-5">
            <div className="flex items-center gap-2 text-sm text-[#f4c430]/72">
              <Sparkles className="size-4" />
              Startup handoff complete
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/62">Active shift</div>
                <div className="mt-2 text-2xl font-semibold text-white">{slide.shiftLabel}</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/62">Operating date</div>
                <div className="mt-2 text-2xl font-semibold text-white">{slide.operatingDate}</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/62">Ready projects</div>
                <div className="mt-2 text-2xl font-semibold text-white">{slide.readyProjects}</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/62">Restored assignments</div>
                <div className="mt-2 text-2xl font-semibold text-white">{slide.restoredAssignments}</div>
              </div>
            </div>
          </div>
        ) : null}

        {slide.type === 'TOP_PERFORMERS' ? (
          <div className="grid w-full gap-3 rounded-[28px] bg-[#f4c430]/10 p-5">
            {slide.performers.map(performer => (
              <div key={performer.id} className="rounded-2xl bg-black/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{performer.name}</div>
                    <div className="text-sm text-[#f4c430]/70">{performer.role} • {performer.station}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-white">{performer.completedAssignments}</div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">assignments</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {slide.type === 'TOP_PERFORMER' ? (
          <div className="grid w-full gap-4 rounded-[28px] bg-[#f4c430]/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#f4c430] text-xl font-semibold text-foreground">
                {slide.performer.initials}
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">{slide.performer.name}</div>
                <div className="text-sm text-[#f4c430]/70">{slide.performer.role} • {slide.performer.station}</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Quality</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.performer.qualityScore}%</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Delta</div>
                <div className="mt-2 text-3xl font-semibold text-white">+{slide.performer.throughputDelta}%</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Streak</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.performer.streakDays}d</div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#f4c430]/16 bg-white/6 p-4 text-sm leading-6 text-[#f4c430]/76">
              {slide.performer.spotlight}
            </div>
          </div>
        ) : null}

        {slide.type === 'HOLIDAY' ? (
          <div className="grid w-full gap-4 rounded-[28px] bg-[#f4c430]/10 p-5">
            <div className="flex items-center gap-2 text-sm text-[#f4c430]/72">
              <CalendarDays className="size-4" />
              {slide.holidayName}
            </div>
            <div className="text-4xl font-semibold text-white">{slide.dateLabel}</div>
            <div className="rounded-2xl bg-black/35 p-4 text-sm leading-6 text-[#f4c430]/76">{slide.coverageNote}</div>
          </div>
        ) : null}

        {slide.type === 'ANNOUNCEMENT' ? (
          <div className="grid w-full gap-4 rounded-[28px] bg-[#f4c430]/10 p-5">
            <div className="flex items-center gap-2 text-sm text-[#f4c430]/72">
              <Megaphone className="size-4" />
              {slide.announcementTag}
            </div>
            <div className="rounded-3xl bg-black/35 p-5">
              <div className="text-2xl font-semibold text-white">{slide.emphasis}</div>
            </div>
          </div>
        ) : null}

        {slide.type === 'SHIFT_COMPARISON' ? (
          <div className="grid w-full gap-4 rounded-[28px] bg-[#f4c430]/10 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {[slide.firstShift, slide.secondShift].map(shift => (
                <div key={shift.shift} className={cn('rounded-2xl p-4', shift.shift === 'FIRST' ? 'bg-[#f4c430] text-foreground' : 'bg-black/35 text-[#f4c430]')}>
                  <div className={cn('text-[11px] uppercase tracking-[0.22em]', shift.shift === 'FIRST' ? 'text-muted/85' : 'text-[#f4c430]/60')}>
                    {shift.label}
                  </div>
                  <div className={cn('mt-2 text-3xl font-semibold', shift.shift === 'FIRST' ? 'text-foreground' : 'text-white')}>
                    {shift.completedAssignments}
                  </div>
                  <div className={cn('text-sm', shift.shift === 'FIRST' ? 'text-foreground/68' : 'text-[#f4c430]/72')}>
                    assignments complete
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-black/35 p-4 text-sm text-[#f4c430]/76">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60"><Users2 className="size-4" /> Utilization</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.firstShift.utilizationPercent}% / {slide.secondShift.utilizationPercent}%</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4 text-sm text-[#f4c430]/76">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Quality</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.firstShift.qualityPercent}% / {slide.secondShift.qualityPercent}%</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4 text-sm text-[#f4c430]/76">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Handoff ready</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.firstShift.handoffReadyPercent}% / {slide.secondShift.handoffReadyPercent}%</div>
              </div>
            </div>
          </div>
        ) : null}

        {slide.type === 'SCHEDULE_PROGRESS' ? (
          <div className="grid w-full gap-4 rounded-[28px] bg-[#f4c430]/10 p-5">
            <div className="flex items-center gap-2 text-sm text-[#f4c430]/72">
              <BarChart3 className="size-4" />
              Schedule completion
            </div>
            <div>
              <div className="text-4xl font-semibold text-white">{slide.completionPercent}%</div>
              <div className="mt-1 text-sm text-[#f4c430]/70">{slide.completedUnits} of {slide.scheduledUnits} planned units closed</div>
            </div>
            <Progress value={slide.completionPercent} className="h-3 bg-[#f4c430]/18 **:data-[slot=progress-indicator]:bg-[#f4c430]" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Late projects</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.lateProjects}</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Completed units</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.completedUnits}</div>
              </div>
              <div className="rounded-2xl bg-black/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Planned units</div>
                <div className="mt-2 text-3xl font-semibold text-white">{slide.scheduledUnits}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}