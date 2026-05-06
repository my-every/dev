import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { readWireBrandListSchema, saveWireBrandListSchema } from "@/lib/project-state/share-print-schema-handlers";
import { computeBrandListSchemaHash, type BrandListExportSchema, type BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
import {
  buildImportDiffs,
  buildBrandImportMatchKey,
  flattenBrandSchemaRows,
  getPendingDiffCount,
  type ImportedBrandListRow,
  type ImportedBrandSheetData,
  type MultiSheetImportSession,
} from "@/lib/wire-brand-list/multi-sheet-review";
import { normalizeSheetName } from "@/lib/workbook/normalize-sheet-name";

export const dynamic = "force-dynamic";
const IGNORED_IMPORTED_SHEET_SLUGS = new Set([
  "all",
  "panel-errors",
  "bundle-tag-info",
  "bundle-tags",
  "bundle-tags2",
]);

interface ImportSheetMatchCandidate {
  slug: string;
  name: string;
  schema: BrandListExportSchema;
  rowMatchKeys: Set<string>;
  endpointLocationKeys: Set<string>;
  devicePairKeys: Set<string>;
  bundleNames: Set<string>;
  nameTokens: Set<string>;
  looseName: string;
  rowCount: number;
  schemaHash: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const body = await request.json() as
      | {
        action: "prepare" | "hydrate";
        workbookFileName?: string;
        importedSheets?: ImportedBrandSheetData[];
        rowDecisions?: MultiSheetImportSession["rowDecisions"];
      }
      | {
        action: "apply";
        importSession?: MultiSheetImportSession | null;
      };

    if (body.action === "apply") {
      if (!body.importSession) {
        return NextResponse.json({ error: "Missing import session" }, { status: 400 });
      }

      const appliedSheetSlugs = await applyImportSession(projectId, body.importSession);
      return NextResponse.json({
        appliedSheetSlugs,
        importSession: {
          ...body.importSession,
          appliedAt: new Date().toISOString(),
        },
      });
    }

    const manifest = await readProjectManifest(projectId);
    if (!manifest) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const importedSheets = Array.isArray(body.importedSheets) ? body.importedSheets : [];
    const operationalSheets = manifest.sheets.filter((sheet) => sheet.kind === "operational");
    const schemas = await Promise.all(
      operationalSheets.map(async (sheet) => ({
        sheet,
        schema: await readWireBrandListSchema(projectId, sheet.slug),
      })),
    );
    const availableCandidates = schemas
      .filter((entry): entry is { sheet: typeof operationalSheets[number]; schema: BrandListExportSchema } => Boolean(entry.schema))
      .map(({ sheet, schema }) => buildImportSheetMatchCandidate(sheet.slug, sheet.name, schema));
    const sheetLookup = new Map(
      operationalSheets.flatMap((sheet) => ([
        [sheet.slug, { slug: sheet.slug, name: sheet.name }],
        [normalizeSheetName(sheet.name), { slug: sheet.slug, name: sheet.name }],
      ])),
    );

    const matchedSheets: ImportedBrandSheetData[] = [];
    const unmatchedSheetNames: string[] = [];
    const usedSheetSlugs = new Set<string>();

    for (const importedSheet of importedSheets) {
      if (shouldIgnoreImportedSheet(importedSheet)) {
        continue;
      }

      const exactMatch = sheetLookup.get(importedSheet.sheetSlug) ?? sheetLookup.get(normalizeSheetName(importedSheet.sheetName));
      const match = exactMatch && !usedSheetSlugs.has(exactMatch.slug)
        ? exactMatch
        : resolveImportedSheetMatch(importedSheet, availableCandidates, usedSheetSlugs);
      if (!match) {
        unmatchedSheetNames.push(importedSheet.sourceSheetName || importedSheet.sheetName);
        continue;
      }

      usedSheetSlugs.add(match.slug);
      matchedSheets.push({
        ...importedSheet,
        sheetSlug: match.slug,
        sheetName: match.name,
      });
    }

    const schemaLookup = new Map(availableCandidates.map((candidate) => [candidate.slug, candidate.schema]));
    const sheetDiffs = matchedSheets.map((sheet) => {
      const currentSchema = schemaLookup.get(sheet.sheetSlug);
      if (!currentSchema) {
        return null;
      }

      return buildImportDiffs({
        currentSchema,
        importedSheet: sheet,
      });
    });

    const validDiffs = sheetDiffs.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const rowDecisions = body.rowDecisions ?? {};
    const importSession: MultiSheetImportSession = {
      workbookFileName: body.workbookFileName ?? "Imported workbook",
      importedAt: new Date().toISOString(),
      importMode: "length-only",
      matchedSheetSlugs: matchedSheets.map((sheet) => sheet.sheetSlug),
      unmatchedSheetNames,
      activeSheetSlug: matchedSheets[0]?.sheetSlug ?? null,
      completedSheetSlugs: validDiffs
        .filter((sheetDiff) => getPendingDiffCount(sheetDiff, rowDecisions) === 0)
        .map((sheetDiff) => sheetDiff.sheetSlug),
      rowDecisions,
      importedSheets: matchedSheets,
      appliedAt: null,
    };

    return NextResponse.json({
      importSession,
      sheetDiffs: validDiffs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare brand list import review" },
      { status: 500 },
    );
  }
}

async function applyImportSession(projectId: string, importSession: MultiSheetImportSession) {
  const appliedSheetSlugs: string[] = [];

  for (const importedSheet of importSession.importedSheets) {
    const currentSchema = await readWireBrandListSchema(projectId, importedSheet.sheetSlug);
    if (!currentSchema) {
      continue;
    }

    const sheetDiff = buildImportDiffs({ currentSchema, importedSheet });
    const nextSchema = applyImportSheetDiff(
      currentSchema,
      sheetDiff.diffs,
      importSession.rowDecisions,
      importSession.importMode,
    );
    await saveWireBrandListSchema(projectId, importedSheet.sheetSlug, nextSchema);
    appliedSheetSlugs.push(importedSheet.sheetSlug);
  }

  return appliedSheetSlugs;
}

function shouldIgnoreImportedSheet(importedSheet: ImportedBrandSheetData) {
  return IGNORED_IMPORTED_SHEET_SLUGS.has(normalizeSheetName(importedSheet.sourceSheetName || importedSheet.sheetName));
}

function resolveImportedSheetMatch(
  importedSheet: ImportedBrandSheetData,
  candidates: ImportSheetMatchCandidate[],
  usedSheetSlugs: Set<string>,
) {
  const importedProfile = buildImportedSheetProfile(importedSheet);
  let bestCandidate: ImportSheetMatchCandidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (usedSheetSlugs.has(candidate.slug)) {
      continue;
    }

    const score = scoreImportedSheetMatch(importedProfile, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) {
    return null;
  }

  if (!isImportedSheetMatchConfident(importedProfile, bestCandidate, bestScore)) {
    return null;
  }

  return {
    slug: bestCandidate.slug,
    name: bestCandidate.name,
  };
}

function applyImportSheetDiff(
  schema: BrandListExportSchema,
  diffs: ReturnType<typeof buildImportDiffs>["diffs"],
  rowDecisions: MultiSheetImportSession["rowDecisions"],
  importMode: MultiSheetImportSession["importMode"],
) {
  let nextSchema: BrandListExportSchema = structuredClone(schema);

  for (const diff of diffs) {
    const decision = rowDecisions[diff.diffId] ?? (diff.changeType === "unchanged" ? "accept" : "pending");
    if (decision !== "accept") {
      continue;
    }

    if (diff.changeType === "length-changed" && diff.currentRow && diff.importedRow) {
      nextSchema = patchSchemaRow(nextSchema, diff.currentRow.rowId, {
        length: diff.importedRow.length,
      });
      continue;
    }

    if (importMode === "length-only") {
      continue;
    }

    if (diff.changeType === "current-only" && diff.currentRow) {
      nextSchema = removeSchemaRow(nextSchema, diff.currentRow.rowId);
      continue;
    }

    if (diff.changeType === "imported-only" && diff.importedRow) {
      nextSchema = appendImportedRow(nextSchema, diff.importedRow);
    }
  }

  const totalRows = nextSchema.prefixGroups.reduce(
    (sum, group) => sum + group.bundles.reduce((bundleSum, bundle) => bundleSum + bundle.rows.length, 0),
    0,
  );
  const normalized: BrandListExportSchema = {
    ...nextSchema,
    totalRows,
    generatedAt: new Date().toISOString(),
  };

  return {
    ...normalized,
    schemaHash: computeBrandListSchemaHash(normalized),
  };
}

function patchSchemaRow(schema: BrandListExportSchema, rowId: string, patch: Partial<BrandListSchemaRow>) {
  return {
    ...schema,
    prefixGroups: schema.prefixGroups.map((group) => ({
      ...group,
      bundles: group.bundles.map((bundle) => ({
        ...bundle,
        rows: bundle.rows.map((row) => row.rowId === rowId ? { ...row, ...patch } : row),
      })),
    })),
  };
}

function removeSchemaRow(schema: BrandListExportSchema, rowId: string) {
  return {
    ...schema,
    prefixGroups: schema.prefixGroups.map((group) => ({
      ...group,
      bundles: group.bundles
        .map((bundle) => ({
          ...bundle,
          rows: bundle.rows.filter((row) => row.rowId !== rowId),
        }))
        .filter((bundle) => bundle.rows.length > 0),
    })).filter((group) => group.bundles.length > 0),
  };
}

function appendImportedRow(schema: BrandListExportSchema, importedRow: ImportedBrandListRow) {
  const nextSchema = structuredClone(schema);
  let prefixGroup = nextSchema.prefixGroups.find((group) => group.prefix === importedRow.devicePrefix);
  if (!prefixGroup) {
    prefixGroup = { prefix: importedRow.devicePrefix, bundles: [] };
    nextSchema.prefixGroups.push(prefixGroup);
  }

  let bundle = prefixGroup.bundles.find((entry) => entry.bundleName === importedRow.bundleName && entry.toLocation === importedRow.toLocation);
  if (!bundle) {
    bundle = {
      bundleName: importedRow.bundleName,
      toLocation: importedRow.toLocation,
      rows: [],
    };
    prefixGroup.bundles.push(bundle);
  }

  const nextRowIndex = bundle.rows.length + 1;
  bundle.rows.push({
    rowId: `imported-${importedRow.importedRowId}-${Date.now()}`,
    rowIndex: nextRowIndex,
    fromDeviceId: importedRow.fromDeviceId,
    wireNo: importedRow.wireNo,
    wireId: importedRow.wireId,
    gaugeSize: importedRow.gaugeSize,
    length: importedRow.length,
    toDeviceId: importedRow.toDeviceId,
    toLocation: importedRow.toLocation,
    bundleName: importedRow.bundleName,
    bundleDisplay:
      bundle.rows.length === 0
        ? (importedRow.bundleDisplay || importedRow.bundleName)
        : importedRow.bundleDisplay === importedRow.bundleName
          ? ""
          : importedRow.bundleDisplay,
    devicePrefix: importedRow.devicePrefix,
  });

  return nextSchema;
}

function buildImportSheetMatchCandidate(slug: string, name: string, schema: BrandListExportSchema): ImportSheetMatchCandidate {
  const flatRows = flattenBrandSchemaRows(schema);
  return {
    slug,
    name,
    schema,
    rowMatchKeys: new Set(flatRows.map((entry) => entry.matchKey)),
    endpointLocationKeys: new Set(flatRows.map((entry) => buildEndpointLocationKey(entry.row))),
    devicePairKeys: new Set(flatRows.map((entry) => buildDevicePairKey(entry.row))),
    bundleNames: new Set(
      (schema.importHints?.bundleNames?.length
        ? schema.importHints.bundleNames
        : flatRows.map((entry) => entry.row.bundleName))
        .map(normalizeLooseName)
        .filter(Boolean),
    ),
    nameTokens: tokenizeLooseName(name),
    looseName: normalizeLooseName(name),
    rowCount: schema.totalRows,
    schemaHash: schema.schemaHash ?? null,
  };
}

function buildImportedSheetProfile(importedSheet: ImportedBrandSheetData) {
  const rowMatchKeys = new Set(importedSheet.rows.map((row) => row.matchKey || buildBrandImportMatchKey(row)));
  const endpointLocationKeys = new Set(importedSheet.rows.map((row) => buildEndpointLocationKey(row)));
  const devicePairKeys = new Set(importedSheet.rows.map((row) => buildDevicePairKey(row)));
  const bundleNames = new Set(
    (importedSheet.metadata?.bundleNames?.length
      ? importedSheet.metadata.bundleNames
      : importedSheet.rows.map((row) => row.bundleName))
      .map(normalizeLooseName)
      .filter(Boolean),
  );
  const dominantLocations = buildFrequencyList(importedSheet.rows.map((row) => row.toLocation));
  const sheetNameVariants = [
    importedSheet.sheetSlug,
    importedSheet.sheetName,
    importedSheet.sourceSheetName,
    ...dominantLocations.slice(0, 2).map((entry) => entry.value),
  ].filter(Boolean);
  const looseNames = sheetNameVariants.map(normalizeLooseName).filter(Boolean);
  const nameTokens = new Set(looseNames.flatMap((value) => Array.from(tokenizeLooseName(value))));

  return {
    importedSheet,
    rowMatchKeys,
    endpointLocationKeys,
    devicePairKeys,
    dominantLocations,
    looseNames,
    nameTokens,
    bundleNames,
    rowCount: importedSheet.rows.length,
    sourceSheetSlug: importedSheet.metadata?.sourceSheetSlug ?? null,
    sourceSchemaHash: importedSheet.metadata?.sourceSchemaHash ?? null,
  };
}

function scoreImportedSheetMatch(
  importedProfile: ReturnType<typeof buildImportedSheetProfile>,
  candidate: ImportSheetMatchCandidate,
) {
  const exactRowOverlap = getSetOverlapCount(importedProfile.rowMatchKeys, candidate.rowMatchKeys);
  const endpointLocationOverlap = getSetOverlapCount(importedProfile.endpointLocationKeys, candidate.endpointLocationKeys);
  const devicePairOverlap = getSetOverlapCount(importedProfile.devicePairKeys, candidate.devicePairKeys);
  const bundleNameOverlap = getSetOverlapCount(importedProfile.bundleNames, candidate.bundleNames);
  const nameTokenOverlap = getSetOverlapCount(importedProfile.nameTokens, candidate.nameTokens);
  const dominantLocationMatch = importedProfile.dominantLocations.find(
    (entry) => normalizeLooseName(entry.value) === candidate.looseName,
  );
  const rowCountDelta = Math.abs(importedProfile.rowCount - candidate.rowCount);

  let score = 0;
  if (importedProfile.sourceSheetSlug && importedProfile.sourceSheetSlug === candidate.slug) {
    score += 500;
  }
  if (importedProfile.sourceSchemaHash && candidate.schemaHash && importedProfile.sourceSchemaHash === candidate.schemaHash) {
    score += 500;
  }
  score += exactRowOverlap * 20;
  score += endpointLocationOverlap * 8;
  score += devicePairOverlap * 3;
  score += bundleNameOverlap * 10;
  score += nameTokenOverlap * 4;

  if (dominantLocationMatch) {
    score += 30 + dominantLocationMatch.count;
  }

  if (importedProfile.looseNames.some((value) => value === candidate.looseName)) {
    score += 25;
  }

  if (importedProfile.looseNames.some((value) => value && candidate.looseName.includes(value))) {
    score += 12;
  }

  if (rowCountDelta === 0) {
    score += 6;
  } else if (rowCountDelta <= 2) {
    score += 3;
  }

  return score;
}

function isImportedSheetMatchConfident(
  importedProfile: ReturnType<typeof buildImportedSheetProfile>,
  candidate: ImportSheetMatchCandidate,
  score: number,
) {
  const exactRowOverlap = getSetOverlapCount(importedProfile.rowMatchKeys, candidate.rowMatchKeys);
  const endpointLocationOverlap = getSetOverlapCount(importedProfile.endpointLocationKeys, candidate.endpointLocationKeys);
  const devicePairOverlap = getSetOverlapCount(importedProfile.devicePairKeys, candidate.devicePairKeys);
  const bundleNameOverlap = getSetOverlapCount(importedProfile.bundleNames, candidate.bundleNames);
  const importedRows = Math.max(importedProfile.rowCount, 1);

  if (importedProfile.sourceSheetSlug && importedProfile.sourceSheetSlug === candidate.slug) {
    return true;
  }

  if (importedProfile.sourceSchemaHash && candidate.schemaHash && importedProfile.sourceSchemaHash === candidate.schemaHash) {
    return true;
  }

  if (score >= 60) {
    return true;
  }

  if (exactRowOverlap >= Math.min(3, importedRows)) {
    return true;
  }

  if (exactRowOverlap >= 1 && importedRows <= 3) {
    return true;
  }

  if (endpointLocationOverlap >= Math.max(2, Math.ceil(importedRows * 0.35))) {
    return true;
  }

  if (endpointLocationOverlap >= 1 && devicePairOverlap >= 1 && importedRows <= 4) {
    return true;
  }

  if (bundleNameOverlap >= Math.max(2, Math.ceil(importedRows * 0.2))) {
    return true;
  }

  return false;
}

function buildEndpointLocationKey(values: {
  fromDeviceId?: string | null;
  toDeviceId?: string | null;
  toLocation?: string | null;
}) {
  return [
    normalizeKeyField(values.fromDeviceId),
    normalizeKeyField(values.toDeviceId),
    normalizeKeyField(values.toLocation),
  ].join("|");
}

function buildDevicePairKey(values: {
  fromDeviceId?: string | null;
  toDeviceId?: string | null;
}) {
  return [
    normalizeKeyField(values.fromDeviceId),
    normalizeKeyField(values.toDeviceId),
  ].join("|");
}

function normalizeKeyField(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeLooseName(value: string | null | undefined) {
  return (value ?? "")
    .replace(/_S$/i, "")
    .replace(/^\([^)]*\)\s*/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function tokenizeLooseName(value: string | null | undefined) {
  return new Set(
    normalizeLooseName(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 1),
  );
}

function getSetOverlapCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

function buildFrequencyList(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = (value ?? "").trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count);
}
