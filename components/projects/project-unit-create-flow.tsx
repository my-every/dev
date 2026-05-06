'use client'

import { useState, useCallback, useMemo } from 'react'
import {
    Plus,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Package,
    Upload,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { SecureActionModal } from '@/components/profile/secure-action-modal'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/lib/utils'
import { type LwcType } from '@/lib/workbook/types'
import type { CreateProjectUnitInput } from '@/lib/services/contracts/project-details-v2-service'
import type { ProjectUnitRecord } from '@/types/d380-project-details'
import type { FileRevision } from '@/lib/revision/types'
import { canPerformAction } from '@/types/d380-user-session'
import {
    PdNumberField,
    UnitNumberField,
    RevisionField,
    LwcTypeField,
    DateField,
} from '@/components/projects/fields'

// ============================================================================
// Props
// ============================================================================

export interface ProjectUnitCreateFlowProps {
    /** Whether the dialog is open */
    open: boolean
    /** Called when the dialog should close */
    onClose: () => void
    /** Project ID for upload flow integration */
    projectId?: string
    /** Project display name (read-only) */
    projectName: string
    /** Default PD number to pre-fill */
    defaultPdNumber?: string
    /** Default unit number from the project (e.g. from workbook) */
    defaultUnitNumber?: string
    /** Default LWC type to pre-fill (from parent project) */
    defaultLwcType?: LwcType
    /** Default revision to pre-fill (from parent project) */
    defaultRevision?: string
    /** Existing units to auto-increment unit number */
    existingUnits: ProjectUnitRecord[]
    /** Available wire-list revisions (from revision sidebar) */
    wireListRevisions?: FileRevision[]
    /** Available layout revisions (from revision sidebar) */
    layoutRevisions?: FileRevision[]
    /** Called to actually create the unit (after auth) */
    onCreateUnit: (input: CreateProjectUnitInput) => Promise<void>
    /** Called when the user wants to upload a revision pair after unit creation. */
    onUploadRevision?: (seed: {
        pdNumber: string
        unitNumber: string
        revision: string
        lwcType?: LwcType
        dueDate?: Date
    }) => void
}



// ============================================================================
// Component
// ============================================================================

export function ProjectUnitCreateFlow({
    open,
    onClose,
    projectId,
    projectName,
    defaultPdNumber = '',
    defaultUnitNumber,
    defaultLwcType,
    defaultRevision,
    existingUnits,
    wireListRevisions,
    layoutRevisions,
    onCreateUnit,
    onUploadRevision,
}: ProjectUnitCreateFlowProps) {
    const { verifyCredentials, changePin } = useSession()

    // ── Form state ──────────────────────────────────────────────────────────
    const nextUnitNumber = useMemo(() => {
        if (existingUnits.length === 0) {
            // First unit: use the project's workbook unit number if available
            return defaultUnitNumber || '1'
        }
        const nums = existingUnits.map(u => {
            const n = parseInt(u.unitNumber, 10)
            return isNaN(n) ? 0 : n
        })
        return String(Math.max(...nums) + 1)
    }, [existingUnits, defaultUnitNumber])

    const [pdNumber, setPdNumber] = useState(defaultPdNumber)
    const [lwcType, setLwcType] = useState<LwcType | undefined>(defaultLwcType)
    const [revision, setRevision] = useState<string>(defaultRevision ?? 'A')
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
    const [planConlayDate, setPlanConlayDate] = useState<Date | undefined>(undefined)
    const [planConassyDate, setPlanConassyDate] = useState<Date | undefined>(undefined)

    // ── Auth state ──────────────────────────────────────────────────────────
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [authError, setAuthError] = useState<string | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [pinChangeRequired, setPinChangeRequired] = useState(false)

    // ── Submission state ────────────────────────────────────────────────────
    const [isCreating, setIsCreating] = useState(false)
    const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')
    const [feedbackMessage, setFeedbackMessage] = useState('')
    const [showFeedback, setShowFeedback] = useState(false)

    // ── Validation ──────────────────────────────────────────────────────────
    const isValid = pdNumber.trim().length > 0 && lwcType !== undefined

    // ── Reset form ──────────────────────────────────────────────────────────
    const resetForm = useCallback(() => {
        setPdNumber(defaultPdNumber)
        setLwcType(defaultLwcType)
        setRevision(defaultRevision ?? 'A')
        setDueDate(undefined)
        setPlanConlayDate(undefined)
        setPlanConassyDate(undefined)
        setAuthError(null)
        setPinChangeRequired(false)
        setShowFeedback(false)
    }, [defaultPdNumber, defaultLwcType, defaultRevision])

    // ── Handle close ────────────────────────────────────────────────────────
    const handleClose = useCallback(() => {
        if (isCreating || isVerifying) return
        resetForm()
        onClose()
    }, [isCreating, isVerifying, resetForm, onClose])

    // ── Submit (opens auth modal) ───────────────────────────────────────────
    const handleSubmitClick = useCallback((withUpload = false) => {
        if (!isValid) return
        setUploadAfterCreate(withUpload)
        setAuthError(null)
        setPinChangeRequired(false)
        setShowAuthModal(true)
    }, [isValid])

    // ── Execute creation after auth ─────────────────────────────────────────
    const executeCreate = useCallback(async (andUpload = false) => {
        setIsCreating(true)
        try {
            const unitNum = nextUnitNumber
            const input: CreateProjectUnitInput = {
                unitNumber: unitNum,
                displayName: `${projectName}`,
                pdNumber: pdNumber.trim(),
                lwcType,
                revision,
                dueDate: dueDate?.toISOString(),
                planConlayDate: planConlayDate?.toISOString(),
                planConassyDate: planConassyDate?.toISOString(),
            }

            await onCreateUnit(input)

            if (andUpload && onUploadRevision) {
                // Close create dialog and open upload flow seeded with unit values
                resetForm()
                onClose()
                onUploadRevision({
                    pdNumber: pdNumber.trim(),
                    unitNumber: unitNum,
                    revision,
                    lwcType,
                    dueDate,
                })
                return
            }

            setFeedbackType('success')
            setFeedbackMessage(`Unit ${nextUnitNumber} created successfully.`)
            setShowFeedback(true)
            setTimeout(() => {
                setShowFeedback(false)
                resetForm()
                onClose()
            }, 1500)
        } catch (err) {
            setFeedbackType('error')
            setFeedbackMessage(
                err instanceof Error ? err.message : 'Failed to create unit.',
            )
            setShowFeedback(true)
            setTimeout(() => setShowFeedback(false), 3000)
        } finally {
            setIsCreating(false)
        }
    }, [
        nextUnitNumber,
        projectName,
        pdNumber,
        lwcType,
        revision,
        dueDate,
        planConlayDate,
        planConassyDate,
        onCreateUnit,
        onUploadRevision,
        resetForm,
        onClose,
    ])

    // Track intent to upload after creation
    const [uploadAfterCreate, setUploadAfterCreate] = useState(false)

    // ── Auth handlers ───────────────────────────────────────────────────────
    const handleAuthSubmit = useCallback(
        async (badge: string, pin: string) => {
            setIsVerifying(true)
            setAuthError(null)
            setPinChangeRequired(false)

            try {
                const result = await verifyCredentials(badge, pin)
                if (!result.success || !result.user) {
                    setPinChangeRequired(Boolean(result.requiresPinChange))
                    setAuthError(result.error || 'Authentication failed.')
                    return
                }

                if (!canPerformAction(result.user.role, 'UPLOAD_PROJECT')) {
                    setAuthError('You do not have permission to create units.')
                    return
                }

                setShowAuthModal(false)
                void executeCreate(uploadAfterCreate)
            } catch {
                setAuthError('Verification failed. Please try again.')
            } finally {
                setIsVerifying(false)
            }
        },
        [verifyCredentials, executeCreate, uploadAfterCreate],
    )

    const handlePinChange = useCallback(
        async (badge: string, currentPin: string, nextPin: string) => {
            setIsVerifying(true)
            setAuthError(null)
            try {
                const result = await changePin(badge, currentPin, nextPin)
                if (result.success) {
                    setPinChangeRequired(false)
                    setAuthError(null)
                } else {
                    setAuthError(result.error || 'PIN change failed.')
                }
            } catch {
                setAuthError('PIN change failed.')
            } finally {
                setIsVerifying(false)
            }
        },
        [changePin],
    )

    return (
        <>
            <Dialog open={open} onOpenChange={val => !val && handleClose()}>
                <DialogContent className="sm:max-w-lg min-w-max ">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            Create New Unit
                        </DialogTitle>
                        <DialogDescription>
                            Add a new unit to <span className="font-medium text-foreground">{projectName}</span>.
                            Unit {nextUnitNumber} will be created with the details below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* ── Row 1: PD Number + Unit Number ─────────────────────────── */}
                        <div className="flex flex-wrap flex-1 gap-4">
                            {/* ── Row 2: Project Name (read-only) ────────────────────────── */}
                            <div className="space-y-2 flex-1">
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Project Name
                                </Label>
                                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm">
                                    {projectName}
                                </div>
                            </div>
                            <PdNumberField
                                mode="create"
                                label="PD Number"
                                value={pdNumber}
                                onChange={setPdNumber}
                                placeholder="e.g. 4M093"
                                required
                            />
                            <UnitNumberField
                                mode="create"
                                label="Unit Number"
                                value={String(nextUnitNumber)}
                                autoIncrement
                            />
                        </div>
                        <Separator />

                        {/* ── Row 5: Date fields ──────────────────────────────────────── */}
                        <div className="grid grid-cols-3 gap-3">
                            <DateField
                                mode="create"
                                label="PLAN CONLAY"
                                value={planConlayDate}
                                onChange={setPlanConlayDate}
                                placeholder="MM/DD/YYYY"
                            />
                            <DateField
                                mode="create"
                                label="PLAN CONASSY"
                                value={planConassyDate}
                                onChange={setPlanConassyDate}
                                placeholder="MM/DD/YYYY"
                            />
                            <DateField
                                mode="create"
                                label="ORIGINAL COMMIT"
                                value={dueDate}
                                onChange={setDueDate}
                                placeholder="MM/DD/YYYY"
                            />
                        </div>

                        {/* Summary badges */}
                        {isValid && (
                            <>
                                <Separator />
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <UnitNumberField
                                        mode="status"
                                        value={String(nextUnitNumber)}
                                    />
                                    <PdNumberField
                                        mode="status"
                                        value={pdNumber.trim()}
                                    />
                                    {lwcType && (
                                        <LwcTypeField
                                            mode="status"
                                            value={lwcType}
                                        />
                                    )}
                                    <RevisionField
                                        mode="status"
                                        value={revision}
                                    />
                                    {dueDate && (
                                        <DateField
                                            mode="status"
                                            label="Due"
                                            value={dueDate}
                                        />
                                    )}
                                </div>
                                {onUploadRevision && (
                                    <p className="text-[10px] text-muted-foreground">
                                        <span className="font-medium">Create & Upload Files</span> will create this unit then open the upload flow pre-filled with PD#, unit number, revision, and LWC type.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={isCreating}
                        >
                            Cancel
                        </Button>
                        <div className="flex flex-1 justify-end gap-2">

                            <Button
                                onClick={() => handleSubmitClick(false)}
                                disabled={!isValid || isCreating}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating…
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        Create
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Auth Modal ───────────────────────────────────────────────────── */}
            <SecureActionModal
                open={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                action="UPLOAD_PROJECT"
                onSubmit={handleAuthSubmit}
                isSubmitting={isVerifying}
                error={authError}
                pinChangeRequired={pinChangeRequired}
                onChangePin={handlePinChange}
                title="Create Unit"
                description="Enter your badge number and PIN to create this unit."
                showNumpad
            />

            {/* ── Feedback overlay ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {showFeedback && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className={cn(
                                'mx-4 max-w-sm rounded-xl border bg-card p-6 text-center shadow-2xl',
                                feedbackType === 'success'
                                    ? 'border-emerald-500/30'
                                    : 'border-destructive/30',
                            )}
                        >
                            <div
                                className={cn(
                                    'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full',
                                    feedbackType === 'success'
                                        ? 'bg-emerald-500/10'
                                        : 'bg-destructive/10',
                                )}
                            >
                                {feedbackType === 'success' ? (
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                ) : (
                                    <AlertCircle className="h-8 w-8 text-destructive" />
                                )}
                            </div>
                            <h3
                                className={cn(
                                    'mb-2 text-lg font-semibold',
                                    feedbackType === 'success'
                                        ? 'text-emerald-500'
                                        : 'text-destructive',
                                )}
                            >
                                {feedbackType === 'success' ? 'Unit Created' : 'Creation Failed'}
                            </h3>
                            <p className="text-sm text-muted-foreground">{feedbackMessage}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
