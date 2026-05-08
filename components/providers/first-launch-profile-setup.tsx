'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Image,
  Sparkles,
  User,
} from 'lucide-react'

import { StartUpLoader } from '@/components/loaders/start-up-loader'
import { D380Logo } from '@/components/projects/layout/logo'
import { ProfileHeader } from '@/components/profile/profile-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getPostLaunchRouteForMode } from '@/lib/runtime/app-mode-routing'
import type { AppLaunchMode } from '@/lib/runtime/app-mode-types'

// ============================================================================
// Types
// ============================================================================

interface FirstLaunchProfileSetupProps {
  /** Badge number of the just-logged-in user */
  badge: string
  /** Display name resolved from users.csv (legal or preferred) */
  displayName: string
  /** App mode — determines the final destination route */
  appMode: AppLaunchMode
}

type SetupStepId = 'welcome' | 'identity' | 'visuals' | 'done'

interface SetupStep {
  id: SetupStepId
  eyebrow: string
  title: string
  summary: string
  icon: typeof User
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'welcome',
    eyebrow: 'Step 1 of 4',
    title: 'Welcome to D380',
    summary: "Let's personalize your workspace in a few quick steps. Everything here is optional — you can update it any time from your profile.",
    icon: Sparkles,
  },
  {
    id: 'identity',
    eyebrow: 'Step 2 of 4',
    title: 'Your Identity',
    summary: 'Confirm how you want to appear to your team. Preferred name and title are shown on dashboards and assignment cards.',
    icon: User,
  },
  {
    id: 'visuals',
    eyebrow: 'Step 3 of 4',
    title: 'Profile Visuals',
    summary: 'Upload a photo and a cover image. Use the profile preview below to see your changes in real time before saving.',
    icon: Image,
  },
  {
    id: 'done',
    eyebrow: 'Step 4 of 4',
    title: "You're all set",
    summary: "Your profile is ready. You'll be taken to your workspace now.",
    icon: CheckCircle2,
  },
]

// ============================================================================
// Progress pills
// ============================================================================

function ProgressPills({ currentIndex, total }: { currentIndex: number; total: number }) {
  return (
    <div className='flex items-center gap-2'>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-all duration-400',
            i <= currentIndex ? 'bg-foreground' : 'bg-foreground/10',
          )}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

export function FirstLaunchProfileSetup({
  badge,
  displayName,
  appMode,
}: FirstLaunchProfileSetupProps) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showTransition, setShowTransition] = useState(false)

  // Identity fields — pre-filled from users.csv via displayName
  const [preferredName, setPreferredName] = useState(displayName)
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')

  const step = SETUP_STEPS[Math.min(stepIndex, SETUP_STEPS.length - 1)]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === SETUP_STEPS.length - 1

  const destinationRoute = useMemo(
    () => getPostLaunchRouteForMode(appMode, badge),
    [appMode, badge],
  )

  // On the "done" step, auto-save identity fields then kick off the transition
  const hasSavedRef = useRef(false)

  const saveIdentityFields = useCallback(async () => {
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    setIsSaving(true)
    setSaveError(null)
    try {
      const payload: Record<string, string | undefined> = {}
      if (preferredName.trim()) payload.preferredName = preferredName.trim()
      if (title.trim()) payload.title = title.trim()
      if (bio.trim()) payload.bio = bio.trim()

      if (Object.keys(payload).length > 0) {
        const res = await fetch(`/api/users/${badge}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to save profile.')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.')
      hasSavedRef.current = false
    } finally {
      setIsSaving(false)
    }
  }, [badge, preferredName, title, bio])

  // Kick off transition once we land on the final step
  useEffect(() => {
    if (step.id !== 'done') return
    void saveIdentityFields().then(() => {
      if (!hasSavedRef.current) return
      // Brief pause so the user sees the "You're all set" message
      const t = window.setTimeout(() => setShowTransition(true), 1200)
      return () => window.clearTimeout(t)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const goNext = useCallback(() => {
    setStepIndex((c) => Math.min(c + 1, SETUP_STEPS.length - 1))
  }, [])

  const goBack = useCallback(() => {
    setStepIndex((c) => Math.max(c - 1, 0))
  }, [])

  const skipAll = useCallback(() => {
    setShowTransition(true)
  }, [])

  if (showTransition) {
    return (
      <div className='fixed inset-0 z-120'>
        <StartUpLoader
          introPosition='end'
          d380Duration={2400}
          onComplete={() => {
            router.replace(destinationRoute)
            router.refresh()
          }}
        />
      </div>
    )
  }

  return (
    <div className='fixed inset-0 overflow-y-auto bg-background text-foreground'>
      {/* Top bar */}
      <div className='border-b border-border'>
        <div className='mx-auto flex max-w-4xl items-center gap-4 px-6 py-4 sm:px-8'>
          <div className='flex items-center gap-3'>
            <D380Logo size='sm' />
            <div>
              <div className='text-sm font-semibold tracking-tight text-foreground'>D380</div>
              <div className='text-[11px] text-muted-foreground'>Profile setup</div>
            </div>
          </div>
          <div className='ml-auto'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-xs text-muted-foreground'
              onClick={skipAll}
            >
              Skip setup
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className='mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10'>
        <div className='rounded-3xl border border-border bg-card shadow-sm'>

          {/* Progress + step header */}
          <div className='border-b border-border px-6 pt-6 pb-5 sm:px-8'>
            <div className='mx-auto max-w-2xl'>
              <ProgressPills currentIndex={stepIndex} total={SETUP_STEPS.length} />
              <AnimatePresence mode='wait'>
                <motion.div
                  key={`header-${step.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className='mt-5'
                >
                  <div className='inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground'>
                    {step.eyebrow}
                  </div>
                  <h2 className='mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl'>
                    {step.title}
                  </h2>
                  <p className='mt-1.5 text-sm leading-6 text-muted-foreground'>{step.summary}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Step content */}
          <div className='px-6 py-5 sm:px-8 sm:py-6'>
            <div className='mx-auto max-w-2xl'>
              <AnimatePresence mode='wait'>
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >

                  {/* ── WELCOME ──────────────────────────────────────── */}
                  {step.id === 'welcome' && (
                    <div className='space-y-4'>
                      <div className='rounded-2xl border border-border bg-muted/30 px-5 py-4'>
                        <p className='text-sm text-muted-foreground'>
                          Signed in as{' '}
                          <span className='font-semibold text-foreground'>{displayName}</span>
                          {' '}· Badge{' '}
                          <span className='font-mono text-foreground'>{badge}</span>
                        </p>
                      </div>
                      <ul className='space-y-2.5'>
                        {[
                          { icon: User,         text: 'Confirm your preferred name and title' },
                          { icon: Image,        text: 'Upload a profile photo and cover image' },
                          { icon: CheckCircle2, text: 'Enter your workspace' },
                        ].map(({ icon: Icon, text }) => (
                          <li key={text} className='flex items-center gap-3 text-sm text-muted-foreground'>
                            <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30'>
                              <Icon className='size-3.5 text-foreground/60' />
                            </span>
                            {text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── IDENTITY ─────────────────────────────────────── */}
                  {step.id === 'identity' && (
                    <div className='space-y-4'>
                      <div className='grid gap-4 sm:grid-cols-2'>
                        <div className='space-y-1.5'>
                          <Label htmlFor='preferred-name' className='text-sm font-medium'>
                            Preferred Name
                          </Label>
                          <Input
                            id='preferred-name'
                            value={preferredName}
                            onChange={(e) => setPreferredName(e.target.value)}
                            placeholder='Alex'
                            className='rounded-xl'
                          />
                          <p className='text-xs text-muted-foreground'>
                            Shown on assignments, dashboards, and handoffs.
                          </p>
                        </div>
                        <div className='space-y-1.5'>
                          <Label htmlFor='title' className='text-sm font-medium'>
                            Title <span className='text-muted-foreground font-normal'>(optional)</span>
                          </Label>
                          <Input
                            id='title'
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder='Wire Harness Technician'
                            className='rounded-xl'
                          />
                          <p className='text-xs text-muted-foreground'>
                            Displayed under your name on the profile card.
                          </p>
                        </div>
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='bio' className='text-sm font-medium'>
                          Bio <span className='text-muted-foreground font-normal'>(optional)</span>
                        </Label>
                        <Textarea
                          id='bio'
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder='A quick sentence about your role or specialization…'
                          className='min-h-20 rounded-xl resize-none'
                          maxLength={200}
                        />
                        <p className='text-right text-xs text-muted-foreground'>
                          {bio.length}/200
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── VISUALS ──────────────────────────────────────── */}
                  {step.id === 'visuals' && (
                    <div className='space-y-4'>
                      <p className='text-sm text-muted-foreground'>
                        Click the camera icon on the avatar or the cover area to upload images.
                        Your changes are saved immediately — no separate save needed.
                      </p>
                      {/* Live ProfileHeader preview — editable so avatar/cover uploads work inline */}
                      <div className='overflow-hidden rounded-2xl border border-border'>
                        <ProfileHeader
                          badgeNumber={badge}
                          isEditable
                          layout='horizontal'
                        />
                      </div>
                    </div>
                  )}

                  {/* ── DONE ─────────────────────────────────────────── */}
                  {step.id === 'done' && (
                    <div className='flex flex-col items-center gap-4 py-6 text-center'>
                      <div className='flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/30'>
                        <CheckCircle2 className='size-7 text-emerald-400' />
                      </div>
                      <div className='space-y-1'>
                        <p className='text-sm font-medium text-foreground'>
                          Welcome, {preferredName || displayName}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Taking you to your workspace…
                        </p>
                      </div>
                      {isSaving && (
                        <p className='text-xs text-muted-foreground animate-pulse'>
                          Saving profile…
                        </p>
                      )}
                      {saveError && (
                        <div className='rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
                          {saveError} — you can update your profile later.
                        </div>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Nav footer */}
          <div className='border-t border-border px-6 py-4 sm:px-8'>
            <div className='mx-auto flex max-w-2xl items-center justify-between gap-3'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='rounded-xl'
                onClick={goBack}
                disabled={isFirstStep || isSaving}
              >
                <ArrowLeft className='mr-1.5 size-3.5' />
                Back
              </Button>

              {isLastStep ? null : (
                <Button
                  type='button'
                  size='sm'
                  className='rounded-xl px-5'
                  onClick={goNext}
                  disabled={isSaving}
                >
                  {stepIndex === SETUP_STEPS.length - 2 ? 'Finish' : 'Continue'}
                  <ArrowRight className='ml-1.5 size-3.5' />
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
