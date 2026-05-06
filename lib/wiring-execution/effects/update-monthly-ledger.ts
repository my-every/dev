/**
 * Update Monthly Ledger Effect
 *
 * On session completion, updates the user's assignments.json with monthly wire completion stats.
 * Creates the file if it doesn't exist yet.
 */

import { registerWiringEffect, type WiringEffectContext } from "../effects";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";

function getMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function resolveUserDir(shift: string, badge: string): string {
    const shiftFolder = shift === "2nd-shift" ? "2nd-shift" : "1st-shift";
    return path.join(resolveShareDirectorySync(), "users", shiftFolder, badge);
}

interface LedgerFile {
    schemaVersion: 1;
    badge: string;
    shift: string;
    lastUpdatedAt: string;
    months: Record<string, {
        month: string;
        counters: {
            completedAssignments: number;
            totalWorkedMinutes: number;
            totalWiresCompleted: number;
            totalSectionsCompleted: number;
        };
        wiringSessions: Array<{
            sessionId: string;
            projectId: string;
            sheetName: string;
            completedAt: string;
            totalRows: number;
            totalEstimatedMinutes: number;
            totalActualMinutes: number;
            sectionCount: number;
        }>;
    }>;
}

async function execute(ctx: WiringEffectContext): Promise<void> {
    const userDir = resolveUserDir(ctx.shift, ctx.badge);
    const ledgerPath = path.join(userDir, "assignments.json");

    let ledger: LedgerFile;
    try {
        const raw = await fs.readFile(ledgerPath, "utf-8");
        ledger = JSON.parse(raw);
    } catch {
        ledger = {
            schemaVersion: 1,
            badge: ctx.badge,
            shift: ctx.shift,
            lastUpdatedAt: new Date().toISOString(),
            months: {},
        };
    }

    const monthKey = getMonthKey();
    if (!ledger.months[monthKey]) {
        ledger.months[monthKey] = {
            month: monthKey,
            counters: {
                completedAssignments: 0,
                totalWorkedMinutes: 0,
                totalWiresCompleted: 0,
                totalSectionsCompleted: 0,
            },
            wiringSessions: [],
        };
    }

    const bucket = ledger.months[monthKey];
    const totalRows = ctx.session.sections.reduce((s, sec) => s + sec.totalRows, 0);

    bucket.counters.completedAssignments += 1;
    bucket.counters.totalWorkedMinutes += ctx.session.totalActualMinutes ?? 0;
    bucket.counters.totalWiresCompleted += totalRows;
    bucket.counters.totalSectionsCompleted += ctx.session.sections.length;

    bucket.wiringSessions.push({
        sessionId: ctx.session.id,
        projectId: ctx.projectId,
        sheetName: ctx.session.sheetName,
        completedAt: ctx.session.completedAt ?? new Date().toISOString(),
        totalRows,
        totalEstimatedMinutes: ctx.session.totalEstimatedMinutes,
        totalActualMinutes: ctx.session.totalActualMinutes ?? 0,
        sectionCount: ctx.session.sections.length,
    });

    ledger.lastUpdatedAt = new Date().toISOString();

    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2), "utf-8");
}

registerWiringEffect({
    id: "update-monthly-ledger",
    trigger: "session-complete",
    label: "Update user monthly wire completion ledger",
    execute,
});
