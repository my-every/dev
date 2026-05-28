import "server-only";

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

    const operationalSheets = manifest.sheets.filter(
        (sheet) => sheet.kind === "operational",
    );
    const projectRoot = await resolveProjectRootDirectory(projectId, {
        pdNumber: manifest.pdNumber,
        projectName: manifest.name,
    });
    const terminalResolver = projectRoot ? await createProjectPartTerminalResolver(projectRoot) : null;

    for (const sheet of operationalSheets) {
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
            });
            standardizeSchema.sheetName = normalizeDisplayTitle(standardizeSchema.sheetName);
            await saveWireListPrintSchemaToDirectory(printSchemaDirectory, sheet.slug, standardizeSchema);
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
