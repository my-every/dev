import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
    readProjectManifest,
    readSheetSchema,
    resolveProjectRootDirectory,
    resolveProjectStateDirectory,
} from "@/lib/project-state/share-project-state-handlers";
import { createProjectPartTerminalResolver } from "@/lib/project-state/part-terminal-schema";
import {
    saveWireListPrintSchemaToDirectory,
    saveWireBrandListSchemaToDirectory,
} from "@/lib/project-state/share-print-schema-handlers";
import { buildWireListPrintSchema } from "@/lib/wire-list-print/schema";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import { buildBrandListExportSchema } from "@/lib/wire-brand-list/schema";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import {
    createDefaultPrintSettings,
    createDefaultProjectInfo,
} from "@/lib/wire-list-print/defaults";

export interface GeneratePrintSchemasResult {
    projectId: string;
    generatedAt: string;
    sheets: Array<{
        sheetSlug: string;
        sheetName: string;
        wireListPrintSchema: boolean;
        wireBrandListSchema: boolean;
    }>;
    skippedSheets: Array<{
        sheetSlug: string;
        sheetName: string;
        reason: string;
    }>;
}

function buildIpvIdentityFilterReferences(
    schema: ReturnType<typeof buildWireListPrintSchema>,
): Array<{
    title: string;
    sectionKind?: string;
    rowCount: number;
    rows: Array<{
        fromDeviceId: string;
        toDeviceId: string;
        wireNo: string;
        wireId: string;
        gaugeSize: string;
        location: string;
    }>;
}> {
    const wireListPage = schema.pages.find((page) => page.pageType === "wire-list");
    if (!wireListPage) {
        return [];
    }

    const referencesBySection = new Map<string, {
        title: string;
        sectionKind?: string;
        rowCount: number;
        rows: Array<{
            fromDeviceId: string;
            toDeviceId: string;
            wireNo: string;
            wireId: string;
            gaugeSize: string;
            location: string;
        }>;
    }>();

    for (const locationGroup of wireListPage.locationGroups) {
        for (const subsection of locationGroup.subsections) {
            const printableRows = subsection.rows.filter((row) => {
                const from = String(row.fromDeviceId ?? "").trim();
                const to = String(row.toDeviceId ?? "").trim();
                return from.length > 0 || to.length > 0;
            });

            if (printableRows.length === 0) {
                continue;
            }

            const sectionKey = `${subsection.sectionKind ?? "unknown"}:${subsection.label}`;
            const existing = referencesBySection.get(sectionKey);
            const mappedRows = printableRows.map((row) => ({
                    fromDeviceId: row.fromDeviceId,
                    toDeviceId: row.toDeviceId,
                    wireNo: row.wireNo,
                    wireId: row.wireId,
                    gaugeSize: row.gaugeSize,
                    location: row.toLocation || row.fromLocation || "",
                }));

            if (existing) {
                existing.rows.push(...mappedRows);
                existing.rowCount = existing.rows.length;
            } else {
                referencesBySection.set(sectionKey, {
                    title: subsection.label,
                    sectionKind: subsection.sectionKind,
                    rowCount: mappedRows.length,
                    rows: mappedRows,
                });
            }
        }
    }

    return Array.from(referencesBySection.values());
}

function formatReferenceValuesWithQty(values?: string[] | null): string[] {
    if (!values || values.length === 0) {
        return [];
    }

    const counts = new Map<string, number>();
    const order: string[] = [];

    for (const rawValue of values) {
        const value = String(rawValue ?? "").trim();
        if (!value) continue;

        if (!counts.has(value)) {
            counts.set(value, 1);
            order.push(value);
        } else {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
    }

    return order.map((value) => {
        const qty = counts.get(value) ?? 0;
        return qty > 1 ? `${value} x${qty}` : value;
    });
}

/**
 * Generate wire-list-print-schema (standardize mode) and wire-brand-list schema
 * (branding mode) for every operational sheet in the project.
 *
 * Reads rows from the persisted sheet schemas, applies any row patches,
 * builds print schemas in both modes, and saves them to the state directory.
 */
export async function generateAllPrintSchemas(
    projectId: string,
): Promise<GeneratePrintSchemasResult> {
    const manifest = await readProjectManifest(projectId);
    if (!manifest) {
        throw new Error("Project not found");
    }

    const projectInfo = createDefaultProjectInfo({
        projectNumber: manifest.pdNumber,
        projectName: manifest.name,
        revision: manifest.revision,
        pdNumber: manifest.pdNumber,
        unitNumber: manifest.unitNumber,
    });

    const result: GeneratePrintSchemasResult = {
        projectId,
        generatedAt: new Date().toISOString(),
        sheets: [],
        skippedSheets: [],
    };

    const stateDirectory = await resolveProjectStateDirectory(projectId);
    if (!stateDirectory) {
        throw new Error(`Project state directory not found for project: ${projectId}`);
    }
    const printSchemaDirectory = path.join(stateDirectory, "wire-list-print-schema");
    const brandListDirectory = path.join(stateDirectory, "wire-brand-list");
    const ipvDirectory = path.join(stateDirectory, "ipv");
    await fs.mkdir(ipvDirectory, { recursive: true });

    const operationalSheets = manifest.sheets.filter(
        (sheet) => sheet.kind === "operational",
    );
    const projectRoot = await resolveProjectRootDirectory(projectId, {
        pdNumber: manifest.pdNumber,
        projectName: manifest.name,
    });
    const terminalResolver = projectRoot ? await createProjectPartTerminalResolver(projectRoot) : null;

    for (const sheet of operationalSheets) {
        const assignmentNode = manifest.assignments?.[sheet.slug];
        const schema = await readSheetSchema(projectId, sheet.slug);
        if (!schema) {
            result.skippedSheets.push({
                sheetSlug: sheet.slug,
                sheetName: sheet.name,
                reason: "Sheet schema not found",
            });
            continue;
        }

        const semanticRows = schema.rows ?? [];
        if (semanticRows.length === 0) {
            result.skippedSheets.push({
                sheetSlug: sheet.slug,
                sheetName: sheet.name,
                reason: "No rows in sheet schema",
            });
            continue;
        }

        const defaultSettings = createDefaultPrintSettings();

        let savedStandardize = false;
        let savedBranding = false;

        // Generate wire-list-print-schema (standardize mode)
        try {
            const standardizeDocument = await buildProjectSheetPrintDocument({
                projectId,
                sheetSlug: sheet.slug,
                settings: {
                    ...defaultSettings,
                    mode: "standardize",
                },
            });

            if (!standardizeDocument) {
                throw new Error("Unable to build print document");
            }

            const standardizeSchema = buildWireListPrintSchema({
                currentSheetName: schema.name,
                sheetDocument: standardizeDocument.sheetDocument,
                visibleSections: standardizeDocument.sheetDocument?.wireListSections,
                totalPagesOverride: standardizeDocument.previewPageCount,
                settings: { ...defaultSettings, mode: "standardize" },
                projectInfo,
                sheetTitle: schema.name,
                hiddenSections: new Set(standardizeDocument.hiddenSectionKeys ?? []),
                getLengthForRow: (rowId) => standardizeDocument.rowLengthsById?.[rowId] ?? null,
                locationBoxSideByName: standardizeDocument.locationBoxSideByName,
                locationNormalizedTitleByName: standardizeDocument.locationNormalizedTitleByName,
                assignmentBlueLabels: assignmentNode?.blueLabels ?? [],
            });
            standardizeSchema.sheetName = normalizeDisplayTitle(standardizeSchema.sheetName);
            await saveWireListPrintSchemaToDirectory(printSchemaDirectory, sheet.slug, standardizeSchema);
            const identityFilterReferences = buildIpvIdentityFilterReferences(standardizeSchema);
            const panductReferences = formatReferenceValuesWithQty(assignmentNode?.panducts ?? []);
            const railReferences = formatReferenceValuesWithQty(assignmentNode?.rails ?? []);

            // Persist IPV checklist as a dedicated schema artifact for manifest/file consumers.
            const ipvPayload = {
                generatedAt: standardizeSchema.generatedAt,
                sheetSlug: sheet.slug,
                sheetName: standardizeSchema.sheetName,
                totalRows: standardizeSchema.ipvChecklist?.totalRows ?? 0,
                references: {
                    assignmentName: assignmentNode?.sheetName ?? sheet.name,
                    whiteLabels: assignmentNode?.whiteLabels ?? [],
                    blueLabels: assignmentNode?.blueLabels ?? [],
                    heatShrinkLabels: assignmentNode?.heatShrinkLabels ?? [],
                    partNumbers: assignmentNode?.partNumbers ?? [],
                    panducts: panductReferences,
                    rails: railReferences,
                    identityFilters: identityFilterReferences,
                },
                groups: standardizeSchema.ipvChecklist?.groups ?? [],
            };
            await fs.writeFile(
                path.join(ipvDirectory, `${encodeURIComponent(sheet.slug)}-ipv.json`),
                JSON.stringify(ipvPayload, null, 2),
                "utf-8",
            );

            savedStandardize = true;
        } catch (err) {
            console.error(
                `Failed to generate wire-list-print-schema for sheet ${sheet.slug}:`,
                err,
            );
        }

        // Generate wire-brand-list schema (branding mode)
        try {
            const brandingDocument = await buildProjectSheetPrintDocument({
                projectId,
                sheetSlug: sheet.slug,
                settings: {
                    mode: "branding",
                    showCoverPage: false,
                    showTableOfContents: false,
                    showIPVCodes: false,
                },
            });

            if (!brandingDocument) {
                throw new Error("Unable to build branding document");
            }
            if (!brandingDocument.sheetDocument) {
                throw new Error("Branding document missing shared sheet document");
            }

            const brandingSchema = buildBrandListExportSchema({
                sheetSlug: sheet.slug,
                sheetName: schema.name,
                brandingVisibleSections: brandingDocument.sheetDocument.brandingSections,
                sectionColumnVisibility: brandingDocument.settings.sectionColumnVisibility,
                brandingSortMode: brandingDocument.settings.brandingSortMode,
                projectInfo: {
                    projectNumber: manifest.pdNumber,
                    projectName: manifest.name,
                    revision: manifest.revision,
                    controlsDE: schema.metadata?.controlsDE,
                    controlsME: schema.metadata?.controlsME,
                },
                resolveTerminalMetadata: terminalResolver
                    ? ({ fromDeviceId, toDeviceId, wireNo, wireId }) => {
                        const metadata = terminalResolver({ deviceId: fromDeviceId, wireNo, wireId });
                        return {
                            fromTerminal: metadata?.terminal ?? (fromDeviceId?.split(":")[1]?.trim().toUpperCase() || undefined),
                            fromTerminalSide: metadata?.side,
                            fromTerminalTier: metadata?.tier,
                            fromTerminalOrder: metadata?.order ?? null,
                            toTerminal: toDeviceId?.split(":")[1]?.trim().toUpperCase() || undefined,
                            isNegative: metadata?.isNegative,
                            terminalHardware: metadata?.hardware,
                            terminalInstructions: metadata?.instructions,
                        };
                    }
                    : undefined,
            });
            brandingSchema.sheetName = normalizeDisplayTitle(brandingSchema.sheetName);
            brandingSchema.header.locationTitle = normalizeDisplayTitle(brandingSchema.header.locationTitle);

            await saveWireBrandListSchemaToDirectory(brandListDirectory, sheet.slug, brandingSchema);
            savedBranding = true;
        } catch (err) {
            console.error(
                `Failed to generate wire-brand-list schema for sheet ${sheet.slug}:`,
                err,
            );
        }

        result.sheets.push({
            sheetSlug: sheet.slug,
            sheetName: sheet.name,
            wireListPrintSchema: savedStandardize,
            wireBrandListSchema: savedBranding,
        });
    }

    return result;
}
