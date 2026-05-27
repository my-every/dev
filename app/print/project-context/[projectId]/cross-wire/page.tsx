import { notFound } from "next/navigation";
import { Suspense } from "react";

import { WireListPrintDocument } from "@/components/wire-list/print-modal";
import { PrintPreviewWrapper } from "@/components/print/print-preview-wrapper";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { buildPrintPreviewPageCount, buildVisiblePreviewSections } from "@/lib/wire-list-print/model";
import type { WireListPrintDocumentData } from "@/lib/wire-list-sheet-document/types";
import type { PartNumberLookupResult, CablePartNumberLookupResult } from "@/lib/part-number-list";

export const dynamic = "force-dynamic";

export default async function CrossWirePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ swapLocations?: string; swapSheets?: string; print?: string }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const swapAllLocations =
    resolvedSearchParams.swapLocations === "1"
    || resolvedSearchParams.swapLocations === "true";
  const swapSheets = new Set(
    String(resolvedSearchParams.swapSheets ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  const manifest = await readProjectManifest(projectId);
  if (!manifest) notFound();

  const normalizeLocationKey = (value: string) =>
    (value ?? "")
      .trim()
      .toUpperCase()
      .replace(/^JB\d+\s+/i, "")
      .replace(/\s+/g, " ");

  const assignmentVisibilityBySlug = new Map<string, Map<string, boolean>>();
  for (const [slug, assignment] of Object.entries(manifest.assignments ?? {})) {
    const visibility = new Map<string, boolean>();
    for (const location of assignment.externalLocations ?? []) {
      const key = normalizeLocationKey(String(location.location ?? ""));
      if (!key) continue;
      // Use crossWireVisible if explicitly set, otherwise fall back to wireListVisible
      const crossWireVisible = (location as { crossWireVisible?: boolean }).crossWireVisible;
      visibility.set(key, crossWireVisible ?? location.wireListVisible ?? true);
    }
    assignmentVisibilityBySlug.set(slug, visibility);
  }

  // Get all operational assignments with their unitType from the manifest
  const operationalSlugs = manifest.sheets
    .filter((s) => s.kind === "operational")
    .map((s) => ({
      sheetSlug: s.slug,
      unitType: (manifest.assignments?.[s.slug]?.unitType as string | undefined)?.trim() || null,
    }));

  if (operationalSlugs.length === 0) notFound();

  // Build print documents for all assignments in parallel
  const assignmentDocs = await Promise.all(
    operationalSlugs.map(async ({ sheetSlug, unitType }) => {
      const doc = await buildProjectSheetPrintDocument({
        projectId,
        sheetSlug,
        settings: {
          showCoverPage: false,
          showTableOfContents: true,
          showFeedbackSection: false,
          showIPVCodes: false,
          showComments: false,
        },
      });
      if (!doc) return null;

      const locationVisibility = assignmentVisibilityBySlug.get(sheetSlug);
      const externalGroups = doc.processedLocationGroups.filter((g) => {
        if (!g.isExternal) return false;
        if (!locationVisibility || locationVisibility.size === 0) return true;

        const rawKey = normalizeLocationKey(g.location);
        const displayKey = normalizeLocationKey(g.displayLocation ?? "");

        if (locationVisibility.has(rawKey)) {
          return locationVisibility.get(rawKey) !== false;
        }
        if (locationVisibility.has(displayKey)) {
          return locationVisibility.get(displayKey) !== false;
        }
        return true;
      });
      if (externalGroups.length === 0) return null;

      const shouldSwapLocations = swapAllLocations || swapSheets.has(sheetSlug);
      const renderedGroups = !shouldSwapLocations
        ? externalGroups
        : externalGroups.map((group) => ({
          ...group,
          subsections: group.subsections.map((subsection) => ({
            ...subsection,
            rows: subsection.rows.map((row) => ({
              ...row,
              fromLocation: row.toLocation || row.fromLocation || row.location || "",
              toLocation: row.fromLocation || row.location || row.toLocation || "",
            })),
          })),
        }));

      return { doc, externalGroups: renderedGroups, unitType, sheetSlug };
    }),
  );

  const validDocs = assignmentDocs.filter(
    (d): d is NonNullable<typeof d> => d !== null,
  );
  if (validDocs.length === 0) notFound();

  // Group assignments by unitType (fall back to sheetSlug for untyped assignments)
  const grouped = new Map<string, typeof validDocs>();
  for (const item of validDocs) {
    const key = item.unitType ?? item.sheetSlug;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Build one merged WireListPrintDocumentData per unit type group
  const combinedDocs: WireListPrintDocumentData[] = [];

  for (const [unitType, items] of grouped) {
    // Merge external location groups by destination location name
    const mergedGroupMap = new Map<
      string,
      NonNullable<typeof items[0]>["externalGroups"][0]
    >();

    for (const { externalGroups } of items) {
      for (const group of externalGroups) {
        const existing = mergedGroupMap.get(group.location);
        if (existing) {
          existing.subsections.push(...group.subsections);
          existing.totalRows += group.totalRows;
        } else {
          mergedGroupMap.set(group.location, {
            ...group,
            subsections: [...group.subsections],
          });
        }
      }
    }

    const processedLocationGroups = Array.from(mergedGroupMap.values());
    if (processedLocationGroups.length === 0) continue;

    const baseDoc = items[0].doc;

    // Derive visible sections from merged groups after applying assignment visibility rules.
    const standardVisibleSections = buildVisiblePreviewSections(
      processedLocationGroups,
      new Set(),
      baseDoc.settings.sectionColumnVisibility ?? {},
    );

    // Merge part number maps across all assignments in this unit type group
    const mergedPartNumbers = new Map<string, PartNumberLookupResult>();
    const mergedCablePartNumbers = new Map<string, CablePartNumberLookupResult>();
    for (const { doc } of items) {
      for (const [k, v] of doc.partNumberEntries ?? []) mergedPartNumbers.set(k, v);
      for (const [k, v] of doc.cablePartNumberEntries ?? []) mergedCablePartNumbers.set(k, v);
    }

    const previewPageCount = buildPrintPreviewPageCount({
      mode: baseDoc.settings.mode,
      processedLocationGroups,
      showFeedbackSection: false,
      showCoverPage: true,
      showTableOfContents: true,
      showIPVCodes: false,
    });

    combinedDocs.push({
      ...baseDoc,
      sheetTitle: `${unitType} — Cross Wire List`,
      currentSheetName: unitType,
      processedLocationGroups,
      standardVisibleSections,
      // Null out sheetDocument — it was built for the source assignment's
      // internal rows and would cause the wrong sections to render.
      sheetDocument: undefined,
      // Clear hidden sections; we already filtered by visibility before merge.
      hiddenSectionKeys: [],
      previewPageCount,
      partNumberEntries: Array.from(mergedPartNumbers.entries()),
      cablePartNumberEntries: Array.from(mergedCablePartNumbers.entries()),
      settings: {
        ...baseDoc.settings,
        showCoverPage: true,
        showTableOfContents: true,
        showFeedbackSection: false,
        showIPVCodes: false,
        showComments: false,
      },
    });
  }

  if (combinedDocs.length === 0) notFound();

  const unitTitle = combinedDocs.length === 1 
    ? combinedDocs[0].currentSheetName 
    : `${combinedDocs.length} Units`;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading print preview...</div>}>
      <PrintPreviewWrapper title={`Cross Wire List — ${unitTitle}`}>
        <main className="bg-neutral-100 px-6 py-8 print:p-0 print:bg-white">
          <div className="print-content mx-auto max-w-215 flex flex-col gap-8 print:gap-0">
            {combinedDocs.map((doc, i) => (
              <WireListPrintDocument key={i} data={doc} />
            ))}
          </div>
        </main>
      </PrintPreviewWrapper>
    </Suspense>
  );
}
