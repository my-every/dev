import { notFound } from "next/navigation";

import { WireListPrintDocument } from "@/components/wire-list/print-modal";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { buildPrintPreviewPageCount, buildVisiblePreviewSections } from "@/lib/wire-list-print/model";
import type { WireListPrintDocumentData } from "@/lib/wire-list-sheet-document/types";
import type { PartNumberLookupResult, CablePartNumberLookupResult } from "@/lib/part-number-list";

export const dynamic = "force-dynamic";

export default async function CrossWirePrintPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const manifest = await readProjectManifest(projectId);
  if (!manifest) notFound();

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
        },
      });
      if (!doc) return null;

      const externalGroups = doc.processedLocationGroups.filter((g) => g.isExternal);
      if (externalGroups.length === 0) return null;

      return { doc, externalGroups, unitType, sheetSlug };
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

    // Derive visible sections from the merged external groups so all sections render,
    // not just the first assignment's sections that come from baseDoc.
    const standardVisibleSections = buildVisiblePreviewSections(
      processedLocationGroups,
      new Set(), // no hidden sections — show all in cross-wire context
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
      // Clear hidden sections — external groups are hidden by default in the
      // regular wire list view but must be fully visible in cross-wire context.
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
      },
    });
  }

  if (combinedDocs.length === 0) notFound();

  return (
    <main className="min-h-screen bg-white px-6 py-8 print:p-0 print:bg-white">
      <div className="print-content mx-auto max-w-215 space-y-8">
        {combinedDocs.map((doc, i) => (
          <WireListPrintDocument key={i} data={doc} />
        ))}
      </div>
    </main>
  );
}
