/**
 * Wiring Execution Session Builder
 *
 * Converts PrintLocationGroup[] (the same data used by print-modal)
 * into a WiringExecutionSession ready for interactive execution.
 */

import type { PrintLocationGroup } from "@/lib/wire-list-print/model";
import type { PrintSettings } from "@/lib/wire-list-print/defaults";
import type { WiringExecutionSession, WiringSectionExecution, WireRowCompletion } from "@/types/d380-wiring-execution";
import { summarizeSectionTime } from "@/lib/wire-list-print/time-estimation";

function generateId(): string {
    return `wex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract device group key from a device ID.
 * e.g. "HL0171:X1" → "HL0171", "SA0170:B2-13" → "SA0170"
 */
function extractDeviceGroup(deviceId: string): string {
    if (!deviceId) return "";
    const colonIndex = deviceId.indexOf(":");
    return colonIndex >= 0 ? deviceId.slice(0, colonIndex) : deviceId;
}

/**
 * Determines if a row is a printable connection (not a device-change separator).
 */
function isPrintableRow(row: { fromDeviceId?: string; toDeviceId?: string }): boolean {
    const from = (row.fromDeviceId || "").trim();
    const to = (row.toDeviceId || "").trim();
    return from.length > 0 || to.length > 0;
}

export interface BuildSessionOptions {
    projectId: string;
    sheetName: string;
    sheetSlug: string;
    swsType: string;
    badge: string;
    shift: string;
    locationGroups: PrintLocationGroup[];
    settings: PrintSettings;
}

/**
 * Build a fresh WiringExecutionSession from processed location groups.
 * Respects hidden sections and cross-wire settings from PrintSettings.
 */
export function buildWiringExecutionSession(options: BuildSessionOptions): WiringExecutionSession {
    const { projectId, sheetName, sheetSlug, swsType, badge, shift, locationGroups, settings } = options;

    const activeHiddenSections = settings.mode === "branding"
        ? settings.brandingHiddenSections
        : settings.standardHiddenSections;

    const sections: WiringSectionExecution[] = [];

    for (let groupIndex = 0; groupIndex < locationGroups.length; groupIndex++) {
        const group = locationGroups[groupIndex];
        const locationKey = `loc-${groupIndex}`;

        // Skip hidden location groups
        if (activeHiddenSections.has(locationKey)) continue;
        // Skip cross-wire sections (separate workflow)
        if (settings.crossWireSections.has(locationKey)) continue;

        for (let subIndex = 0; subIndex < group.subsections.length; subIndex++) {
            const subsection = group.subsections[subIndex];
            const sectionKey = `${groupIndex}-${subIndex}`;

            // Skip hidden subsections
            if (activeHiddenSections.has(sectionKey)) continue;

            const printableRows = subsection.rows.filter(isPrintableRow);
            if (printableRows.length === 0) continue;

            const timeSummary = summarizeSectionTime(printableRows, subsection.sectionKind);

            const isSingleConnection = subsection.sectionKind === "single_connections" || subsection.sectionKind === "default";

            const rowCompletions: WireRowCompletion[] = printableRows.map(row => ({
                rowId: row.__rowId,
                fromDeviceId: row.fromDeviceId || "",
                toDeviceId: row.toDeviceId || "",
                wireId: row.wireId || "",
                deviceGroup: isSingleConnection ? extractDeviceGroup(row.fromDeviceId || row.toDeviceId || "") : undefined,
                fromCompletedAt: null,
                toCompletedAt: null,
                fromCompletedBy: null,
                toCompletedBy: null,
            }));

            sections.push({
                sectionId: sectionKey,
                locationKey,
                location: group.location,
                sectionLabel: subsection.label,
                sectionKind: subsection.sectionKind,
                status: sections.length === 0 ? "active" : "locked",
                startedAt: null,
                completedAt: null,
                completedBy: null,
                estimatedMinutes: Math.round(timeSummary.grandTotal),
                actualMinutes: null,
                totalRows: printableRows.length,
                completedRows: 0,
                rows: rowCompletions,
            });
        }
    }

    const totalEstimated = sections.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    return {
        id: generateId(),
        projectId,
        sheetName,
        sheetSlug,
        swsType,
        badge,
        shift,
        status: "idle",
        startedAt: new Date().toISOString(),
        completedAt: null,
        pausedAt: null,
        sections,
        activeSectionIndex: 0,
        totalEstimatedMinutes: totalEstimated,
        totalActualMinutes: null,
    };
}
