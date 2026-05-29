/**
 * Project Schema Generators
 *
 * Transforms a ProjectModel + detection results into the new lean schemas:
 *   - ProjectManifest  (~5 KB)  → project-manifest.json
 *   - SheetSchema[]    (~20-40 KB each) → sheets/{slug}.json
 *
 * These replace the monolithic project-context.json (1-2 MB) pattern.
 */

import type { ProjectModel } from '@/lib/workbook/types'
import type { ProjectManifest, ManifestAssignmentNode, ManifestReferenceSheet } from '@/types/project-manifest'
import type { SheetSchema, SheetAssignmentState, SheetLayoutMatch } from '@/types/sheet-schema'
import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import { detectSwsType, type SwsTypeId } from '@/lib/assignment/sws-detection'
import { filterExecutableSheets } from '@/lib/assignment/sheet-classification'

function getDefaultStageForSwsType(swsType: SwsTypeId): MappedAssignment['selectedStage'] {
    switch (swsType) {
        case 'BLANK':
        case 'RAIL':
        case 'BOX':
        case 'PANEL':
        case 'COMPONENT':
        case 'UNDECIDED':
        default:
            return 'READY_TO_LAY'
    }
}

export function buildDefaultMappedAssignments(model: ProjectModel): MappedAssignment[] {
    const { assignments: executableSheets } = filterExecutableSheets(model.sheets, model.sheetData, {
        hasLayoutMatch: () => true,
    })

    return executableSheets.map((sheet) => {
        const parsedSheet = sheet.id ? model.sheetData[sheet.id] : undefined
        const hasWireRows = Boolean(parsedSheet?.semanticRows?.some(row =>
            (row.wireId && row.wireId.length > 0)
            || (row.fromDeviceId && row.fromDeviceId.length > 0)
            || (row.toDeviceId && row.toDeviceId.length > 0),
        ))
        const detection = detectSwsType(sheet, {
            sheetData: parsedSheet,
            hasWireRows,
        })
        const selectedStage = getDefaultStageForSwsType(detection.type)

        return {
            sheetSlug: sheet.slug ?? '',
            sheetName: sheet.name ?? '',
            rowCount: sheet.rowCount,
            sheetKind: 'assignment',
            detectedSwsType: detection.type,
            detectedConfidence: detection.confidence,
            detectedReasons: detection.reasons,
            selectedSwsType: detection.type,
            selectedStage,
            selectedStatus: 'NOT_STARTED',
            overrideReason: '',
            isOverride: false,
            requiresWireSws: detection.requiresWireSws ?? hasWireRows,
            requiresCrossWireSws: detection.requiresCrossWireSws ?? false,
            matchedLayoutPage: undefined,
            matchedLayoutTitle: sheet.name ?? '',
        }
    })
}

// ── Assignment Node Builder ────────────────────────────────────────────────

/**
 * Build a single ManifestAssignmentNode from a MappedAssignment.
 * Pass `existing` to preserve accumulated data (panducts, rails, devices, files, etc.)
 * when updating rather than creating from scratch.
 */
export function buildManifestAssignmentNode(
    a: MappedAssignment,
    existing?: Partial<ManifestAssignmentNode>,
): ManifestAssignmentNode {
    const slug = a.sheetSlug
    return {
        sheetSlug: slug,
        sheetName: a.sheetName,
        kind: 'operational',
        sheetPath: existing?.sheetPath ?? `state/sheets/${slug}.json`,
        rowCount: a.rowCount,
        columnCount: existing?.columnCount,
        sheetIndex: existing?.sheetIndex,
        hasData: existing?.hasData,
        swsType: a.selectedSwsType,
        stage: a.selectedStage,
        status: a.selectedStatus,
        panducts: existing?.panducts ?? [],
        rails: existing?.rails ?? [],
        whiteLabels: existing?.whiteLabels ?? [],
        blueLabels: existing?.blueLabels ?? [],
        heatShrinkLabels: existing?.heatShrinkLabels ?? [],
        partNumbers: existing?.partNumbers ?? [],
        files: existing?.files ?? {
            wireListSchemaPath: `state/wire-list-print-schema/${slug}.json`,
            ipvWireListSchemaPath: `state/ipv/${slug}-ipv.json`,
            brandListSchemaPath: `state/wire-brand-list/${slug}.json`,
            buildUpSWSSchemaPath: `state/build-up-sws-schema/${slug}.json`,
        },
        layout: a.matchedLayoutPage != null
            ? {
                primaryPage: {
                    pageNumber: a.matchedLayoutPage,
                    title: a.matchedLayoutTitle ?? '',
                    confidence: 'medium',
                    matchMethod: 'title',
                    score: 50,
                },
                pages: [],
            }
            : null,
        devices: existing?.devices ?? {},
        boardAssignment: existing?.boardAssignment,
    }
}

// ── Manifest Generator ────────────────────────────────────────────────────

export function buildProjectManifest(
    model: ProjectModel,
    assignments: MappedAssignment[],
): ProjectManifest {
    const REFERENCE_SLUGS = new Set([
        'blue-labels', 'white-labels', 'heat-shrink-labels',
        'part-number-list', 'cable-part-numbers', 'panel-errors',
    ])

    const referenceSheets: Record<string, ManifestReferenceSheet> = {}
    for (const s of model.sheets) {
        if (s.kind === 'reference' || REFERENCE_SLUGS.has(s.slug)) {
            referenceSheets[s.slug] = {
                sheetSlug: s.slug,
                sheetName: s.name,
                kind: 'reference',
                sheetPath: `state/sheets/${s.slug}.json`,
                rowCount: s.rowCount,
                columnCount: s.columnCount,
                sheetIndex: s.sheetIndex,
                hasData: s.hasData,
            }
        }
    }

    const assignmentNodes: Record<string, ManifestAssignmentNode> = {}
    for (const a of assignments) {
        const sheetMeta = model.sheets.find(s => s.slug === a.sheetSlug)
        assignmentNodes[a.sheetSlug] = buildManifestAssignmentNode(a, {
            columnCount: sheetMeta?.columnCount,
            sheetIndex: sheetMeta?.sheetIndex,
            hasData: sheetMeta?.hasData,
        })
    }

    const toIso = (d: Date | string | undefined) => {
        if (!d) return undefined
        return d instanceof Date ? d.toISOString() : d
    }

    const sheets = model.sheets.map((sheet) => ({
        slug: sheet.slug,
        name: sheet.name,
        kind: sheet.kind,
        sheetPath: `state/sheets/${sheet.slug}.json`,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        sheetIndex: sheet.sheetIndex,
        hasData: sheet.hasData,
    }))

    return {
        id: model.id,
        name: model.name,
        filename: model.filename,
        pdNumber: model.pdNumber,
        unitNumber: model.unitNumber,
        revision: model.revision,
        lwcType: model.lwcType,
        color: model.color,
        status: model.status,
        createdAt: toIso(model.createdAt) ?? new Date().toISOString(),
        sheets,
        dueDate: toIso(model.dueDate),
        planConlayDate: toIso(model.planConlayDate),
        planConassyDate: toIso(model.planConassyDate),
        shipDate: toIso(model.shipDate),
        deptTargetDate: toIso(model.deptTargetDate),
        assignments: assignmentNodes,
        referenceSheets,
        lifecycleGates: model.lifecycleGates,
        estimatedTotalHours: model.estimatedTotalHours,
        estimatedPanelCount: model.estimatedPanelCount,
        daysLate: model.daysLate,
        activeWorkbookRevisionId: model.activeWorkbookRevisionId,
        activeLayoutRevisionId: model.activeLayoutRevisionId,
    }
}

// ── Sheet Schema Generator ────────────────────────────────────────────────

export function buildSheetSchema(
    model: ProjectModel,
    sheetSlug: string,
    assignment: MappedAssignment | undefined,
): SheetSchema {
    // Find the sheet summary + data
    const summary = model.sheets.find((s) => s.slug === sheetSlug)
    if (!summary) {
        throw new Error(`Sheet "${sheetSlug}" not found in project model`)
    }

    const sheetData = model.sheetData[summary.id]
    if (!sheetData) {
        throw new Error(`Sheet data for "${sheetSlug}" (id: ${summary.id}) not found`)
    }

    const assignmentState: SheetAssignmentState = assignment
        ? {
            swsType: assignment.selectedSwsType,
            stage: assignment.selectedStage,
            status: assignment.selectedStatus,
            isOverride: assignment.isOverride,
            overrideReason: assignment.overrideReason,
            detectedSwsType: assignment.detectedSwsType,
            detectedConfidence: assignment.detectedConfidence,
            detectedReasons: assignment.detectedReasons,
            requiresWireSws: assignment.requiresWireSws,
            requiresCrossWireSws: assignment.requiresCrossWireSws,
        }
        : {
            swsType: 'UNDECIDED',
            stage: 'BUILD_UP' as const,
            status: 'NOT_STARTED' as const,
            isOverride: false,
            overrideReason: '',
            detectedSwsType: 'UNDECIDED',
            detectedConfidence: 0,
            detectedReasons: [],
            requiresWireSws: false,
            requiresCrossWireSws: false,
        }

    let layoutMatch: SheetLayoutMatch | undefined
    if (assignment?.matchedLayoutPage) {
        layoutMatch = {
            pageNumber: assignment.matchedLayoutPage,
            pageTitle: assignment.matchedLayoutTitle ?? '',
            confidence: 'high',
        }
    }

    return {
        slug: sheetSlug,
        name: summary.name,
        kind: summary.kind,
        sheetIndex: summary.sheetIndex,
        headers: sheetData.headers ?? [],
        rows: sheetData.semanticRows ?? [],
        rawRows: sheetData.rows ?? [],
        rowCount: sheetData.rowCount,
        metadata: sheetData.metadata,
        assignment: assignmentState,
        layout: layoutMatch,
        generatedAt: new Date().toISOString(),
    }
}

// ── Batch: build all sheet schemas for a project ───────────────────────────

export function buildAllSheetSchemas(
    model: ProjectModel,
    assignments: MappedAssignment[],
): SheetSchema[] {
    const assignmentMap = new Map(assignments.map((a) => [a.sheetSlug, a]))

    return model.sheets
        .filter((s) => s.hasData)
        .map((s) => buildSheetSchema(model, s.slug, assignmentMap.get(s.slug)))
}
