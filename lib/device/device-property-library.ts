import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import * as XLSX from "xlsx";
import type { DevicePropertyField, DevicePropertyRecord } from "@/lib/device/device-property-types";

const LIBRARY_PATH = path.join(process.cwd(), "public/library/part-number-libary.csv");

function normalizePartNumber(partNumber: string): string {
  return partNumber.trim().toUpperCase();
}

function buildLookupCandidates(partNumber: string): string[] {
  const normalized = normalizePartNumber(partNumber);
  const parts = normalized
    .split(/[\n,;]/)
    .map(normalizePartNumber)
    .filter(Boolean);

  return Array.from(new Set([normalized, ...parts].filter(Boolean)));
}

function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getColumnIndex(headers: unknown[], aliases: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalizedHeaders.findIndex(header => header === alias);
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

async function readLibraryRows(): Promise<unknown[][]> {
  const buffer = await fs.readFile(LIBRARY_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, dense: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

export const getDevicePropertyLibrary = cache(async (): Promise<Map<string, DevicePropertyRecord>> => {
  const rows = await readLibraryRows();
  if (rows.length === 0) {
    return new Map();
  }

  const [headerRow, ...dataRows] = rows;
  const partNumberIndex = getColumnIndex(headerRow, ["part number", "partnumber"]);
  const descriptionIndex = getColumnIndex(headerRow, ["description"]);
  const categoryIndex = getColumnIndex(headerRow, ["category"]);
  const referenceImageIndex = getColumnIndex(headerRow, ["reference image", "referenceimage"]);
  const iconIndex = getColumnIndex(headerRow, ["icon"]);

  if (partNumberIndex === -1) {
    return new Map();
  }

  const library = new Map<string, DevicePropertyRecord>();

  for (const row of dataRows) {
    const partNumber = normalizePartNumber(String(row[partNumberIndex] ?? ""));
    if (!partNumber) {
      continue;
    }

    library.set(partNumber, {
      partNumber,
      description: String(descriptionIndex === -1 ? "" : row[descriptionIndex] ?? "").trim(),
      category: String(categoryIndex === -1 ? "" : row[categoryIndex] ?? "").trim(),
      referenceImage: String(referenceImageIndex === -1 ? "" : row[referenceImageIndex] ?? "").trim(),
      icon: String(iconIndex === -1 ? "" : row[iconIndex] ?? "").trim(),
    });
  }

  return library;
});

export async function getDevicePropertyRecord(partNumber: string): Promise<DevicePropertyRecord | null> {
  const library = await getDevicePropertyLibrary();
  const candidates = buildLookupCandidates(partNumber);

  for (const candidate of candidates) {
    const record = library.get(candidate);
    if (record) {
      return record;
    }
  }

  return null;
}

export async function getDevicePropertyValue(
  partNumber: string,
  field: DevicePropertyField
): Promise<string | null> {
  const record = await getDevicePropertyRecord(partNumber);
  if (!record) {
    return null;
  }

  return record[field] || null;
}
