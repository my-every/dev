'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  UserPlus,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'

import { StartUpLoader } from '@/components/loaders/start-up-loader'
import { useAppRuntime } from '@/components/providers/app-runtime-provider'
import { D380Logo } from '@/components/projects/layout/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getPostLaunchRouteForMode } from '@/lib/runtime/app-mode-routing'
import { cn } from '@/lib/utils'
import type { AppLaunchMode } from '@/lib/runtime/app-mode-types'
import type { UserRole } from '@/types/d380-user-session'

// ============================================================================
// Types & Constants
// ============================================================================

type LaunchStepId = 'MODE' | 'DEPARTMENT_SETUP' | 'REVIEW'

interface LaunchStep {
  id: LaunchStepId
  title: string
  eyebrow: string
  summary: string
}

function getSteps(mode: AppLaunchMode): LaunchStep[] {
  const total = mode === 'DEPARTMENT' ? 3 : 2
  const baseSteps: LaunchStep[] = [
    {
      id: 'MODE',
      eyebrow: `Step 1 of ${total}`,
      title: 'Choose Startup Experience',
      summary: 'Pick the launch behavior for this machine so D380 opens in the right operating context.',
    },
  ]
  if (mode === 'DEPARTMENT') {
    baseSteps.push({
      id: 'DEPARTMENT_SETUP',
      eyebrow: 'Step 2 of 3',
      title: 'Prepare Department Access',
      summary: 'Connect the Share folder and seed the roster for daily badge-based operations.',
    })
  }
  baseSteps.push({
    id: 'REVIEW',
    eyebrow: `Step ${total} of ${total}`,
    title: 'Review and Enter D380',
    summary: 'Confirm the startup behavior and final route before entering the workspace.',
  })
  return baseSteps
}

const MODE_OPTIONS: {
  mode: AppLaunchMode
  title: string
  description: string
  icon: typeof Building2
}[] = [
  {
    mode: 'DEPARTMENT',
    title: 'Department Mode',
    description: 'Role-first startup for production teams, shift handoff, and shared floor operations.',
    icon: Building2,
  },
  {
    mode: 'WORKSPACE',
    title: 'Workspace Mode',
    description: 'Project and environment setup for local admin, planning, and readiness work.',
    icon: BriefcaseBusiness,
  },
  {
    mode: 'STANDALONE_TOOL',
    title: 'Standalone Tool',
    description: 'Direct utility access for focused one-off operations without team startup.',
    icon: Wrench,
  },
]

const MODE_FEATURES: {
  label: string
  department: boolean
  workspace: boolean
  standalone: boolean
}[] = [
  { label: 'Badge & PIN login',       department: true,  workspace: false, standalone: false },
  { label: 'Shared team roster',      department: true,  workspace: false, standalone: false },
  { label: 'Shift handoff tracking',  department: true,  workspace: false, standalone: false },
  { label: 'Project planning tools',  department: true,  workspace: true,  standalone: false },
  { label: 'Workspace admin tools',   department: true,  workspace: true,  standalone: false },
  { label: 'Workspace configuration', department: false, workspace: true,  standalone: false },
  { label: 'Utility quick access',    department: false, workspace: false, standalone: true  },
  { label: 'Isolated local storage',  department: false, workspace: false, standalone: true  },
]

type DepartmentSetupSource = 'import-existing' | 'create-new'

const DEPARTMENT_ROLES: UserRole[] = [
  'DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER',
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
// Feature comparison row component
// ============================================================================

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <div className='flex items-center gap-2.5'>
      {included ? (
        <CheckCircle2 className='size-3.5 shrink-0 text-emerald-400' />
      ) : (
        <XCircle className='size-3.5 shrink-0 text-destructive/60' />
      )}
      <span className={cn('text-xs leading-5', included ? 'text-foreground/70' : 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  )
}

function FeatureComparisonTable({ selectedMode }: { selectedMode: AppLaunchMode }) {
  const cols = [
    { mode: 'DEPARTMENT' as AppLaunchMode, label: 'Dept', key: 'department' as const },
    { mode: 'WORKSPACE' as AppLaunchMode,  label: 'Work', key: 'workspace'   as const },
    { mode: 'STANDALONE_TOOL' as AppLaunchMode, label: 'Tool', key: 'standalone' as const },
  ]

  return (
    <div className='rounded-2xl border border-border bg-card p-4'>
      <div className='mb-3 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3'>
        <span className='text-[10px] uppercase tracking-[0.18em] text-muted-foreground'>Feature</span>
        {cols.map((col) => (
          <span
            key={col.mode}
            className={cn(
              'w-9 text-center text-[10px] font-semibold uppercase tracking-wider',
              selectedMode === col.mode ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {col.label}
          </span>
        ))}
      </div>

      <div className='space-y-2.5'>
        {MODE_FEATURES.map((feat) => (
          <div key={feat.label} className='grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3'>
            <span
              className={cn(
                'text-xs leading-5 transition-colors',
                feat[cols.find((c) => c.mode === selectedMode)!.key]
                  ? 'text-foreground/70'
                  : 'text-muted-foreground',
              )}
            >
              {feat.label}
            </span>
            {cols.map((col) => {
              const included = feat[col.key]
              const isSelected = selectedMode === col.mode
              return (
                <div key={col.mode} className='flex w-9 items-center justify-center'>
                  {included ? (
                    <CheckCircle2 className={cn('size-3.5', isSelected ? 'text-emerald-400' : 'text-emerald-400/30')} />
                  ) : (
                    <XCircle className={cn('size-3.5', isSelected ? 'text-destructive/60' : 'text-destructive/20')} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Right-side workspace preview
// ============================================================================

/**
 * Mock app shell frame.
 * Intentionally uses a hardcoded dark palette (bg-[#0d0e12] etc.) so the
 * preview looks identical regardless of the active CSS theme.
 */
function AppWindowFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className='w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0d0e12] shadow-[0_24px_64px_rgba(0,0,0,0.5)]'>
      <div className='flex items-center gap-3 border-b border-white/8 bg-[#0a0b0e] px-4 py-2.5'>
        <D380Logo size='sm' />
        <span className='text-xs font-semibold text-white/70'>D380</span>
        <span className='ml-1 rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/35'>
          {label}
        </span>
        <div className='ml-auto flex items-center gap-1.5'>
          <div className='h-4 w-14 rounded-full bg-white/[0.04]' />
          <div className='h-6 w-6 rounded-full bg-white/[0.04]' />
        </div>
      </div>
      <div className='flex min-h-[300px]'>
        <div className='flex w-10 shrink-0 flex-col gap-1.5 border-r border-white/8 bg-[#0a0b0e] px-1.5 py-3'>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-7 rounded-lg transition-colors',
                i === 0 ? 'bg-[#EDBA3A]/15' : i === 2 ? 'bg-white/[0.06]' : 'bg-white/[0.03]',
              )}
            />
          ))}
        </div>
        <div className='flex-1 overflow-hidden p-3'>{children}</div>
      </div>
    </div>
  )
}

function MockSubheader() {
  return (
    <div className='mb-3 flex items-center gap-2'>
      <div className='h-6 w-6 rounded-lg bg-white/[0.05]' />
      <div className='h-5 flex-1 rounded-lg bg-white/[0.04]' />
      <div className='h-5 w-12 rounded-lg bg-[#EDBA3A]/10' />
    </div>
  )
}

function PreviewEntityRow() {
  return (
    <div className='flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3'>
      <div className='h-9 w-9 shrink-0 rounded-xl bg-white/[0.06]' />
      <div className='min-w-0 flex-1 space-y-2'>
        <div className='h-3 w-32 max-w-[70%] rounded-full bg-white/[0.08]' />
        <div className='flex items-center gap-2'>
          <div className='h-2.5 w-20 rounded-full bg-white/[0.05]' />
          <div className='h-2.5 w-12 rounded-full bg-white/[0.05]' />
        </div>
      </div>
      <div className='h-6 w-16 shrink-0 rounded-full bg-white/[0.06]' />
    </div>
  )
}

function PreviewMetricCard() {
  return (
    <div className='rounded-xl border border-white/[0.06] bg-white/[0.03] p-3'>
      <div className='mb-2.5 h-3 w-16 rounded-full bg-white/[0.07]' />
      <div className='mb-1.5 h-6 w-12 rounded-full bg-white/[0.09]' />
      <div className='h-2 w-20 rounded-full bg-white/[0.05]' />
    </div>
  )
}

function WorkspacePreview({
  mode,
  step,
  setupSource,
}: {
  mode: AppLaunchMode
  step: LaunchStepId
  setupSource: DepartmentSetupSource
}) {
  const modeConfig = MODE_OPTIONS.find((o) => o.mode === mode)
  const previewKey = step === 'DEPARTMENT_SETUP' ? `dept-${setupSource}` : `mode-${mode}-${step}`

  return (
    <div className='relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_25%,rgba(237,186,58,0.07),transparent_55%),radial-gradient(ellipse_at_70%_75%,rgba(255,255,255,0.03),transparent_55%)]' />

      <div className='w-full max-w-[560px]'>
        <div className='mb-3 flex items-center gap-2'>
          {modeConfig && step !== 'DEPARTMENT_SETUP' && (
            <>
              <div className='flex h-5 w-5 items-center justify-center rounded-md bg-primary/10'>
                <modeConfig.icon className='size-3 text-primary' />
              </div>
              <span className='text-xs font-medium text-muted-foreground'>{modeConfig.title}</span>
            </>
          )}
          {step === 'DEPARTMENT_SETUP' && (
            <>
              <div className='flex h-5 w-5 items-center justify-center rounded-md bg-primary/10'>
                {setupSource === 'import-existing' ? (
                  <Users className='size-3 text-primary' />
                ) : (
                  <UserPlus className='size-3 text-primary' />
                )}
              </div>
              <span className='text-xs font-medium text-muted-foreground'>
                {setupSource === 'import-existing' ? 'Import roster preview' : 'Seed admin preview'}
              </span>
            </>
          )}
          <div className='ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-chart-3' />
          <span className='text-[10px] text-muted-foreground'>Live preview</span>
        </div>

        <AnimatePresence mode='wait'>
          <motion.div
            key={previewKey}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {step === 'DEPARTMENT_SETUP' && setupSource === 'import-existing' && (
              <AppWindowFrame label='Roster Import'>
                <MockSubheader />
                <div className='mb-2.5 flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2'>
                  <CheckCircle2 className='size-3.5 shrink-0 text-emerald-400/70' />
                  <div className='h-2.5 flex-1 rounded-full bg-emerald-400/15' />
                  <div className='h-2.5 w-16 rounded-full bg-emerald-400/10' />
                </div>
                <div className='space-y-2.5'>
                  {Array.from({ length: 6 }).map((_, i) => <PreviewEntityRow key={i} />)}
                </div>
              </AppWindowFrame>
            )}

            {step === 'DEPARTMENT_SETUP' && setupSource === 'create-new' && (
              <AppWindowFrame label='Seed Admin'>
                <MockSubheader />
                <div className='rounded-xl border border-white/8 bg-white/[0.03] p-3'>
                  <div className='mb-3 flex items-center gap-2'>
                    <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDBA3A]/10'>
                      <UserPlus className='size-4 text-[#EDBA3A]/70' />
                    </div>
                    <div className='space-y-1'>
                      <div className='h-2.5 w-28 rounded-full bg-white/15' />
                      <div className='h-2 w-20 rounded-full bg-white/8' />
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-2'>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className='space-y-1'>
                        <div className='h-1.5 w-12 rounded-full bg-white/10' />
                        <div className='h-7 rounded-lg border border-white/8 bg-white/[0.03]' />
                      </div>
                    ))}
                  </div>
                  <div className='mt-3 flex justify-end'>
                    <div className='h-7 w-24 rounded-lg bg-white/10' />
                  </div>
                </div>
              </AppWindowFrame>
            )}

            {step !== 'DEPARTMENT_SETUP' && mode === 'DEPARTMENT' && (
              <AppWindowFrame label='Department'>
                <MockSubheader />
                <div className='space-y-2.5'>
                  {Array.from({ length: 5 }).map((_, i) => <PreviewEntityRow key={i} />)}
                </div>
              </AppWindowFrame>
            )}

            {step !== 'DEPARTMENT_SETUP' && mode === 'WORKSPACE' && (
              <AppWindowFrame label='Workspace'>
                <MockSubheader />
                <div className='grid grid-cols-2 gap-2.5'>
                  {Array.from({ length: 4 }).map((_, i) => <PreviewMetricCard key={i} />)}
                </div>
                <div className='mt-2.5 space-y-2.5'>
                  {Array.from({ length: 3 }).map((_, i) => <PreviewEntityRow key={i} />)}
                </div>
              </AppWindowFrame>
            )}

            {step !== 'DEPARTMENT_SETUP' && mode === 'STANDALONE_TOOL' && (
              <AppWindowFrame label='Standalone'>
                <MockSubheader />
                <div className='space-y-2.5'>
                  {Array.from({ length: 6 }).map((_, i) => <PreviewEntityRow key={i} />)}
                </div>
              </AppWindowFrame>
            )}
          </motion.div>
        </AnimatePresence>

        {step !== 'DEPARTMENT_SETUP' && (
          <div className='mt-3 flex items-center justify-center gap-2'>
            <span className='text-[10px] text-muted-foreground'>Entry route</span>
            <code className='rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground'>
              {getPostLaunchRouteForMode(mode)}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Review metric card
// ============================================================================

function ReviewMetric({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className='rounded-2xl border border-border bg-card p-4'>
      <div className='text-[10px] uppercase tracking-[0.18em] text-muted-foreground'>{title}</div>
      <div className='mt-1.5 text-sm font-semibold text-foreground'>{value}</div>
      <p className='mt-1 text-xs leading-5 text-muted-foreground'>{description}</p>
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

export function FirstLaunchModeSelector({ allowRevisit = false }: { allowRevisit?: boolean }) {
  const {
    appMode,
    hasCompletedFirstLaunch,
    isAppModeLoading,
    setAppMode,
    isElectron,
    chooseWorkspaceRoot,
    isSelectingWorkspace,
  } = useAppRuntime()
  const router = useRouter()

  const [stepIndex, setStepIndex] = useState(0)
  const [selectedMode, setSelectedMode] = useState<AppLaunchMode>(appMode)
  const [isSaving, setIsSaving] = useState(false)
  const [setupSource, setSetupSource] = useState<DepartmentSetupSource>('import-existing')
  const [shareDirectory, setShareDirectory] = useState('')
  const [seedBadge, setSeedBadge] = useState('')
  const [seedLegalName, setSeedLegalName] = useState('')
  const [seedPreferredName, setSeedPreferredName] = useState('')
  const [seedPin, setSeedPin] = useState('')
  const [seedRole, setSeedRole] = useState<UserRole>('DEVELOPER')
  const [seedShift, setSeedShift] = useState<'1' | '2'>('1')
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupSuccessMessage, setSetupSuccessMessage] = useState<string | null>(null)
  const [showStartupTransition, setShowStartupTransition] = useState(false)

  const steps = useMemo(() => getSteps(selectedMode), [selectedMode])
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const startupRoute = useMemo(() => getPostLaunchRouteForMode(selectedMode), [selectedMode])

  useEffect(() => { setSelectedMode(appMode) }, [appMode])

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(Math.max(steps.length - 1, 0))
  }, [stepIndex, steps.length])

  useEffect(() => {
    if (hasCompletedFirstLaunch && !allowRevisit) return
    const load = async () => {
      try {
        const res = await fetch('/api/runtime/share-directory', { cache: 'no-store' })
        if (!res.ok) return
        const payload = (await res.json()) as { shareDirectory?: string }
        if (payload.shareDirectory) setShareDirectory(payload.shareDirectory)
      } catch { /* optional */ }
    }
    void load()
  }, [allowRevisit, hasCompletedFirstLaunch])

  if (isAppModeLoading || (hasCompletedFirstLaunch && !allowRevisit)) return null

  if (showStartupTransition) {
    return (
      <div className='fixed inset-0 z-[120]'>
        <StartUpLoader
          introPosition='end'
          d380Duration={3000}
          onComplete={() => {
            router.replace(startupRoute)
            router.refresh()
          }}
        />
      </div>
    )
  }

  const canGoBack = stepIndex > 0
  const isDepartmentSetupValid =
    shareDirectory.trim().length > 0 &&
    (setupSource === 'import-existing' ||
      (/^\d+$/.test(seedBadge) && /^\d{4}$/.test(seedPin) && seedLegalName.trim().length > 1))

  const canGoNext =
    (step.id !== 'MODE' || Boolean(selectedMode)) &&
    (step.id !== 'DEPARTMENT_SETUP' || isDepartmentSetupValid)

  const browseForFolder = async () => {
    if (!isElectron) return
    const selected = await chooseWorkspaceRoot()
    if (selected) setShareDirectory(selected)
  }

  const runDepartmentSetup = async () => {
    setSetupError(null)
    setSetupSuccessMessage(null)
    const payload = {
      shareDirectory: shareDirectory.trim(),
      source: setupSource,
      seedUser:
        setupSource === 'create-new'
          ? { badge: seedBadge.trim(), legalName: seedLegalName.trim(), preferredName: seedPreferredName.trim() || undefined, role: seedRole, shift: seedShift, pin: seedPin }
          : undefined,
    }
    const res = await fetch('/api/runtime/department-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Department setup failed' }))
      throw new Error(typeof body.error === 'string' ? body.error : 'Department setup failed')
    }
    const result = (await res.json()) as { usersDiscovered: number; createdSettings: number; createdProfiles: number }
    setSetupSuccessMessage(`Setup complete: ${result.usersDiscovered} users, ${result.createdSettings} settings, ${result.createdProfiles} profiles.`)
  }

  const nextStep = () => { if (canGoNext) setStepIndex((c) => Math.min(c + 1, steps.length - 1)) }
  const previousStep = () => { if (canGoBack) setStepIndex((c) => Math.max(c - 1, 0)) }

  const applyMode = async () => {
    setIsSaving(true)
    setSetupError(null)
    let shouldShowLoader = false
    try {
      if (selectedMode === 'DEPARTMENT') await runDepartmentSetup()
      await setAppMode(selectedMode)
      shouldShowLoader = true
      setShowStartupTransition(true)
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Failed to apply mode setup.')
    } finally {
      if (!shouldShowLoader) setIsSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className='fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground'>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className='shrink-0 border-b border-border'>
          <div className='mx-auto flex max-w-[1280px] items-center gap-4 px-6 py-4 sm:px-8'>
            <div className='flex items-center gap-3'>
              <D380Logo size='sm' />
              <div>
                <div className='text-sm font-semibold tracking-tight text-foreground'>D380</div>
                <div className='text-[11px] text-muted-foreground'>Launch configuration</div>
              </div>
            </div>
            <div className='ml-auto flex items-center gap-2'>
              <ShieldCheck className='size-3.5 text-muted-foreground' />
              <span className='text-xs text-muted-foreground'>Secure setup</span>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className='flex min-h-0 flex-1 items-stretch justify-center overflow-hidden'>
          <div className='flex w-full max-w-[1280px] min-h-0'>

            {/* Left: step form */}
            <div className={cn(
              'flex w-full min-h-0 flex-col',
              step.id !== 'REVIEW' && 'border-r border-border sm:max-w-[400px] lg:max-w-[440px] xl:max-w-[480px]',
            )}>

              {/* Progress + step header */}
              <div className='shrink-0 px-6 pt-6 sm:px-8'>
                <div className={cn(step.id === 'REVIEW' && 'mx-auto max-w-2xl')}>
                  <ProgressPills currentIndex={stepIndex} total={steps.length} />
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

              {/* Step content — scrollable */}
              <div className='flex-1 overflow-y-auto px-6 py-5 sm:px-8'>
                <AnimatePresence mode='wait'>
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className={cn('space-y-5', step.id === 'REVIEW' && 'mx-auto max-w-2xl')}
                  >

                    {/* ── MODE STEP ─────────────────────────────────────── */}
                    {step.id === 'MODE' && (
                      <>
                        <div className='space-y-2'>
                          {MODE_OPTIONS.map((option) => {
                            const Icon = option.icon
                            const isSelected = selectedMode === option.mode
                            return (
                              <button
                                key={option.mode}
                                type='button'
                                onClick={() => setSelectedMode(option.mode)}
                                className={cn(
                                  'flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  isSelected
                                    ? 'border-border bg-accent shadow-sm'
                                    : 'border-border bg-transparent hover:bg-muted/40',
                                )}
                              >
                                <div
                                  className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                                    isSelected
                                      ? 'border-primary/30 bg-primary/10 text-primary'
                                      : 'border-border bg-muted/30 text-muted-foreground',
                                  )}
                                >
                                  <Icon className='size-4' />
                                </div>
                                <div className='min-w-0 flex-1'>
                                  <div className='flex items-center justify-between gap-2'>
                                    <span className='text-sm font-semibold text-foreground'>
                                      {option.title}
                                    </span>
                                    <div
                                      className={cn(
                                        'h-4 w-4 shrink-0 rounded-full border-2 transition-all',
                                        isSelected
                                          ? 'border-foreground bg-foreground'
                                          : 'border-muted-foreground/30',
                                      )}
                                    />
                                  </div>
                                  <p className='mt-0.5 text-xs leading-5 text-muted-foreground'>
                                    {option.description}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        <FeatureComparisonTable selectedMode={selectedMode} />
                      </>
                    )}

                    {/* ── DEPARTMENT SETUP STEP ─────────────────────────── */}
                    {step.id === 'DEPARTMENT_SETUP' && (
                      <div className='space-y-5'>
                        <div className='space-y-2'>
                          <Label htmlFor='dept-share-dir' className='text-sm font-medium text-foreground'>
                            Share Directory
                          </Label>
                          <div className='flex gap-2'>
                            <Input
                              id='dept-share-dir'
                              value={shareDirectory}
                              onChange={(e) => setShareDirectory(e.target.value)}
                              placeholder='/absolute/path/to/Share'
                              className='rounded-xl'
                            />
                            {isElectron && (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='shrink-0 rounded-xl'
                                onClick={() => void browseForFolder()}
                                disabled={isSelectingWorkspace}
                              >
                                <FolderOpen className='mr-1 size-3.5' />
                                {isSelectingWorkspace ? '...' : 'Browse'}
                              </Button>
                            )}
                          </div>
                          <p className='text-xs text-muted-foreground'>
                            Stores users, credentials, settings, and runtime profile files.
                          </p>
                        </div>

                        <div className='space-y-2'>
                          <Label className='text-sm font-medium text-foreground'>Roster Source</Label>
                          <div className='grid grid-cols-2 gap-2'>
                            {(
                              [
                                {
                                  value: 'import-existing' as const,
                                  icon: Users,
                                  title: 'Import Existing',
                                  description: 'Use an existing users.csv from the shared folder.',
                                },
                                {
                                  value: 'create-new' as const,
                                  icon: UserPlus,
                                  title: 'Create Seed Admin',
                                  description: 'Create the first admin and initialize the roster.',
                                },
                              ] as const
                            ).map((src) => {
                              const SrcIcon = src.icon
                              const isActive = setupSource === src.value
                              return (
                                <button
                                  key={src.value}
                                  type='button'
                                  onClick={() => setSetupSource(src.value)}
                                  className={cn(
                                    'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isActive
                                      ? 'border-border bg-accent'
                                      : 'border-border hover:bg-muted/40',
                                  )}
                                >
                                  <div className='mb-1.5 flex items-center gap-1.5'>
                                    <SrcIcon className='size-3.5 text-muted-foreground' />
                                    <span className='text-xs font-semibold text-foreground'>{src.title}</span>
                                  </div>
                                  <p className='text-[11px] leading-4 text-muted-foreground'>{src.description}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <AnimatePresence>
                          {setupSource === 'create-new' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22 }}
                              className='overflow-hidden'
                            >
                              <div className='grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4'>
                                {[
                                  { id: 'seed-badge',     label: 'Badge #',        value: seedBadge,         onChange: setSeedBadge,         placeholder: '1001' },
                                  { id: 'seed-pin',       label: 'PIN',            value: seedPin,           onChange: setSeedPin,           placeholder: '0000', maxLength: 4 },
                                  { id: 'seed-legal',     label: 'Legal Name',     value: seedLegalName,     onChange: setSeedLegalName,     placeholder: 'Alex Rivera' },
                                  { id: 'seed-preferred', label: 'Preferred Name', value: seedPreferredName, onChange: setSeedPreferredName, placeholder: 'Alex' },
                                ].map((field) => (
                                  <div key={field.id}>
                                    <Label htmlFor={field.id} className='text-xs text-muted-foreground'>{field.label}</Label>
                                    <Input
                                      id={field.id}
                                      value={field.value}
                                      onChange={(e) => field.onChange(e.target.value)}
                                      placeholder={field.placeholder}
                                      maxLength={'maxLength' in field ? field.maxLength : undefined}
                                      className='mt-1.5 rounded-xl'
                                    />
                                  </div>
                                ))}

                                <div>
                                  <Label htmlFor='seed-role' className='text-xs text-muted-foreground'>Role</Label>
                                  <Select value={seedRole} onValueChange={(v) => setSeedRole(v as UserRole)}>
                                    <SelectTrigger id='seed-role' className='mt-1.5 h-9 rounded-xl'>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DEPARTMENT_ROLES.map((r) => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label htmlFor='seed-shift' className='text-xs text-muted-foreground'>Shift</Label>
                                  <Select value={seedShift} onValueChange={(v) => setSeedShift(v as '1' | '2')}>
                                    <SelectTrigger id='seed-shift' className='mt-1.5 h-9 rounded-xl'>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value='1'>1st shift</SelectItem>
                                      <SelectItem value='2'>2nd shift</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* ── REVIEW STEP ───────────────────────────────────── */}
                    {step.id === 'REVIEW' && (
                      <div className='space-y-3'>
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                          <ReviewMetric
                            title='Selected Mode'
                            value={MODE_OPTIONS.find((o) => o.mode === selectedMode)?.title ?? selectedMode}
                            description={MODE_OPTIONS.find((o) => o.mode === selectedMode)?.description ?? ''}
                          />
                          <ReviewMetric
                            title='Entry Route'
                            value={startupRoute}
                            description='The configured route after the startup transition completes.'
                          />
                        </div>

                        <ReviewMetric
                          title='Department Setup'
                          value={
                            selectedMode === 'DEPARTMENT'
                              ? setupSource === 'create-new' ? 'Create seed admin' : 'Import existing roster'
                              : 'Not required'
                          }
                          description={
                            selectedMode === 'DEPARTMENT'
                              ? shareDirectory || 'Share directory not selected.'
                              : 'Workspace and standalone modes skip the department bootstrap step.'
                          }
                        />

                        <div className='rounded-2xl border border-border bg-card p-4'>
                          <div className='text-[10px] uppercase tracking-[0.18em] text-muted-foreground'>Included features</div>
                          <div className='mt-3'>
                            <FeatureComparisonTable selectedMode={selectedMode} />
                          </div>
                        </div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Nav footer */}
              <div className='shrink-0 border-t border-border px-6 py-4 sm:px-8'>
                <div className={cn('space-y-2', step.id === 'REVIEW' && 'mx-auto max-w-2xl')}>
                  {setupSuccessMessage && (
                    <div className='rounded-xl border border-chart-3/20 bg-chart-3/10 px-3 py-2 text-xs text-chart-3'>
                      {setupSuccessMessage}
                    </div>
                  )}
                  {setupError && (
                    <div className='rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
                      {setupError}
                    </div>
                  )}
                  <div className='flex items-center justify-between gap-3'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='rounded-xl'
                      onClick={previousStep}
                      disabled={!canGoBack || isSaving}
                    >
                      <ArrowLeft className='mr-1.5 size-3.5' />
                      Back
                    </Button>
                    {step.id === 'REVIEW' ? (
                      <Button
                        type='button'
                        size='sm'
                        className='rounded-xl px-5'
                        onClick={() => void applyMode()}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Entering D380…' : allowRevisit ? 'Save and enter D380' : 'Enter D380'}
                        <ArrowRight className='ml-1.5 size-3.5' />
                      </Button>
                    ) : (
                      <Button
                        type='button'
                        size='sm'
                        className='rounded-xl px-5'
                        onClick={nextStep}
                        disabled={!canGoNext || isSaving}
                      >
                        Continue
                        <ArrowRight className='ml-1.5 size-3.5' />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: preview panel — hidden on REVIEW */}
            {step.id !== 'REVIEW' && (
              <div className='relative hidden min-h-0 flex-1 bg-background md:flex'>
                <WorkspacePreview
                  mode={selectedMode}
                  step={step.id}
                  setupSource={setupSource}
                />
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
