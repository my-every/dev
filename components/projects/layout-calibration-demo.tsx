"use client"; 

import { ChangeEvent, MouseEvent, useMemo, useState } from "react";
import { Upload, Ruler, Save, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractStructuredPdfText } from "@/lib/layout-matching/extract-pdf-text";
import { renderPdfPagesToImages } from "@/lib/layout-matching/render-pdf-pages-to-images";
import type { LayoutPagePreview } from "@/lib/layout-matching/types";
import { buildProjectModel, parseWorkbook } from "@/lib/workbook";
import type { ParsedWorkbookSheet, SemanticWireListRow } from "@/lib/workbook/types";
import {
  AnnotationCalibrationCandidate,
  buildPixelsPerInch,
  distanceInPixels,
  extractAnnotationCalibrationCandidates,
  extractPanelSheetIdentities,
  getCalibrationStorageKey,
  PersistedPanelCalibration,
  toInches,
} from "@/lib/layout-matching/annotation-auto-calibration";
import { parseLayoutPdfText, type LayoutPdfTextSource, type ParsedLayoutPdf } from "@/lib/wire-length";
import { extractSingleConnections } from "@/lib/wiring-identification/extract-single-connections";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

interface WorkbookSheetOption {
  id: string;
  label: string;
  rows: SemanticWireListRow[];
}

type ToolMode = "calibrate" | "measure";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeDeviceKey(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const upper = value.toUpperCase();
  const matched = upper.match(/[A-Z]{2}\d{4}/);
  return matched?.[0] ?? upper.trim();
}

function pointsClose(first: Point, second: Point): boolean {
  return Math.abs(first.x - second.x) < 0.005 && Math.abs(first.y - second.y) < 0.005;
}

function seedMeasurementPoints(from: Point | null, to: Point | null): Point[] {
  if (from && to) {
    return [from, to];
  }
  if (from) {
    return [from];
  }
  if (to) {
    return [to];
  }
  return [];
}

function getPathDistanceInPixels(
  points: Point[],
  imageWidth: number,
  imageHeight: number,
): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceInPixels(points[index - 1], points[index], imageWidth, imageHeight);
  }

  return total;
}

function buildDevicePointMapForPage(
  layout: ParsedLayoutPdf["layouts"][number] | null | undefined,
  page: LayoutPagePreview | null | undefined,
): Map<string, Point> {
  if (!layout || !page) {
    return new Map<string, Point>();
  }

  const allDevices = [
    ...layout.railGroups.flatMap((group) => group.devices),
    ...layout.unassignedDevices,
  ];

  if (allDevices.length === 0) {
    return new Map<string, Point>();
  }

  const pageItems = page.textItems ?? [];
  const xValues = pageItems.map((item) => item.x);
  const yValues = pageItems.map((item) => item.y);

  if (xValues.length === 0 || yValues.length === 0) {
    for (const device of allDevices) {
      if (typeof device.x === "number") xValues.push(device.x);
      if (typeof device.y === "number") yValues.push(device.y);
    }
  }

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const pointMap = new Map<string, Point>();
  for (const device of allDevices) {
    if (typeof device.x !== "number" || typeof device.y !== "number") {
      continue;
    }

    const key = normalizeDeviceKey(device.deviceId);
    if (!key || pointMap.has(key)) {
      continue;
    }

    pointMap.set(key, {
      x: clamp01((device.x - minX) / width),
      y: clamp01(1 - (device.y - minY) / height),
    });
  }

  return pointMap;
}

export function LayoutCalibrationDemo() {
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pdfSource, setPdfSource] = useState<LayoutPdfTextSource | null>(null);
  const [parsedPdf, setParsedPdf] = useState<ParsedLayoutPdf | null>(null);
  const [pages, setPages] = useState<LayoutPagePreview[]>([]);
  const [identitiesByPage, setIdentitiesByPage] = useState<Map<number, { panelKey: string; panelName: string; sheetNumber: number }>>(new Map());
  const [candidates, setCandidates] = useState<AnnotationCalibrationCandidate[]>([]);

  const [selectedPageNumber, setSelectedPageNumber] = useState<string>("1");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [realInches, setRealInches] = useState<string>("");

  const [mode, setMode] = useState<ToolMode>("calibrate");
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [measurementPoints, setMeasurementPoints] = useState<Point[]>([]);
  const [measurementFinished, setMeasurementFinished] = useState(false);
  const [measurementTargetPoint, setMeasurementTargetPoint] = useState<Point | null>(null);
  const [calibration, setCalibration] = useState<PersistedPanelCalibration | null>(null);

  const [workbookName, setWorkbookName] = useState<string>("");
  const [workbookSheets, setWorkbookSheets] = useState<WorkbookSheetOption[]>([]);
  const [selectedWorkbookSheetId, setSelectedWorkbookSheetId] = useState<string>("");
  const [selectedConnectionRowId, setSelectedConnectionRowId] = useState<string>("");

  const selectedPage = useMemo(
    () => pages.find((page) => page.pageNumber === Number(selectedPageNumber)) ?? null,
    [pages, selectedPageNumber],
  );

  const pageCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.pageNumber === Number(selectedPageNumber)),
    [candidates, selectedPageNumber],
  );

  const selectedCandidate = useMemo(
    () => pageCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [pageCandidates, selectedCandidateId],
  );

  const selectedIdentity = useMemo(
    () => identitiesByPage.get(Number(selectedPageNumber)) ?? null,
    [identitiesByPage, selectedPageNumber],
  );

  const selectedWorkbookSheet = useMemo(
    () => workbookSheets.find((sheet) => sheet.id === selectedWorkbookSheetId) ?? null,
    [selectedWorkbookSheetId, workbookSheets],
  );

  const singleConnections = useMemo(() => {
    if (!selectedWorkbookSheet) {
      return [];
    }

    const matches = extractSingleConnections({
      rows: selectedWorkbookSheet.rows,
      blueLabels: null,
      currentSheetName: selectedWorkbookSheet.label,
      normalizedSheetName: selectedWorkbookSheet.label,
      partNumberMap: null,
    });

    return matches.map((match) => match.row);
  }, [selectedWorkbookSheet]);

  const selectedConnection = useMemo(
    () => singleConnections.find((row) => row.__rowId === selectedConnectionRowId) ?? null,
    [selectedConnectionRowId, singleConnections],
  );

  const selectedLayout = useMemo(
    () => parsedPdf?.layouts.find((layout) => layout.pageNumber === Number(selectedPageNumber)) ?? null,
    [parsedPdf, selectedPageNumber],
  );

  const devicePointMapsByPage = useMemo(() => {
    const map = new Map<number, Map<string, Point>>();
    for (const page of pages) {
      const layout = parsedPdf?.layouts.find((item) => item.pageNumber === page.pageNumber) ?? null;
      map.set(page.pageNumber, buildDevicePointMapForPage(layout, page));
    }
    return map;
  }, [pages, parsedPdf]);

  const devicePointByKey = useMemo(() => {
    return devicePointMapsByPage.get(Number(selectedPageNumber)) ?? new Map<string, Point>();
  }, [devicePointMapsByPage, selectedPageNumber]);

  const highlightedConnectionPoints = useMemo(() => {
    if (!selectedConnection) {
      return null;
    }

    const fromKey = normalizeDeviceKey(selectedConnection.fromDeviceId);
    const toKey = normalizeDeviceKey(selectedConnection.toDeviceId);

    return {
      from: devicePointByKey.get(fromKey) ?? null,
      to: devicePointByKey.get(toKey) ?? null,
      fromLabel: selectedConnection.fromDeviceId,
      toLabel: selectedConnection.toDeviceId,
    };
  }, [devicePointByKey, selectedConnection]);

  const effectiveInches = useMemo(() => {
    const parsed = Number(realInches);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return selectedCandidate?.inches ?? 0;
  }, [realInches, selectedCandidate]);

  const calibrationPixelsPerInch = useMemo(() => {
    if (!selectedPage?.width || !selectedPage?.height || calibrationPoints.length < 2 || effectiveInches <= 0) {
      return 0;
    }
    return buildPixelsPerInch(
      calibrationPoints[0],
      calibrationPoints[1],
      effectiveInches,
      selectedPage.width,
      selectedPage.height,
    );
  }, [calibrationPoints, effectiveInches, selectedPage?.height, selectedPage?.width]);

  const measuredDistance = useMemo(() => {
    if (
      !selectedPage?.width ||
      !selectedPage?.height ||
      measurementPoints.length < 2
    ) {
      return null;
    }

    const px = getPathDistanceInPixels(
      measurementPoints,
      selectedPage.width,
      selectedPage.height,
    );

    return {
      px,
      inches: calibration?.pixelsPerInch ? toInches(px, calibration.pixelsPerInch) : null,
    };
  }, [calibration?.pixelsPerInch, measurementPoints, selectedPage?.height, selectedPage?.width]);

  const loadStoredCalibration = (
    pageNumber: number,
    identityMap: Map<number, { panelKey: string; panelName: string; sheetNumber: number }>,
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    const identity = identityMap.get(pageNumber);
    if (!identity) {
      setCalibration(null);
      return;
    }

    const storageKey = getCalibrationStorageKey(identity.panelKey, identity.sheetNumber);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setCalibration(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedPanelCalibration;
      setCalibration(parsed);
    } catch {
      setCalibration(null);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Upload a PDF file to test annotation auto-calibration.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const [source, previews] = await Promise.all([
        extractStructuredPdfText(file),
        renderPdfPagesToImages(file, { scale: 1.5 }),
      ]);

      const parsed = parseLayoutPdfText(source);

      const foundCandidates = extractAnnotationCalibrationCandidates(source);
      const identities = extractPanelSheetIdentities(source, file.name);
      const identityMap = new Map<number, { panelKey: string; panelName: string; sheetNumber: number }>();
      for (const identity of identities) {
        identityMap.set(identity.pageNumber, {
          panelKey: identity.panelKey,
          panelName: identity.panelName,
          sheetNumber: identity.sheetNumber,
        });
      }

      const initialPage = previews[0]?.pageNumber ?? 1;
      const firstCandidate = foundCandidates.find((candidate) => candidate.pageNumber === initialPage) ?? foundCandidates[0] ?? null;

      setFileName(file.name);
      setPdfSource(source);
      setParsedPdf(parsed);
      setPages(previews);
      setCandidates(foundCandidates);
      setIdentitiesByPage(identityMap);
      setSelectedPageNumber(String(initialPage));
      setSelectedCandidateId(firstCandidate?.id ?? "");
      setRealInches(firstCandidate ? String(firstCandidate.inches) : "");
      setCalibrationPoints([]);
      setMeasurementPoints([]);
      setMeasurementTargetPoint(null);
      setMeasurementFinished(false);
      loadStoredCalibration(initialPage, identityMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const handlePageChange = (value: string) => {
    setSelectedPageNumber(value);

    const pageNumber = Number(value);
    const firstCandidate = candidates.find((candidate) => candidate.pageNumber === pageNumber);
    setSelectedCandidateId(firstCandidate?.id ?? "");
    setRealInches(firstCandidate ? String(firstCandidate.inches) : "");
    setCalibrationPoints([]);
    setMeasurementPoints([]);
    setMeasurementTargetPoint(null);
    setMeasurementFinished(false);

    loadStoredCalibration(pageNumber, identitiesByPage);
  };

  const pushPoint = (existing: Point[], point: Point): Point[] => {
    if (existing.length === 0) return [point];
    if (existing.length === 1) return [existing[0], point];
    return [point];
  };

  const appendPoint = (existing: Point[], point: Point): Point[] => [...existing, point];

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectedPage) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);

    if (mode === "calibrate") {
      setCalibrationPoints((prev) => pushPoint(prev, { x, y }));
      return;
    }

    if (measurementFinished) {
      return;
    }

    setMeasurementPoints((prev) => {
      if (!measurementTargetPoint) {
        return appendPoint(prev, { x, y });
      }

      if (prev.length >= 2 && pointsClose(prev[prev.length - 1], measurementTargetPoint)) {
        return [...prev.slice(0, -1), { x, y }, measurementTargetPoint];
      }

      return appendPoint(prev, { x, y });
    });
  };

  const handleWorkbookFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("Upload an Excel workbook (.xlsx or .xls) to list single connections.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.success || !parsed.workbook) {
        throw new Error(parsed.errors.join("; ") || "Failed to parse workbook.");
      }

      const project = buildProjectModel(parsed.workbook);
      const options: WorkbookSheetOption[] = project.sheets
        .filter((summary) => summary.kind === "operational")
        .map((summary) => {
          const data = project.sheetData[summary.id] as ParsedWorkbookSheet | undefined;
          return {
            id: summary.id,
            label: summary.name,
            rows: data?.semanticRows ?? [],
          };
        })
        .filter((sheet) => sheet.rows.length > 0);

      setWorkbookName(file.name);
      setWorkbookSheets(options);
      setSelectedWorkbookSheetId(options[0]?.id ?? "");
      setSelectedConnectionRowId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse workbook.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const handleSelectConnection = (rowId: string) => {
    setSelectedConnectionRowId(rowId);
    setMode("measure");
    setMeasurementFinished(false);

    const row = singleConnections.find((item) => item.__rowId === rowId);
    if (!row) {
      return;
    }

    const fromKey = normalizeDeviceKey(row.fromDeviceId);
    const toKey = normalizeDeviceKey(row.toDeviceId);

    let bestPageNumber = Number(selectedPageNumber);
    let from: Point | null = null;
    let to: Point | null = null;

    for (const [pageNumber, pointMap] of devicePointMapsByPage.entries()) {
      const pageFrom = pointMap.get(fromKey) ?? null;
      const pageTo = pointMap.get(toKey) ?? null;
      if (pageFrom && pageTo) {
        bestPageNumber = pageNumber;
        from = pageFrom;
        to = pageTo;
        break;
      }

      if (!from && pageFrom) {
        bestPageNumber = pageNumber;
        from = pageFrom;
      }
      if (!to && pageTo) {
        bestPageNumber = pageNumber;
        to = pageTo;
      }
    }

    if (bestPageNumber !== Number(selectedPageNumber)) {
      setSelectedPageNumber(String(bestPageNumber));
    }

    if (!from || !to) {
      const fallbackMap = devicePointMapsByPage.get(bestPageNumber) ?? new Map<string, Point>();
      from = from ?? fallbackMap.get(fromKey) ?? null;
      to = to ?? fallbackMap.get(toKey) ?? null;
    }

    setMeasurementPoints(seedMeasurementPoints(from, to));
    setMeasurementTargetPoint(to ?? null);
  };

  const saveCalibration = () => {
    if (!selectedIdentity || !selectedPage || calibrationPoints.length < 2 || effectiveInches <= 0 || calibrationPixelsPerInch <= 0) {
      return;
    }

    const payload: PersistedPanelCalibration = {
      panelKey: selectedIdentity.panelKey,
      panelName: selectedIdentity.panelName,
      sheetNumber: selectedIdentity.sheetNumber,
      pageNumber: selectedPage.pageNumber,
      annotationLabel: selectedCandidate?.label ?? "manual-reference",
      annotationInches: effectiveInches,
      pixelsPerInch: calibrationPixelsPerInch,
      referenceStart: calibrationPoints[0],
      referenceEnd: calibrationPoints[1],
      createdAt: calibration?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      const storageKey = getCalibrationStorageKey(selectedIdentity.panelKey, selectedIdentity.sheetNumber);
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }

    setCalibration(payload);
    setMode("measure");
    setMeasurementPoints([]);
    setMeasurementFinished(false);
  };

  const clearMeasurement = () => {
    setMeasurementPoints([]);
    setMeasurementFinished(false);
  };
  const clearCalibrationPoints = () => setCalibrationPoints([]);
  const finishMeasurement = () => {
    if (measurementPoints.length < 1) {
      return;
    }

    if (measurementTargetPoint) {
      setMeasurementPoints((prev) => {
        if (prev.length === 0) {
          return [measurementTargetPoint];
        }

        const last = prev[prev.length - 1];
        if (pointsClose(last, measurementTargetPoint)) {
          return prev;
        }

        return [...prev, measurementTargetPoint];
      });
    }

    setMeasurementFinished(true);
  };

  const undoLastMeasurementPoint = () => {
    setMeasurementPoints((prev) => prev.slice(0, -1));
    setMeasurementFinished(false);
  };

  const startNewMeasurementPath = () => {
    setMeasurementPoints(
      seedMeasurementPoints(
        highlightedConnectionPoints?.from ?? null,
        highlightedConnectionPoints?.to ?? null,
      ),
    );
    setMeasurementFinished(false);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Layout Annotation Auto-Calibration Demo</CardTitle>
          <CardDescription>
            Upload a layout PDF, auto-detect dimension annotations, calibrate once per panel/sheet, then measure device distances interactively.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="layout-calibration-upload" className="sr-only">
              Upload layout PDF
            </Label>
            <Input id="layout-calibration-upload" type="file" accept=".pdf" onChange={handleFile} className="max-w-sm" />
            <Input type="file" accept=".xlsx,.xls" onChange={handleWorkbookFile} className="max-w-sm" />
            {loading && (
              <Badge variant="outline" className="gap-1">
                <RefreshCw className="size-3 animate-spin" /> Processing
              </Badge>
            )}
            {!!fileName && <Badge variant="secondary">{fileName}</Badge>}
            {!!workbookName && <Badge variant="secondary">Workbook: {workbookName}</Badge>}
            {pdfSource && <Badge variant="outline">Pages: {pages.length}</Badge>}
            {selectedIdentity && (
              <Badge variant="outline">
                {selectedIdentity.panelName} - Sheet {selectedIdentity.sheetNumber}
              </Badge>
            )}
            {calibration && (
              <Badge variant="default" className="gap-1">
                <Save className="size-3" /> Saved calibration ({calibration.pixelsPerInch.toFixed(2)} px/in)
              </Badge>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {pages.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Calibration Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Page</Label>
                    <Select value={selectedPageNumber} onValueChange={handlePageChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select page" />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((page) => (
                          <SelectItem key={page.pageNumber} value={String(page.pageNumber)}>
                            Page {page.pageNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Workbook sheet (single connections)</Label>
                    <Select
                      value={selectedWorkbookSheetId}
                      onValueChange={(value) => {
                        setSelectedWorkbookSheetId(value);
                        setSelectedConnectionRowId("");
                        setMeasurementPoints([]);
                        setMeasurementTargetPoint(null);
                        setMeasurementFinished(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select workbook sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {workbookSheets.length === 0 && (
                          <SelectItem value="__none" disabled>
                            Upload workbook to enable connections table
                          </SelectItem>
                        )}
                        {workbookSheets.map((sheet) => (
                          <SelectItem key={sheet.id} value={sheet.id}>
                            {sheet.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Auto-detected annotation</Label>
                    <Select
                      value={selectedCandidateId}
                      onValueChange={(value) => {
                        setSelectedCandidateId(value);
                        const candidate = pageCandidates.find((item) => item.id === value);
                        if (candidate) {
                          setRealInches(String(candidate.inches));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick annotation" />
                      </SelectTrigger>
                      <SelectContent>
                        {pageCandidates.length === 0 && (
                          <SelectItem value="__none" disabled>
                            No annotation candidates detected
                          </SelectItem>
                        )}
                        {pageCandidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.label} ({candidate.inches}")
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Reference inches</Label>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={realInches}
                      onChange={(event) => setRealInches(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={mode === "calibrate" ? "default" : "outline"}
                      onClick={() => setMode("calibrate")}
                    >
                      <Ruler className="mr-2 size-4" /> Calibrate
                    </Button>
                    <Button
                      type="button"
                      variant={mode === "measure" ? "default" : "outline"}
                      onClick={() => {
                        setMode("measure");
                        setMeasurementFinished(false);
                      }}
                      disabled={!calibration}
                    >
                      Measure
                    </Button>
                  </div>

                  <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                    {mode === "calibrate"
                      ? "Calibrate mode: click two points corresponding to the selected annotation dimension."
                      : "Measure mode: click multiple points to route around panducts, then click Finish path."}
                  </div>

                  <div className="space-y-2 rounded-md border p-2 text-sm">
                    <p className="font-medium">Calibration preview</p>
                    <p>Reference: {effectiveInches > 0 ? `${effectiveInches.toFixed(2)} in` : "N/A"}</p>
                    <p>Points: {calibrationPoints.length}/2</p>
                    <p>Computed scale: {calibrationPixelsPerInch > 0 ? `${calibrationPixelsPerInch.toFixed(2)} px/in` : "N/A"}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={clearCalibrationPoints}>
                        Reset points
                      </Button>
                      <Button type="button" size="sm" onClick={saveCalibration} disabled={calibrationPixelsPerInch <= 0 || effectiveInches <= 0}>
                        Save calibration
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border p-2 text-sm">
                    <p className="font-medium">Measurement</p>
                    <p>Points: {measurementPoints.length}</p>
                    <p>Segments: {Math.max(0, measurementPoints.length - 1)}</p>
                    <p>Pixels: {measuredDistance ? measuredDistance.px.toFixed(2) : "N/A"}</p>
                    <p>
                      Inches: {measuredDistance?.inches != null ? measuredDistance.inches.toFixed(2) : "N/A"}
                    </p>
                    <p>Status: {measurementFinished ? "Finished" : "Collecting points"}</p>
                    <p>
                      Selected connection: {selectedConnection ? `${selectedConnection.fromDeviceId} -> ${selectedConnection.toDeviceId}` : "N/A"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={finishMeasurement}
                        disabled={measurementPoints.length < 1 || measurementFinished}
                      >
                        Finish path
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={undoLastMeasurementPoint}
                        disabled={measurementPoints.length === 0}
                      >
                        Undo last point
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={startNewMeasurementPath}
                      >
                        New path
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={clearMeasurement}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border p-2 text-sm">
                    <p className="font-medium">Single Connections</p>
                    <p className="text-xs text-muted-foreground">
                      Select a row to highlight FROM/TO devices and measure the routed path interactively.
                    </p>
                    <div className="max-h-64 overflow-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80">
                          <tr className="border-b">
                            <th className="px-2 py-1 text-left">Wire</th>
                            <th className="px-2 py-1 text-left">From</th>
                            <th className="px-2 py-1 text-left">To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleConnections.length === 0 && (
                            <tr>
                              <td className="px-2 py-2 text-muted-foreground" colSpan={3}>
                                No single-connection rows available for this sheet.
                              </td>
                            </tr>
                          )}
                          {singleConnections.map((row) => {
                            const isSelected = selectedConnectionRowId === row.__rowId;
                            return (
                              <tr
                                key={row.__rowId}
                                className={cn("cursor-pointer border-b", isSelected && "bg-primary/10")}
                                onClick={() => handleSelectConnection(row.__rowId)}
                              >
                                <td className="px-2 py-1 font-mono">{row.wireNo || "-"}</td>
                                <td className="px-2 py-1">{row.fromDeviceId || "-"}</td>
                                <td className="px-2 py-1">{row.toDeviceId || "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Interactive Panel View</CardTitle>
                  <CardDescription>
                    Click on the panel image to calibrate and measure.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedPage ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className="relative cursor-crosshair overflow-hidden rounded-md border bg-muted"
                      onClick={handleCanvasClick}
                      onKeyDown={() => undefined}
                    >
                      <img
                        src={selectedPage.imageUrl}
                        alt={`Layout page ${selectedPage.pageNumber}`}
                        className="h-auto w-full"
                      />

                      {[...(mode === "calibrate" ? calibrationPoints : measurementPoints)].map((point, index) => (
                        <div
                          key={`${mode}-point-${index}-${point.x}-${point.y}`}
                          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-red-500 shadow"
                          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                        />
                      ))}

                      {(mode === "calibrate" ? calibrationPoints.length : measurementPoints.length) >= 2 && (
                        <svg className="pointer-events-none absolute inset-0 size-full">
                          {mode === "calibrate" ? (
                            <line
                              x1={`${calibrationPoints[0].x * 100}%`}
                              y1={`${calibrationPoints[0].y * 100}%`}
                              x2={`${calibrationPoints[1].x * 100}%`}
                              y2={`${calibrationPoints[1].y * 100}%`}
                              stroke="#2563eb"
                              strokeWidth="2"
                              strokeDasharray="6 4"
                            />
                          ) : (
                            <>
                              <polyline
                                points={measurementPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
                                fill="none"
                                stroke={measurementFinished ? "#2563eb" : "#16a34a"}
                                strokeWidth="2"
                                strokeDasharray="6 4"
                              />
                              {measurementTargetPoint && measurementPoints.length > 0 && !measurementFinished && (
                                <line
                                  x1={`${measurementPoints[measurementPoints.length - 1].x * 100}%`}
                                  y1={`${measurementPoints[measurementPoints.length - 1].y * 100}%`}
                                  x2={`${measurementTargetPoint.x * 100}%`}
                                  y2={`${measurementTargetPoint.y * 100}%`}
                                  stroke="#f59e0b"
                                  strokeWidth="2"
                                  strokeDasharray="4 4"
                                />
                              )}
                            </>
                          )}
                        </svg>
                      )}

                      {highlightedConnectionPoints?.from && (
                        <div
                          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
                          style={{
                            left: `${highlightedConnectionPoints.from.x * 100}%`,
                            top: `${highlightedConnectionPoints.from.y * 100}%`,
                          }}
                          title={`FROM: ${highlightedConnectionPoints.fromLabel}`}
                        />
                      )}

                      {highlightedConnectionPoints?.to && (
                        <div
                          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange-500 shadow"
                          style={{
                            left: `${highlightedConnectionPoints.to.x * 100}%`,
                            top: `${highlightedConnectionPoints.to.y * 100}%`,
                          }}
                          title={`TO: ${highlightedConnectionPoints.toLabel}`}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Upload a layout PDF to begin the demo.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
