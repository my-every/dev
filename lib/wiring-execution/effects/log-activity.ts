/**
 * Log Activity Effect
 *
 * Writes an activity entry to the user's activity.json on section/session completion.
 */

import { registerWiringEffect, type WiringEffectContext } from "../effects";

async function logSectionComplete(ctx: WiringEffectContext): Promise<void> {
    if (!ctx.section) return;

    await fetch(`/api/activity/${ctx.badge}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            shift: ctx.shift,
            action: "STAGE_CHANGED",
            performedBy: ctx.badge,
            projectId: ctx.projectId,
            stage: "WIRING",
            metadata: {
                type: "wiring_section_complete",
                sectionId: ctx.section.sectionId,
                sectionLabel: ctx.section.sectionLabel,
                location: ctx.section.location,
                estimatedMinutes: ctx.section.estimatedMinutes,
                actualMinutes: ctx.section.actualMinutes,
                totalRows: ctx.section.totalRows,
                sheetName: ctx.session.sheetName,
            },
            comment: `Completed wiring section: ${ctx.section.location} — ${ctx.section.sectionLabel} (${ctx.section.totalRows} wires)`,
        }),
    });
}

async function logSessionComplete(ctx: WiringEffectContext): Promise<void> {
    await fetch(`/api/activity/${ctx.badge}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            shift: ctx.shift,
            action: "COMPLETED",
            performedBy: ctx.badge,
            projectId: ctx.projectId,
            stage: "WIRING",
            metadata: {
                type: "wiring_session_complete",
                sessionId: ctx.session.id,
                sheetName: ctx.session.sheetName,
                totalEstimatedMinutes: ctx.session.totalEstimatedMinutes,
                totalActualMinutes: ctx.session.totalActualMinutes,
                sectionCount: ctx.session.sections.length,
                totalRows: ctx.session.sections.reduce((s, sec) => s + sec.totalRows, 0),
            },
            comment: `Completed wiring execution for ${ctx.session.sheetName} — ${ctx.session.sections.length} sections`,
        }),
    });
}

registerWiringEffect({
    id: "log-activity-section",
    trigger: "section-complete",
    label: "Log section completion to user activity",
    execute: logSectionComplete,
});

registerWiringEffect({
    id: "log-activity-session",
    trigger: "session-complete",
    label: "Log session completion to user activity",
    execute: logSessionComplete,
});
