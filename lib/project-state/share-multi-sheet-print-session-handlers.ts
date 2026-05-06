import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";
import type { MultiSheetPrintExportResult } from "@/lib/project-exports/multi-sheet-print-exports";
import type {
  MultiSheetImportSession,
  MultiSheetReviewEntryMode,
} from "@/lib/wire-brand-list/multi-sheet-review";

const MULTI_SHEET_PRINT_SESSION_FILE = "multi-sheet-print-session.json";

export interface MultiSheetPrintSessionDocument {
  projectId: string;
  updatedAt: string;
  activeSheetSlug: string | null;
  approvedSheetSlugs: string[];
  editedAfterApprovalSheetSlugs: string[];
  sheetReviews: Record<string, MultiSheetPrintSheetReview>;
  lastCombinedExportResult: MultiSheetPrintExportResult | null;
  entryMode: MultiSheetReviewEntryMode;
  importSession: MultiSheetImportSession | null;
}

export interface MultiSheetPrintSheetReview {
  sheetSlug: string;
  reviewedAt: string;
  reviewedByBadge: string | null;
  reviewedByName: string | null;
  approvedSchemaHash: string | null;
}

async function resolveSessionFilePath(projectId: string): Promise<string | null> {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return null;
  }

  await fs.mkdir(stateDirectory, { recursive: true });
  return path.join(stateDirectory, MULTI_SHEET_PRINT_SESSION_FILE);
}

export async function readMultiSheetPrintSession(
  projectId: string,
): Promise<MultiSheetPrintSessionDocument | null> {
  const filePath = await resolveSessionFilePath(projectId);
  if (!filePath) {
    return null;
  }

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as MultiSheetPrintSessionDocument;
  } catch {
    return null;
  }
}

export async function writeMultiSheetPrintSession(
  projectId: string,
  session: Omit<MultiSheetPrintSessionDocument, "projectId" | "updatedAt">,
): Promise<MultiSheetPrintSessionDocument> {
  const filePath = await resolveSessionFilePath(projectId);
  if (!filePath) {
    throw new Error("Project state directory not found");
  }

  const nextDocument: MultiSheetPrintSessionDocument = {
    projectId,
    updatedAt: new Date().toISOString(),
    activeSheetSlug: session.activeSheetSlug ?? null,
    approvedSheetSlugs: Array.from(new Set(session.approvedSheetSlugs ?? [])),
    editedAfterApprovalSheetSlugs: Array.from(new Set(session.editedAfterApprovalSheetSlugs ?? [])),
    sheetReviews: sanitizeSheetReviews(session.sheetReviews),
    lastCombinedExportResult: session.lastCombinedExportResult ?? null,
    entryMode: session.entryMode === "import-review" || session.entryMode === "review" ? session.entryMode : "cover",
    importSession: sanitizeImportSession(session.importSession),
  };

  await fs.writeFile(filePath, JSON.stringify(nextDocument, null, 2), "utf-8");
  return nextDocument;
}

function sanitizeImportSession(value: MultiSheetPrintSessionDocument["importSession"] | undefined): MultiSheetImportSession | null {
  if (!value || typeof value !== "object" || typeof value.workbookFileName !== "string") {
    return null;
  }

  return {
    workbookFileName: value.workbookFileName,
    importedAt: typeof value.importedAt === "string" ? value.importedAt : new Date().toISOString(),
    importMode: value.importMode === "full" ? "full" : "length-only",
    matchedSheetSlugs: Array.isArray(value.matchedSheetSlugs)
      ? value.matchedSheetSlugs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    unmatchedSheetNames: Array.isArray(value.unmatchedSheetNames)
      ? value.unmatchedSheetNames.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    activeSheetSlug: typeof value.activeSheetSlug === "string" ? value.activeSheetSlug : null,
    completedSheetSlugs: Array.isArray(value.completedSheetSlugs)
      ? value.completedSheetSlugs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    rowDecisions: value.rowDecisions && typeof value.rowDecisions === "object"
      ? Object.fromEntries(
        Object.entries(value.rowDecisions).filter(([, decision]) => decision === "pending" || decision === "accept" || decision === "reject"),
      )
      : {},
    importedSheets: Array.isArray(value.importedSheets)
      ? value.importedSheets.flatMap((sheet) => {
        if (!sheet || typeof sheet !== "object" || typeof sheet.sheetSlug !== "string" || typeof sheet.sheetName !== "string" || !Array.isArray(sheet.rows)) {
          return [];
        }

        return [{
          sheetSlug: sheet.sheetSlug,
          sheetName: sheet.sheetName,
          sourceSheetName: typeof sheet.sourceSheetName === "string" ? sheet.sourceSheetName : sheet.sheetName,
          metadata: sheet.metadata && typeof sheet.metadata === "object"
            ? {
              sourceSheetSlug: typeof sheet.metadata.sourceSheetSlug === "string" ? sheet.metadata.sourceSheetSlug : null,
              sourceSchemaHash: typeof sheet.metadata.sourceSchemaHash === "string" ? sheet.metadata.sourceSchemaHash : null,
              normalizedSheetName: typeof sheet.metadata.normalizedSheetName === "string" ? sheet.metadata.normalizedSheetName : null,
              bundleNames: Array.isArray(sheet.metadata.bundleNames)
                ? sheet.metadata.bundleNames.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                : [],
            }
            : undefined,
          rows: sheet.rows.filter((row) => row && typeof row === "object" && typeof row.importedRowId === "string" && typeof row.matchKey === "string") as MultiSheetImportSession["importedSheets"][number]["rows"],
        }];
      })
      : [],
    appliedAt: typeof value.appliedAt === "string" ? value.appliedAt : null,
  };
}

function sanitizeSheetReviews(
  value: MultiSheetPrintSessionDocument["sheetReviews"] | undefined,
): Record<string, MultiSheetPrintSheetReview> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value).flatMap(([key, review]) => {
    if (!review || typeof review !== "object" || typeof review.sheetSlug !== "string") {
      return [];
    }

    const sheetSlug = review.sheetSlug.trim() || key.trim();
    if (!sheetSlug) {
      return [];
    }

    return [[
      sheetSlug,
      {
        sheetSlug,
        reviewedAt: typeof review.reviewedAt === "string" ? review.reviewedAt : new Date().toISOString(),
        reviewedByBadge: typeof review.reviewedByBadge === "string" ? review.reviewedByBadge : null,
        reviewedByName: typeof review.reviewedByName === "string" ? review.reviewedByName : null,
        approvedSchemaHash: typeof (review as { approvedSchemaHash?: unknown }).approvedSchemaHash === "string"
          ? (review as { approvedSchemaHash: string }).approvedSchemaHash
          : null,
      },
    ] as const];
  });

  return Object.fromEntries(entries);
}
