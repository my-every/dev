import XLSX from "xlsx-js-style";

import type { BrandListExportSchema } from "@/lib/wire-brand-list/schema";

const METADATA_SHEET_NAME = "__BRANDLIST_META__";

export function appendBrandWorkbookSupportSheets(
  workbook: XLSX.WorkBook,
  schemas: BrandListExportSchema[],
) {
  if (!schemas.length) {
    return workbook;
  }

  appendBundleTagInfoSheet(workbook, schemas);
  appendBundleTagsSheet(workbook, schemas);
  appendMetadataSheet(workbook, schemas);
  return workbook;
}

function appendBundleTagInfoSheet(workbook: XLSX.WorkBook, schemas: BrandListExportSchema[]) {
  const maxBundles = Math.max(
    1,
    ...schemas.map((schema) => getBundleTagLabels(schema).length),
  );

  const rows: Array<Array<string>> = [
    [schemas[0]?.projectInfo.projectName ?? ""],
    [schemas[0]?.projectInfo.projectNumber ?? ""],
    [schemas[0]?.projectInfo.revision ?? ""],
    [],
    [],
    schemas.map((schema) => schema.sheetName),
  ];

  for (let index = 0; index < maxBundles; index += 1) {
    rows.push(
      schemas.map((schema) => getBundleTagLabels(schema)[index] ?? ""),
    );
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = schemas.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bundle Tag Info");
}

function appendBundleTagsSheet(workbook: XLSX.WorkBook, schemas: BrandListExportSchema[]) {
  const maxBundles = Math.max(
    1,
    ...schemas.map((schema) => getBundleTagLabels(schema).length),
  );
  const rows: Array<Array<string>> = [
    schemas.map((schema) => schema.sheetName),
  ];

  for (let index = 0; index < maxBundles; index += 1) {
    rows.push(
      schemas.map((schema) => {
        const bundleLabel = getBundleTagLabels(schema)[index];
        if (!bundleLabel) {
          return "";
        }

        return [
          schema.projectInfo.projectName ?? "",
          `${schema.projectInfo.projectNumber ?? ""} ${schema.projectInfo.revision ?? ""}`.trim(),
          schema.sheetName,
          bundleLabel,
        ].filter(Boolean).join("\n");
      }),
    );
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = schemas.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bundle Tags2");
}

function appendMetadataSheet(workbook: XLSX.WorkBook, schemas: BrandListExportSchema[]) {
  const rows: Array<Array<string>> = [
    ["sheetName", "sheetSlug", "schemaHash", "normalizedSheetName", "bundleNames", "bundleDisplays"],
    ...schemas.map((schema) => [
      schema.sheetName,
      schema.sheetSlug,
      schema.schemaHash ?? "",
      schema.importHints.normalizedSheetName,
      schema.importHints.bundleNames.join("||"),
      schema.importHints.bundleDisplays.join("||"),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 68 }, { wch: 24 }, { wch: 48 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, METADATA_SHEET_NAME);

  const lastIndex = workbook.SheetNames.length - 1;
  workbook.Workbook = workbook.Workbook ?? { Sheets: [] };
  workbook.Workbook.Sheets = workbook.Workbook.Sheets ?? workbook.SheetNames.map((name) => ({ name }));
  if (!workbook.Workbook.Sheets[lastIndex]) {
    workbook.Workbook.Sheets[lastIndex] = { name: METADATA_SHEET_NAME };
  }
  workbook.Workbook.Sheets[lastIndex] = {
    ...workbook.Workbook.Sheets[lastIndex],
    name: METADATA_SHEET_NAME,
    Hidden: 1,
  };
}

function getBundleTagLabels(schema: BrandListExportSchema) {
  const sectionLabels = schema.prefixGroups.flatMap((group) =>
    group.bundles.map((bundle) => {
      const displayLabel = bundle.rows.find((row) => row.bundleDisplay.trim())?.bundleDisplay.trim();
      return displayLabel || bundle.bundleName.trim();
    }),
  ).filter(Boolean);

  if (sectionLabels.length) {
    return sectionLabels;
  }

  const displayLabels = uniqueNonEmpty(schema.importHints.bundleDisplays);
  return displayLabels.length ? displayLabels : uniqueNonEmpty(schema.importHints.bundleNames);
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}
