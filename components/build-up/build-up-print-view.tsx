'use client'

/**
 * BuildUpPrintView
 * 
 * Printable SWS worksheet for Build Up execution.
 * Can be printed blank or with execution data.
 */

import { forwardRef } from 'react'
import { CheckCircle2, Circle, User, Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BuildUpExecutionSession } from '@/types/d380-build-up-execution'
import { getSectionDefinitionsForSwsType } from '@/types/d380-build-up-execution'

// ============================================================================
// TYPES
// ============================================================================

interface BuildUpPrintViewProps {
  assignmentName: string
  swsType: string
  projectName?: string
  pdNumber?: string
  session?: BuildUpExecutionSession | null
  mode: 'blank' | 'with_execution'
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(isoString?: string): string {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString()
}

function formatTime(isoString?: string): string {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return ''
  return `${formatDate(isoString)} ${formatTime(isoString)}`
}

// ============================================================================
// PRINT PAGE COMPONENT
// ============================================================================

function PrintPage({
  children,
  pageNumber,
  totalPages,
  footer = 'Caterpillar: Confidential Green',
}: {
  children: React.ReactNode
  pageNumber?: number
  totalPages?: number
  footer?: string
}) {
  return (
    <section className="print-page mx-auto w-[800px] print:w-full bg-white print:shadow-none print:mx-0">
      <div className="min-h-[1120px] flex flex-col px-6 py-6 print:min-h-0 print:px-4">
        <div className="flex-1">{children}</div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-3 mt-auto">
          <span>{footer}</span>
          {pageNumber && totalPages && (
            <span>Page {pageNumber} of {totalPages}</span>
          )}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// COVER SECTION
// ============================================================================

function CoverSection({
  assignmentName,
  swsType,
  projectName,
  pdNumber,
  session,
}: {
  assignmentName: string
  swsType: string
  projectName?: string
  pdNumber?: string
  session?: BuildUpExecutionSession | null
}) {
  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Build Up Standard Work Sheet</h1>
          <p className="text-lg text-muted-foreground mt-1">{assignmentName}</p>
        </div>
        <img
          src="/SolarTurbines-Light.svg"
          alt="Solar Turbines"
          className="h-10 w-auto"
        />
      </div>
      
      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="font-medium text-muted-foreground w-24">SWS Type:</span>
            <span className="font-semibold">{swsType}</span>
          </div>
          {pdNumber && (
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-24">PD Number:</span>
              <span>{pdNumber}</span>
            </div>
          )}
          {projectName && (
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-24">Project:</span>
              <span>{projectName}</span>
            </div>
          )}
        </div>
        
        {session && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-24">Started:</span>
              <span>{formatDateTime(session.startedAt)}</span>
            </div>
            {session.completedAt && (
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-24">Completed:</span>
                <span>{formatDateTime(session.completedAt)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-24">Started By:</span>
              <span>{session.startedBy.name} ({session.startedBy.badgeId})</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION PRINT COMPONENT
// ============================================================================

interface PrintSectionProps {
  title: string
  order: number
  steps: Array<{
    label: string
    description?: string
    completed?: boolean
    completedAt?: string
    completedBy?: { badgeId: string; name: string }
  }>
  members?: Array<{
    badgeId: string
    name: string
    shift: string
    startedAt: string
    endedAt?: string
  }>
  startedAt?: string
  completedAt?: string
  mode: 'blank' | 'with_execution'
}

function PrintSection({
  title,
  order,
  steps,
  members,
  startedAt,
  completedAt,
  mode,
}: PrintSectionProps) {
  const showExecution = mode === 'with_execution'
  
  return (
    <div className="mb-6 break-inside-avoid">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-3 pb-2 border-b">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {order}
        </div>
        <h2 className="text-lg font-semibold flex-1">{title}</h2>
        {showExecution && completedAt && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Complete</span>
          </div>
        )}
      </div>
      
      {/* Steps Table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left py-1.5 px-2 font-medium w-10">#</th>
            <th className="text-left py-1.5 px-2 font-medium">Step</th>
            <th className="text-center py-1.5 px-2 font-medium w-12">Done</th>
            {showExecution && (
              <>
                <th className="text-center py-1.5 px-2 font-medium w-16">Time</th>
                <th className="text-left py-1.5 px-2 font-medium w-24">Badge</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {steps.map((step, idx) => (
            <tr key={idx} className="border-b border-border/30">
              <td className="py-1.5 px-2 text-muted-foreground">{idx + 1}</td>
              <td className="py-1.5 px-2">
                <div className={step.completed ? 'line-through text-muted-foreground' : ''}>
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                )}
              </td>
              <td className="py-1.5 px-2 text-center">
                {showExecution ? (
                  step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                  )
                ) : (
                  <div className="h-4 w-4 border border-muted-foreground mx-auto" />
                )}
              </td>
              {showExecution && (
                <>
                  <td className="py-1.5 px-2 text-center text-xs text-muted-foreground">
                    {step.completedAt ? formatTime(step.completedAt) : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-xs">
                    {step.completedBy?.badgeId || '-'}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Member Activity (if execution mode) */}
      {showExecution && members && members.length > 0 && (
        <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
          <div className="font-medium mb-1">Member Activity:</div>
          <div className="space-y-0.5">
            {members.map((member, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span>{member.name}</span>
                <span className="text-muted-foreground">({member.badgeId})</span>
                <span className="capitalize px-1 py-0.5 bg-muted rounded text-[10px]">
                  {member.shift}
                </span>
                <span className="text-muted-foreground ml-auto">
                  {formatTime(member.startedAt)}
                  {member.endedAt && ` - ${formatTime(member.endedAt)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Blank Sign-off (if blank mode) */}
      {mode === 'blank' && (
        <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">Badge #:</div>
            <div className="border-b border-muted-foreground h-6" />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Shift:</div>
            <div className="border-b border-muted-foreground h-6" />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Date/Time:</div>
            <div className="border-b border-muted-foreground h-6" />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SIGN-OFF SECTION
// ============================================================================

function SignOffSection({
  session,
  mode,
}: {
  session?: BuildUpExecutionSession | null
  mode: 'blank' | 'with_execution'
}) {
  const showExecution = mode === 'with_execution' && session
  
  return (
    <div className="mt-8 pt-6 border-t">
      <h2 className="text-lg font-semibold mb-4">Build Up Sign-Off</h2>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Assembler */}
        <div className="space-y-3">
          <div className="font-medium">Assembler</div>
          {showExecution && session?.startedBy ? (
            <div className="space-y-1 text-sm">
              <div>Name: {session.startedBy.name}</div>
              <div>Badge: {session.startedBy.badgeId}</div>
              <div>Date: {formatDate(session.completedAt || session.startedAt)}</div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 items-end">
                <span className="w-16 text-muted-foreground">Name:</span>
                <div className="flex-1 border-b border-muted-foreground h-6" />
              </div>
              <div className="flex gap-2 items-end">
                <span className="w-16 text-muted-foreground">Badge:</span>
                <div className="flex-1 border-b border-muted-foreground h-6" />
              </div>
              <div className="flex gap-2 items-end">
                <span className="w-16 text-muted-foreground">Date:</span>
                <div className="flex-1 border-b border-muted-foreground h-6" />
              </div>
            </div>
          )}
        </div>
        
        {/* Inspector */}
        <div className="space-y-3">
          <div className="font-medium">Inspector</div>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2 items-end">
              <span className="w-16 text-muted-foreground">Name:</span>
              <div className="flex-1 border-b border-muted-foreground h-6" />
            </div>
            <div className="flex gap-2 items-end">
              <span className="w-16 text-muted-foreground">Badge:</span>
              <div className="flex-1 border-b border-muted-foreground h-6" />
            </div>
            <div className="flex gap-2 items-end">
              <span className="w-16 text-muted-foreground">Date:</span>
              <div className="flex-1 border-b border-muted-foreground h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BuildUpPrintView = forwardRef<HTMLDivElement, BuildUpPrintViewProps>(
  function BuildUpPrintView(
    { assignmentName, swsType, projectName, pdNumber, session, mode },
    ref
  ) {
    // Get section definitions (use session sections if available, else generate from type)
    const sections = session?.sections || getSectionDefinitionsForSwsType(swsType).map((def, idx) => ({
      id: `def-${idx}`,
      sectionKey: def.key,
      title: def.title,
      order: def.order,
      steps: def.steps.map((s, sidx) => ({
        id: `step-${idx}-${sidx}`,
        label: s.label,
        description: s.description,
        completed: false,
      })),
      members: [],
      status: 'pending' as const,
    }))
    
    return (
      <div ref={ref} className="print-container">
        <PrintPage pageNumber={1} totalPages={1}>
          {/* Cover/Header */}
          <CoverSection
            assignmentName={assignmentName}
            swsType={swsType}
            projectName={projectName}
            pdNumber={pdNumber}
            session={session}
          />
          
          {/* Sections */}
          {sections.map((section, idx) => (
            <PrintSection
              key={section.id}
              title={section.title}
              order={section.order}
              steps={section.steps}
              members={section.members}
              startedAt={section.startedAt}
              completedAt={section.completedAt}
              mode={mode}
            />
          ))}
          
          {/* Sign-Off */}
          <SignOffSection session={session} mode={mode} />
        </PrintPage>
      </div>
    )
  }
)
