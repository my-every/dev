import type { LayoutPdfTextSource } from "@/lib/wire-length";
import { parseLayoutPdfText } from "@/lib/wire-length";

export interface AnnotationCalibrationCandidate {
  id: string;
  label: string;
  inches: number;
  kind: "rail" | "low-profile-rail" | "panduct";
  pageNumber: number;
  x?: number;
  y?: number;
  confidence: number;
}

export interface PanelSheetIdentity {
  panelKey: string;
  panelName: string;
  sheetNumber: number;
  pageNumber: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PersistedPanelCalibration {
  panelKey: string;
  panelName: string;
  sheetNumber: number;
  pageNumber: number;
  annotationLabel: string;
  annotationInches: number;
  pixelsPerInch: number;
  referenceStart: NormalizedPoint;
  referenceEnd: NormalizedPoint;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = "layout-calibration-v1";

function normalizePanelKey(panelName: string): string {
  return panelName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown-panel";
}

export function getCalibrationStorageKey(panelKey: string, sheetNumber: number): string {
  return `${STORAGE_PREFIX}:${panelKey}:${sheetNumber}`;
}

export function buildPanelSheetIdentity(
  source: LayoutPdfTextSource,
  fallbackFileName: string,
): PanelSheetIdentity {
  const parsed = parseLayoutPdfText(source);
  const primaryLayout = parsed.layouts[0];
  const panelName = primaryLayout?.panelName || parsed.panelNames[0] || fallbackFileName;

  return {
    panelName,
    panelKey: normalizePanelKey(panelName),
    sheetNumber: primaryLayout?.sheetNumber ?? 1,
    pageNumber: primaryLayout?.pageNumber ?? 1,
  };
}

export function extractPanelSheetIdentities(
  source: LayoutPdfTextSource,
  fallbackFileName: string,
): PanelSheetIdentity[] {
  const parsed = parseLayoutPdfText(source);
  if (parsed.layouts.length === 0) {
    return [buildPanelSheetIdentity(source, fallbackFileName)];
  }

  return parsed.layouts.map((layout) => {
    const panelName = layout.panelName || parsed.panelNames[0] || fallbackFileName;
    return {
      panelName,
      panelKey: normalizePanelKey(panelName),
      sheetNumber: layout.sheetNumber || layout.pageNumber || 1,
      pageNumber: layout.pageNumber || layout.sheetNumber || 1,
    };
  });
}

export function extractAnnotationCalibrationCandidates(
  source: LayoutPdfTextSource,
): AnnotationCalibrationCandidate[] {
  const parsed = parseLayoutPdfText(source);
  const candidates: AnnotationCalibrationCandidate[] = [];

  for (const layout of parsed.layouts) {
    const measurements = [
      ...layout.railGroups.flatMap((group) => group.measurements),
      ...layout.unassignedMeasurements,
    ];

    for (const measurement of measurements) {
      if (!measurement.lengthInches || measurement.lengthInches <= 0) {
        continue;
      }

      if (
        measurement.kind !== "rail" &&
        measurement.kind !== "low-profile-rail" &&
        measurement.kind !== "panduct"
      ) {
        continue;
      }

      candidates.push({
        id: `${layout.pageNumber}-${measurement.lineNumber}-${measurement.kind}-${measurement.label}`,
        label: measurement.label,
        inches: measurement.lengthInches,
        kind: measurement.kind,
        pageNumber: measurement.pageNumber ?? layout.pageNumber,
        x: measurement.x,
        y: measurement.y,
        confidence:
          measurement.kind === "rail"
            ? 0.9
            : measurement.kind === "low-profile-rail"
              ? 0.88
              : 0.8,
      });
    }
  }

  const uniqueByLabelPage = new Map<string, AnnotationCalibrationCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.pageNumber}:${candidate.kind}:${candidate.label}:${candidate.inches}`;
    const existing = uniqueByLabelPage.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      uniqueByLabelPage.set(key, candidate);
    }
  }

  return Array.from(uniqueByLabelPage.values()).sort((left, right) => {
    if (left.pageNumber !== right.pageNumber) {
      return left.pageNumber - right.pageNumber;
    }
    return right.confidence - left.confidence;
  });
}

export function distanceInPixels(
  start: NormalizedPoint,
  end: NormalizedPoint,
  imageWidth: number,
  imageHeight: number,
): number {
  const startX = start.x * imageWidth;
  const startY = start.y * imageHeight;
  const endX = end.x * imageWidth;
  const endY = end.y * imageHeight;
  const dx = endX - startX;
  const dy = endY - startY;
  return Math.hypot(dx, dy);
}

export function buildPixelsPerInch(
  start: NormalizedPoint,
  end: NormalizedPoint,
  realInches: number,
  imageWidth: number,
  imageHeight: number,
): number {
  if (realInches <= 0) {
    return 0;
  }

  const pixelDistance = distanceInPixels(start, end, imageWidth, imageHeight);
  if (pixelDistance <= 0) {
    return 0;
  }

  return pixelDistance / realInches;
}

export function toInches(pixelDistance: number, pixelsPerInch: number): number {
  if (pixelsPerInch <= 0) {
    return 0;
  }
  return pixelDistance / pixelsPerInch;
}
