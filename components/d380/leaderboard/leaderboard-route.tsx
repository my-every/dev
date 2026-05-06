'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Trophy, Users, Waves } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { buildD380LeaderboardViewModel } from '@/lib/view-models/d380-leaderboard'
import { cn } from '@/lib/utils'

const podiumToneClasses = ['bg-primary text-primary-foreground', 'bg-card text-foreground', 'bg-muted text-foreground'] as const

export function LeaderboardRoute() {
  const viewModel = useMemo(() => buildD380LeaderboardViewModel(), [])
  const podium = viewModel.entries.slice(0, 3)

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/40 px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-primary/[0.04]" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="relative mx-auto max-w-360 space-y-8">
        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
          <div className="space-y-4">
            <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-foreground/68">
              /380/leader-board
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Shift contribution, continuity membership, and assignment throughput ranked into a D380 leaderboard shell.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-foreground/66 md:text-lg">
                Scores are derived from staged assignments, active work, trainee leadership, and continuity membership so this route can mature before real production metrics are wired in.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-border/70 bg-card/84 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.1)] md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/46"><Sparkles className="size-4" />Operating date</div>
              <div className="mt-3 text-2xl font-semibold text-foreground">{viewModel.operatingDateLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/46"><Users className="size-4" />Continuity</div>
              <div className="mt-3 text-2xl font-semibold text-foreground">{viewModel.summary.continuityMembers}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/46"><Waves className="size-4" />Active work</div>
              <div className="mt-3 text-2xl font-semibold text-foreground">{viewModel.summary.activeAssignments}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {podium.map((entry, index) => (
            <Card key={entry.id} className={cn('rounded-[32px] border border-border/70 py-0 shadow-[0_16px_60px_rgba(0,0,0,0.1)]', podiumToneClasses[index] ?? 'bg-card text-foreground')}>
              <CardContent className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className="rounded-full border-current/20 bg-transparent px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-current">
                    #{index + 1}
                  </Badge>
                  <Trophy className="size-5" />
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="size-14 border border-current/20 bg-current/10">
                    <AvatarFallback className="bg-transparent text-base font-semibold text-current">{entry.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">{entry.name}</h2>
                    <p className="text-sm opacity-78">{entry.role}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-current/15 bg-current/8 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] opacity-68">Score</div>
                    <div className="mt-2 text-3xl font-semibold">{entry.score}</div>
                  </div>
                  <div className="rounded-2xl border border-current/15 bg-current/8 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] opacity-68">Assignments</div>
                    <div className="mt-2 text-3xl font-semibold">{entry.assignmentCount}</div>
                  </div>
                </div>
                <p className="text-sm leading-6 opacity-82">{entry.shiftLabel} • {entry.lwcLabel} • {entry.projectCount} staffed project{entry.projectCount === 1 ? '' : 's'}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-[32px] border border-border/70 bg-card/88 py-0 shadow-[0_18px_70px_rgba(0,0,0,0.08)]">
          <CardContent className="space-y-4 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/46">All contributors</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Full staged leaderboard</h2>
            </div>

            <div className="space-y-3">
              {viewModel.entries.map((entry, index) => (
                <div key={entry.id} className="grid gap-3 rounded-[26px] border border-border/70 bg-muted/35 px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:items-center">
                  <div className="text-sm font-semibold text-foreground/68">#{index + 1}</div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-10 border border-border/70 bg-primary/10 text-primary">
                      <AvatarFallback className="bg-transparent font-semibold text-primary">{entry.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-foreground">{entry.name}</div>
                      <div className="truncate text-sm text-foreground/58">{entry.role} • {entry.shiftLabel} • {entry.lwcLabel}</div>
                    </div>
                  </div>
                  <div className="text-sm text-foreground/64">{entry.assignmentCount} assignments</div>
                  <div className="text-sm text-foreground/64">{entry.activeAssignmentCount} active</div>
                  <div className="text-right text-xl font-semibold text-foreground">{entry.score}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </section>
      </motion.div>
    </main>
  )
}
