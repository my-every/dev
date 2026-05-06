import * as XLSX from "xlsx";
import type { DevicePropertyField, DevicePropertyRecord } from "@/lib/device/device-property-types";

const LIBRARY_URL = "/library/part-number-libary.csv";
const LIBRARY_FETCH_CACHE_MODE: RequestCache = process.env.NODE_ENV === "development"
  ? "no-store"
  : "force-cache";

let libraryPromise: Promise<Map<string, DevicePropertyRecord>> | null = null;

function normalizePartNumberToken(partNumber: string): string {
  return partNumber.trim().toUpperCase();
}

function normalizeAssetPath(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const unwrapped = raw.replace(/^['\"]+|['\"]+$/g, "").trim();
  if (!unwrapped) {
    return "";
  }

  if (unwrapped.startsWith("/")) {
    return unwrapped;
  }

  if (unwrapped.startsWith("devices/")) {
    return `/${unwrapped}`;
  }

  return unwrapped;
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

function buildLookupCandidates(partNumber: string): string[] {
  const raw = normalizePartNumberToken(partNumber);
  const parts = raw
    .split(/[\n,;]/)
    .map(normalizePartNumberToken)
    .filter(Boolean);

  return Array.from(new Set([raw, ...parts].filter(Boolean)));
}

async function loadLibrary(): Promise<Map<string, DevicePropertyRecord>> {
  const response = await fetch(LIBRARY_URL, { cache: LIBRARY_FETCH_CACHE_MODE });
  if (!response.ok) {
    throw new Error(`Failed to load device property library: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false, dense: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return new Map();
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

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
    const partNumber = normalizePartNumberToken(String(row[partNumberIndex] ?? ""));
    if (!partNumber) {
      continue;
    }

    library.set(partNumber, {
      partNumber,
      description: String(descriptionIndex === -1 ? "" : row[descriptionIndex] ?? "").trim(),
      category: String(categoryIndex === -1 ? "" : row[categoryIndex] ?? "").trim(),
      referenceImage: normalizeAssetPath(referenceImageIndex === -1 ? "" : row[referenceImageIndex]),
      icon: normalizeAssetPath(iconIndex === -1 ? "" : row[iconIndex]),
    });
  }

  return library;
}

export function getClientDevicePropertyLibrary(): Promise<Map<string, DevicePropertyRecord>> {
  if (!libraryPromise) {
    libraryPromise = loadLibrary();
  }

  return libraryPromise;
}

export async function getClientDevicePropertyRecord(
  partNumber: string,
  preferredField?: DevicePropertyField
): Promise<DevicePropertyRecord | null> {
  const library = await getClientDevicePropertyLibrary();
  const candidates = buildLookupCandidates(partNumber);

  let fallbackRecord: DevicePropertyRecord | null = null;
  for (const candidate of candidates) {
    const record = library.get(candidate) ?? null;
    if (!record) {
      continue;
    }

    if (!fallbackRecord) {
      fallbackRecord = record;
    }

    if (!preferredField || record[preferredField]) {
      return record;
    }
  }

  return fallbackRecord;
}

export async function getClientDevicePropertyRecords(
  partNumbers: string[],
  preferredField?: DevicePropertyField
): Promise<DevicePropertyRecord[]> {
  const library = await getClientDevicePropertyLibrary();
  const uniqueRecords = new Map<string, DevicePropertyRecord>();

  for (const partNumber of partNumbers) {
    const candidates = buildLookupCandidates(partNumber);
    let fallbackRecord: DevicePropertyRecord | null = null;

    for (const candidate of candidates) {
      const record = library.get(candidate) ?? null;
      if (!record) {
        continue;
      }

      if (!fallbackRecord) {
        fallbackRecord = record;
      }

      if (!preferredField || record[preferredField]) {
        const key = preferredField === "referenceImage" && record.referenceImage
          ? record.referenceImage
          : record.partNumber;
        uniqueRecords.set(key, record);
        fallbackRecord = null;
        break;
      }
    }

    if (fallbackRecord) {
      const key = preferredField === "referenceImage" && fallbackRecord.referenceImage
        ? fallbackRecord.referenceImage
        : fallbackRecord.partNumber;
      uniqueRecords.set(key, fallbackRecord);
    }
  }

  return Array.from(uniqueRecords.values());
}
