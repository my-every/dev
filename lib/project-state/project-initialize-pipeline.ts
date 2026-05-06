'use server'

/**
 * Project Initialize Pipeline
 *
 * Chains:
 *   1. Read StoredProject
 *   2. Detect SWS type for every sheet
 *   3. Build default MappedAssignment[]
 *   4. Read layout mapping (if available) for matchedLayoutPage
 *   5. Write assignment mappings to disk
 *   6. Compute stage-hours breakdown
 *   7. Returns initialize result with assignment mappings + stage hours
 *
 * Reference-sheets generation and device-part-number maps are already
 * triggered as a side-effect of `writeStoredProject()`, so they are
 * not repeated here.
 */

import type { StoredProject } from '@/types/d380-shared'
import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import type { SwsTypeId, SwsDetectionResult } from '@/lib/assignment/sws-detection'
import {
    readProjectManifest,
    readAllSheetSchemas,
    writeAssignmentMappings,
} from './share-project-state-handlers'
import { batchDetectSwsTypes } from '@/lib/assignment/sws-detection'
import { estimateWireTime } from '@/lib/wire-list-print/time-estimation'
import {
    ASSIGNMENT_STAGES,
    SWS_STAGE_PROFILES,
    type AssignmentStageId,
} from '@/types/d380-assignment-stages'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InitializePipelineResult {
    projectId: string
    mappings: MappedAssignment[]
    stageHours: InitStageHoursEntry[]
    totalEstimatedMinutes: number
    sheetBreakdowns: InitSheetBreakdown[]
    warnings: string[]
}

export interface InitStageHoursEntry {
    stageId: AssignmentStageId
    label: string
    shortLabel: string
    estimatedMinutes: number
}

export interface InitSheetBreakdown {
    sheetSlug: string
    sheetName: string
    rowCount: number
    estimatedMinutes: number
    detectedSwsType: string
    detectedConfidence: number
}

// ---------------------------------------------------------------------------
// SwsTypeId → MappedAssignment type normaliser
// ---------------------------------------------------------------------------

/** Convert detection SwsTypeId to the enum accepted by MappedAssignment */
function normaliseMappedSwsType(
    swsType: SwsTypeId,
): MappedAssignment['detectedSwsType'] {
    // The mapped assignment schema accepts both legacy short-form and canonical
    switch (swsType) {
        case 'BLANK':
            return 'BLANK'
        case 'RAIL':
            return 'RAIL'
        case 'BOX':
            return 'BOX'
        case 'PANEL':
            return 'PANEL'
        case 'COMPONENT':
            return 'COMPONENT'
        case 'UNDECIDED':
        default:
            return 'UNDECIDED'
    }
}

/** Pick initial stage based on SWS type */
function defaultStageForSwsType(
    swsType: SwsTypeId,
): MappedAssignment['selectedStage'] {
    switch (swsType) {
        case 'BLANK':
        case 'RAIL':
        case 'COMPONENT':
        case 'BOX':
            return 'BUILD_UP'
        case 'PANEL':
            return 'READY_TO_LAY'
        case 'UNDECIDED':
        default:
            return 'READY_TO_LAY'
    }
}

// ---------------------------------------------------------------------------
// Per-sheet wiring time
// ---------------------------------------------------------------------------

function computeSheetWiringMinutes(
    rows: Array<{
        gaugeSize?: string
        wireNo?: string
        wireId?: string
    }>,
): number {
    let total = 0
    for (const row of rows) {
        const wireNo = (row.wireNo ?? '').trim()
        const wireId = (row.wireId ?? '').trim()
        const gaugeSize = (row.gaugeSize ?? '').trim()
        if (wireNo === '*' && !wireId && !gaugeSize) continue
        const est = estimateWireTime(undefined, row.gaugeSize)
        total += est.totalMinutes
    }
    return total
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function runProjectInitializePipeline(
    projectId: string,
): Promise<InitializePipelineResult> {
    const warnings: string[] = []

    // 1. Read manifest + sheet schemas ----------------------------------------
    const manifest = await readProjectManifest(projectId)
    if (!manifest) throw new Error(`Project ${projectId} not found`)

    const sheetSchemas = await readAllSheetSchemas(projectId)

    // 2. SWS detection for every sheet (using manifest sheet entries) ----------
    const detectionMap = batchDetectSwsTypes(manifest.sheets)

    // 3. Build MappedAssignment[] from sheet schemas + detection ---------------
    const mappings: MappedAssignment[] = []
    const sheetBreakdowns: InitSheetBreakdown[] = []
    let projectWiringMinutes = 0

    for (const schema of sheetSchemas) {
        const detection: SwsDetectionResult = detectionMap.get(schema.slug) ?? {
            type: 'UNDECIDED',
            confidence: 0,
            reasons: ['No detection available'],
            alternativeTypes: [],
        }

        const kind: MappedAssignment['sheetKind'] =
            schema.kind === 'operational'
                ? 'assignment'
                : schema.kind === 'reference'
                    ? 'reference'
                    : 'other'

        const mappedType = normaliseMappedSwsType(detection.type)

        const rows = schema.rows ?? []
        const sheetMinutes = computeSheetWiringMinutes(rows)
        projectWiringMinutes += sheetMinutes

        sheetBreakdowns.push({
            sheetSlug: schema.slug,
            sheetName: schema.name,
            rowCount: rows.length,
            estimatedMinutes: sheetMinutes,
            detectedSwsType: mappedType,
            detectedConfidence: detection.confidence,
        })

        mappings.push({
            sheetSlug: schema.slug,
            sheetName: schema.name,
            rowCount: schema.rowCount,
            sheetKind: kind,
            detectedSwsType: mappedType,
            detectedConfidence: detection.confidence,
            detectedReasons: detection.reasons,
            selectedSwsType: mappedType,
            selectedStage: defaultStageForSwsType(detection.type),
            selectedStatus: 'NOT_STARTED',
            overrideReason: '',
            isOverride: false,
            requiresWireSws: detection.requiresWireSws ?? false,
            requiresCrossWireSws: detection.requiresCrossWireSws ?? false,
            matchedLayoutPage: schema.layoutMatch?.pageNumber,
            matchedLayoutTitle: schema.layoutMatch?.pageTitle,
        })
    }

    // 5. Persist assignment mappings -------------------------------------------
    await writeAssignmentMappings(projectId, manifest.pdNumber ?? null, mappings)

    // 6. Compute stage-hours summary ------------------------------------------
    const profile = SWS_STAGE_PROFILES['PANEL'] ?? SWS_STAGE_PROFILES.UNDECIDED
    const weights = profile.stageWeightPercent
    const wiringWeight = (weights.WIRING ?? 40) / 100
    const impliedTotal =
        wiringWeight > 0 ? projectWiringMinutes / wiringWeight : projectWiringMinutes

    const stageHours: InitStageHoursEntry[] = ASSIGNMENT_STAGES
        .filter((s) => !s.isQueue && weights[s.id] != null)
        .map((stage) => {
            const weight = (weights[stage.id] ?? 0) / 100
            const estimated =
                stage.id === 'WIRING'
                    ? Math.round(projectWiringMinutes)
                    : Math.round(impliedTotal * weight)
            return {
                stageId: stage.id,
                label: stage.label,
                shortLabel: stage.shortLabel,
                estimatedMinutes: estimated,
            }
        })

    const totalEstimatedMinutes = stageHours.reduce(
        (s, e) => s + e.estimatedMinutes,
        0,
    )

    return {
        projectId,
        mappings,
        stageHours,
        totalEstimatedMinutes,
        sheetBreakdowns,
        warnings,
    }
}
