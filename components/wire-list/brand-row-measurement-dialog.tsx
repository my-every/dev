"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Undo2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { LayoutPageIndexItem, LayoutPagesIndexDocument } from "@/lib/layout-matching";
import { loadBrowserPdfJs } from "@/lib/layout-matching/extract-pdf-text";

interface BrandRowMeasurementDialogProps {
  open: boolean;
  endpoint: string | null;
  initialPageNumber?: number;
  sheetName?: string | null;
  targetRow?: {
    rowId: string;
    fromDeviceId?: string | null;
    toDeviceId?: string | null;
    toLocation?: string | null;
    wireNo?: string | null;
    wireId?: string | null;
    bundleDisplay?: string | null;
  } | null;
  rowPosition?: { current: number; total: number } | null;
  canGoPreviousRow?: boolean;
  canGoNextRow?: boolean;
  onGoToPreviousRow?: () => void;
  onGoToNextRow?: () => void;
  onOpenChange: (open: boolean) => void;
  onApply: (roundedLength: number) => void;
}

interface LayoutWorkspacePayload {
  pdf?: { url?: string | null } | null;
  layoutIndex?: LayoutPagesIndexDocument | null;
}

// Points stored in PDF user-space coordinates so they are zoom-invariant.
interface MeasurePoint {
  id: string;
  pdfX: number;
  pdfY: number;
}

// Tracks the rendered page dimensions and the exact scale used to render it.
interface PageState {
  pdfWidth: number;
  pdfHeight: number;
  renderScale: number;
}

interface SegmentMetric {
  id: string;
  lengthInches: number;
  midX: number;
  midY: number;
}

interface SegmentRenderItem {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  lengthInches: number;
  midX: number;
  midY: number;
}

interface StoredRowMeasurement {
  rowId: string;
  wireKey: string;
  pageNumber: number;
  mode: MeasurementMode;
  points: MeasurePoint[];
}

interface MeasurementConfigPayload {
  schemaVersion: number;
  sheetKey: string;
  rows: Record<string, StoredRowMeasurement>;
  updatedAt: string;
}

type MeasurementMode = "path" | "fanout";
type PathVisibilityMode = "active" | "all";

const ROUND_INCREMENT_IN = 10;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;
const BASE_VIEW_SCALE = 1.15;
const DEFAULT_HORIZONTAL_MULTIPLIER = 2.5;
const DEFAULT_VERTICAL_MULTIPLIER = 2.5;
const LENS_SIZE_PX = 168;
const LENS_ZOOM = 2.2;
const MEASUREMENT_CONFIG_SCHEMA_VERSION = 1;

// --- Pure helpers ---

function roundToNearestIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value) || value <= 0 || increment <= 0) return 0;
  return Math.round(value / increment) * increment;
}

function deriveInchesPerPdfUnit(): number {
  return 1 / 72;
}

function getColorFromWireKey(value: string): string {
  const key = value.trim();
  if (!key) {
    return "#e11d48";
  }

  let hash = 0;
  for (let index = 0; index < key.length; index++) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  const hue = hash % 360;
  return `hsl(${hue} 78% 46%)`;
}

function normalizeMatchValue(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function matchesDevice(text: string, device: string): boolean {
  if (!text || !device) return false;
  const escaped = device.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(text);
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeMatchValue(value)
    .replace(/[^A-Z0-9]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function resolveBestPageNumber(
  layoutIndex: LayoutPagesIndexDocument | null,
  initialPageNumber: number | undefined,
  sheetName: string | null | undefined,
  targetRow: BrandRowMeasurementDialogProps["targetRow"],
): { pageNumber: number | undefined; reason: string } {
  const pages = layoutIndex?.pages ?? [];
  if (pages.length === 0) {
    return { pageNumber: initialPageNumber, reason: "No layout pages available" };
  }

  const normalizedFrom = normalizeMatchValue(targetRow?.fromDeviceId);
  const normalizedTo = normalizeMatchValue(targetRow?.toDeviceId);
  const sheetTokens = tokenize(sheetName);
  const locationTokens = tokenize(targetRow?.toLocation);

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestPage: LayoutPageIndexItem | null = null;
  let bestReason = "";

  for (const page of pages) {
    const pageTitle = normalizeMatchValue(page.title ?? page.normalizedTitle ?? "");
    const pageText = normalizeMatchValue(page.textContent ?? "");
    const deviceTags = new Set<string>();

    for (const device of page.devices ?? []) {
      const tag = normalizeMatchValue(device.tag);
      if (tag) deviceTags.add(tag);
    }
    for (const rail of page.railGroups ?? []) {
      for (const device of rail.devices ?? []) {
        const tag = normalizeMatchValue(device.tag);
        if (tag) deviceTags.add(tag);
      }
    }

    let score = 0;
    const reasons: string[] = [];

    const fromInDevices = normalizedFrom ? deviceTags.has(normalizedFrom) : false;
    const toInDevices = normalizedTo ? deviceTags.has(normalizedTo) : false;
    const fromInText = normalizedFrom ? matchesDevice(pageText, normalizedFrom) : false;
    const toInText = normalizedTo ? matchesDevice(pageText, normalizedTo) : false;

    if (fromInDevices) { score += 38; reasons.push("from-device exact"); }
    else if (fromInText) { score += 18; reasons.push("from-device text"); }

    if (toInDevices) { score += 38; reasons.push("to-device exact"); }
    else if (toInText) { score += 18; reasons.push("to-device text"); }

    if ((fromInDevices || fromInText) && (toInDevices || toInText)) {
      score += 24;
      reasons.push("both endpoints present");
    }

    for (const token of sheetTokens) {
      if (pageTitle.includes(token)) score += 3;
    }
    for (const token of locationTokens) {
      if (pageTitle.includes(token) || pageText.includes(token)) score += 2;
    }

    if (typeof initialPageNumber === "number" && page.pageNumber === initialPageNumber) {
      score += 6;
      reasons.push("active sheet page boost");
    }

    if (score > bestScore) {
      bestScore = score;
      bestPage = page;
      bestReason = reasons.join(", ") || "title/location similarity";
    }
  }

  if (!bestPage) {
    return { pageNumber: initialPageNumber ?? pages[0]?.pageNumber, reason: "Fell back to provided page" };
  }

  if (bestScore < 10) {
    const fallback =
      (typeof initialPageNumber === "number"
        ? pages.find((p) => p.pageNumber === initialPageNumber)?.pageNumber
        : undefined) ?? pages[0]?.pageNumber;
    return { pageNumber: fallback, reason: "Low-confidence auto-match, using sheet page fallback" };
  }

  return { pageNumber: bestPage.pageNumber, reason: `Auto-matched via ${bestReason}` };
}

export function BrandRowMeasurementDialog({
  open,
  endpoint,
  initialPageNumber,
  sheetName,
  targetRow,
  rowPosition,
  canGoPreviousRow = false,
  canGoNextRow = false,
  onGoToPreviousRow,
  onGoToNextRow,
  onOpenChange,
  onApply,
}: BrandRowMeasurementDialogProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevRenderScaleRef = useRef(1);
  const lastRenderedPageRef = useRef<number | null>(null);
  const hasCenteredForPageRef = useRef(false);
  const renderRequestIdRef = useRef(0);
  const zoomAnchorRef = useRef<{ pdfX: number; pdfY: number } | null>(null);
  const previousRowIdRef = useRef<string | null>(null);
  const previousRowWireKeyRef = useRef<string>("");
  const configLoadedRef = useRef(false);
  const pointerSessionRef = useRef<{
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
    dragged: boolean;
  } | null>(null);

  const [loadingPayload, setLoadingPayload] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<LayoutWorkspacePayload | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDocument, setPdfDocument] = useState<any | null>(null);
  const [activePageNumber, setActivePageNumber] = useState(initialPageNumber ?? 1);
  const [zoom, setZoom] = useState(1);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>("path");
  const [isPathEnded, setIsPathEnded] = useState(false);
  const [horizontalMultiplier, setHorizontalMultiplier] = useState(DEFAULT_HORIZONTAL_MULTIPLIER);
  const [verticalMultiplier, setVerticalMultiplier] = useState(DEFAULT_VERTICAL_MULTIPLIER);
  const [calibrationLengthInput, setCalibrationLengthInput] = useState("20");
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  // Tracks mouse position over the canvas in PDF coords for the ghost-point preview.
  const [hoverPdf, setHoverPdf] = useState<{ pdfX: number; pdfY: number } | null>(null);
  const [rowMeasurements, setRowMeasurements] = useState<Record<string, StoredRowMeasurement>>({});
  const [pathVisibilityMode, setPathVisibilityMode] = useState<PathVisibilityMode>("active");
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const activeWireKey =
    String(targetRow?.wireId ?? "").trim() ||
    String(targetRow?.wireNo ?? "").trim() ||
    String(targetRow?.rowId ?? "").trim();
  const projectIdFromEndpoint = useMemo(() => {
    if (!endpoint) {
      return null;
    }

    const match = endpoint.match(/\/api\/projects\/([^/]+)\/layout-pdf/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [endpoint]);
  const measurementSheetKey = useMemo(
    () => (sheetName?.trim() || "default-sheet"),
    [sheetName],
  );

  const saveMeasurementsConfig = useCallback(async (rows: Record<string, StoredRowMeasurement>) => {
    if (!projectIdFromEndpoint) {
      return;
    }

    try {
      await fetch(
        `/api/projects/${encodeURIComponent(projectIdFromEndpoint)}/measurements/config?sheetKey=${encodeURIComponent(measurementSheetKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schemaVersion: MEASUREMENT_CONFIG_SCHEMA_VERSION,
            sheetKey: measurementSheetKey,
            rows,
          } satisfies MeasurementConfigPayload),
        },
      );
    } catch (error) {
      console.error("Failed to save measurement config", error);
    }
  }, [measurementSheetKey, projectIdFromEndpoint]);

  // --- Effects ---

  useEffect(() => {
    if (open && initialPageNumber) setActivePageNumber(initialPageNumber);
  }, [initialPageNumber, open]);

  useEffect(() => {
    if (!open || !endpoint) {
      setPayload(null);
      setPdfDocument(null);
      return;
    }

    let cancelled = false;
    setLoadingPayload(true);

    fetch(endpoint, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<LayoutWorkspacePayload>;
      })
      .then((next) => { if (!cancelled) setPayload(next); })
      .catch((err) => { if (!cancelled) { console.error("Failed to load measurement payload", err); setPayload(null); } })
      .finally(() => { if (!cancelled) setLoadingPayload(false); });

    return () => { cancelled = true; };
  }, [endpoint, open]);

  useEffect(() => {
    const pdfUrl = payload?.pdf?.url;
    if (!open || !pdfUrl) {
      setPdfDocument(null);
      setPdfLoadError(null);
      return;
    }

    let cancelled = false;
    setPdfLoadError(null);

    loadBrowserPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(pdfUrl).promise)
      .then((doc) => { if (!cancelled) setPdfDocument(doc); })
      .catch((err) => {
        console.error("Failed to load PDF for measurement", err);
        if (!cancelled) {
          setPdfDocument(null);
          setPdfLoadError("Unable to load the layout PDF for measurement.");
        }
      });

    return () => { cancelled = true; };
  }, [open, payload?.pdf?.url]);

  useEffect(() => {
    if (!open || !viewportRef.current) return;
    const element = viewportRef.current;
    const update = () => {
      setViewportSize((prev) => {
        const next = { width: element.clientWidth, height: element.clientHeight };
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  // --- Derived data (must come before effects that reference these values) ---

  const layoutIndex = payload?.layoutIndex ?? null;
  const pageCount = layoutIndex?.pageCount ?? 0;

  const sortedPageNumbers = useMemo(
    () => Array.from(new Set((layoutIndex?.pages ?? []).map((p) => p.pageNumber))).sort((a, b) => a - b),
    [layoutIndex],
  );

  const bestPageMatch = useMemo(
    () => resolveBestPageNumber(layoutIndex, initialPageNumber, sheetName, targetRow),
    [initialPageNumber, layoutIndex, sheetName, targetRow],
  );

  const activePage = useMemo(() => {
    if (!layoutIndex) return null;
    return layoutIndex.pages.find((p) => p.pageNumber === activePageNumber) ?? layoutIndex.pages[0] ?? null;
  }, [activePageNumber, layoutIndex]);

  // Renders the PDF page into the canvas with zoom baked into the scale,
  // producing crisp output at every zoom level without CSS scaling.
  useEffect(() => {
    if (!open || !pdfDocument || !activePage || !canvasRef.current || !viewportSize.width || !viewportSize.height) {
      return;
    }

    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    const requestId = ++renderRequestIdRef.current;

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(activePage.pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });

        const fitScale = Math.max(
          0.1,
          Math.min(
            (viewportSize.width - 32) / baseViewport.width,
            (viewportSize.height - 32) / baseViewport.height,
          ),
        );
        const renderScale = fitScale * BASE_VIEW_SCALE * zoom;
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled || renderRequestIdRef.current !== requestId) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({ canvasContext: context, viewport }) as {
          promise: Promise<void>;
          cancel: () => void;
        };
        await renderTask.promise;

        if (!cancelled && renderRequestIdRef.current === requestId) {
          setPageState({
            pdfWidth: baseViewport.width,
            pdfHeight: baseViewport.height,
            renderScale,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message = String(error);
          if (!message.includes("RenderingCancelledException")) {
            console.error("Failed to render measurement PDF page", error);
          }
        }
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // no-op
        }
      }
    };
  }, [activePage, open, pdfDocument, viewportSize.height, viewportSize.width, zoom]);

  useEffect(() => {
    if (!open) {
      setPoints([]);
      setZoom(1);
      setMeasurementMode("path");
      setIsPathEnded(false);
      prevRenderScaleRef.current = 1;
      lastRenderedPageRef.current = null;
      hasCenteredForPageRef.current = false;
      pointerSessionRef.current = null;
      setHorizontalMultiplier(DEFAULT_HORIZONTAL_MULTIPLIER);
      setVerticalMultiplier(DEFAULT_VERTICAL_MULTIPLIER);
      setCalibrationLengthInput("20");
      setHoverPdf(null);
      setRowMeasurements({});
      setPathVisibilityMode("active");
      configLoadedRef.current = false;
      previousRowIdRef.current = null;
      previousRowWireKeyRef.current = "";
      setPageState(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !projectIdFromEndpoint || configLoadedRef.current) {
      return;
    }

    let cancelled = false;
    void fetch(
      `/api/projects/${encodeURIComponent(projectIdFromEndpoint)}/measurements/config?sheetKey=${encodeURIComponent(measurementSheetKey)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as MeasurementConfigPayload;
      })
      .then((payload) => {
        if (cancelled || !payload?.rows) {
          return;
        }
        setRowMeasurements(payload.rows);
        const activeRowId = targetRow?.rowId;
        if (activeRowId) {
          const savedMeasurement = payload.rows[activeRowId];
          if (savedMeasurement) {
            setPoints(savedMeasurement.points);
            setMeasurementMode(savedMeasurement.mode);
            setActivePageNumber(savedMeasurement.pageNumber);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load measurement config", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          configLoadedRef.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [measurementSheetKey, open, projectIdFromEndpoint, targetRow?.rowId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextRowId = targetRow?.rowId ?? null;
    const previousRowId = previousRowIdRef.current;

    if (previousRowId) {
      setRowMeasurements((current) => ({
        ...current,
        [previousRowId]: {
          rowId: previousRowId,
          wireKey:
            current[previousRowId]?.wireKey ||
            previousRowWireKeyRef.current ||
            previousRowId,
          pageNumber: activePageNumber,
          mode: measurementMode,
          points,
        },
      }));
    }

    if (!nextRowId) {
      previousRowIdRef.current = null;
      previousRowWireKeyRef.current = "";
      setPoints([]);
      return;
    }

    const savedMeasurement = rowMeasurements[nextRowId];
    if (savedMeasurement) {
      setPoints(savedMeasurement.points);
      setMeasurementMode(savedMeasurement.mode);
      setIsPathEnded(false);
      setActivePageNumber(savedMeasurement.pageNumber);
    } else {
      setPoints([]);
      setMeasurementMode("path");
      setIsPathEnded(false);
    }

    previousRowIdRef.current = nextRowId;
    previousRowWireKeyRef.current = activeWireKey || nextRowId;
  }, [open, targetRow?.rowId]);

  useEffect(() => {
    setPoints([]);
    setIsPathEnded(false);
    prevRenderScaleRef.current = 1;
    hasCenteredForPageRef.current = false;
    pointerSessionRef.current = null;
  }, [activePageNumber]);

  useEffect(() => {
    if (measurementMode !== "path") {
      setIsPathEnded(false);
    }
  }, [measurementMode]);

  useEffect(() => {
    if (!open || !layoutIndex || layoutIndex.pages.length === 0) return;
    setActivePageNumber((current) => {
      if (layoutIndex.pages.some((p) => p.pageNumber === current)) return current;
      if (typeof bestPageMatch.pageNumber === "number") return bestPageMatch.pageNumber;
      return sortedPageNumbers[0] ?? layoutIndex.pages[0].pageNumber;
    });
  }, [bestPageMatch.pageNumber, layoutIndex, open, sortedPageNumbers]);

  useEffect(() => {
    if (!open) return;
    if (typeof bestPageMatch.pageNumber === "number") setActivePageNumber(bestPageMatch.pageNumber);
  }, [bestPageMatch.pageNumber, open, targetRow?.rowId]);

  const inchesPerPdfUnit = useMemo(() => deriveInchesPerPdfUnit(), []);

  // Convert a point from PDF user-space to canvas pixel coordinates.
  // PDF Y=0 is at the bottom; canvas Y=0 is at the top.
  const toPx = (pdfX: number, pdfY: number): { x: number; y: number } | null => {
    if (!pageState) return null;
    return {
      x: pdfX * pageState.renderScale,
      y: (pageState.pdfHeight - pdfY) * pageState.renderScale,
    };
  };

  const activePathColor = useMemo(
    () => getColorFromWireKey(activeWireKey),
    [activeWireKey],
  );

  const buildPairs = useCallback((mode: MeasurementMode, measurementPoints: MeasurePoint[]) => {
    const pairs: Array<{ from: MeasurePoint; to: MeasurePoint }> = [];
    if (measurementPoints.length < 2) {
      return pairs;
    }

    if (mode === "fanout") {
      const source = measurementPoints[0];
      for (let index = 1; index < measurementPoints.length; index++) {
        pairs.push({ from: source, to: measurementPoints[index] });
      }
      return pairs;
    }

    for (let index = 1; index < measurementPoints.length; index++) {
      pairs.push({ from: measurementPoints[index - 1], to: measurementPoints[index] });
    }
    return pairs;
  }, []);

  const pointMetrics = useMemo<{ total: number; segments: SegmentMetric[] }>(() => {
    if (!pageState || points.length < 2) return { total: 0, segments: [] };

    const { pdfHeight, renderScale } = pageState;
    let total = 0;
    const segments: SegmentMetric[] = [];

    const pairs = buildPairs(measurementMode, points);

    pairs.forEach(({ from, to }, index) => {
      const prev = from;
      const curr = to;

      // Distance in PDF user-space with per-axis calibration multipliers.
      const dxInches = Math.abs(curr.pdfX - prev.pdfX) * inchesPerPdfUnit * horizontalMultiplier;
      const dyInches = Math.abs(curr.pdfY - prev.pdfY) * inchesPerPdfUnit * verticalMultiplier;
      const lengthInches = Math.hypot(dxInches, dyInches);

      const prevPx = { x: prev.pdfX * renderScale, y: (pdfHeight - prev.pdfY) * renderScale };
      const currPx = { x: curr.pdfX * renderScale, y: (pdfHeight - curr.pdfY) * renderScale };

      total += lengthInches;
      segments.push({
        id: `${measurementMode}-${index}-${prev.id}-${curr.id}`,
        lengthInches,
        midX: (prevPx.x + currPx.x) / 2,
        midY: (prevPx.y + currPx.y) / 2,
      });
    });

    return { total, segments };
  }, [buildPairs, horizontalMultiplier, inchesPerPdfUnit, measurementMode, pageState, points, verticalMultiplier]);

  const segmentRenderItems = useMemo<SegmentRenderItem[]>(() => {
    if (!pageState || points.length < 2) {
      return [];
    }

    const segments: SegmentRenderItem[] = [];
    const pairs = buildPairs(measurementMode, points);

    pairs.forEach(({ from, to }, index) => {
      const fromPx = toPx(from.pdfX, from.pdfY);
      const toPxPoint = toPx(to.pdfX, to.pdfY);
      const segmentMetric = pointMetrics.segments[index];
      if (!fromPx || !toPxPoint || !segmentMetric) {
        return;
      }

      segments.push({
        id: segmentMetric.id,
        fromX: fromPx.x,
        fromY: fromPx.y,
        toX: toPxPoint.x,
        toY: toPxPoint.y,
        lengthInches: segmentMetric.lengthInches,
        midX: segmentMetric.midX,
        midY: segmentMetric.midY,
      });
    });

    return segments;
  }, [buildPairs, measurementMode, pageState, pointMetrics.segments, points]);

  const allPathSegments = useMemo(() => {
    if (!pageState || pathVisibilityMode !== "all") {
      return [] as Array<{
        id: string;
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
        color: string;
        isActive: boolean;
      }>;
    }

    const activeRowId = targetRow?.rowId ?? null;
    const activeEntry: StoredRowMeasurement | null = activeRowId
      ? {
          rowId: activeRowId,
          wireKey: activeWireKey || activeRowId,
          pageNumber: activePageNumber,
          mode: measurementMode,
          points,
        }
      : null;

    const entries = [
      ...Object.values(rowMeasurements),
      ...(activeEntry ? [activeEntry] : []),
    ];

    return entries.flatMap((entry, entryIndex) => {
      if (entry.pageNumber !== activePageNumber || entry.points.length < 2) {
        return [];
      }

      const pairs = buildPairs(entry.mode, entry.points);
      const color = getColorFromWireKey(entry.wireKey || entry.rowId);
      const isActive = entry.rowId === activeRowId;

      return pairs
        .map((pair, pairIndex) => {
          const fromPx = toPx(pair.from.pdfX, pair.from.pdfY);
          const toPxPoint = toPx(pair.to.pdfX, pair.to.pdfY);
          if (!fromPx || !toPxPoint) {
            return null;
          }

          return {
            id: `overlay-${entryIndex}-${pairIndex}-${pair.from.id}-${pair.to.id}`,
            fromX: fromPx.x,
            fromY: fromPx.y,
            toX: toPxPoint.x,
            toY: toPxPoint.y,
            color,
            isActive,
          };
        })
        .filter((segment): segment is NonNullable<typeof segment> => Boolean(segment));
    });
  }, [
    activePageNumber,
    activeWireKey,
    measurementMode,
    pageState,
    pathVisibilityMode,
    points,
    rowMeasurements,
    targetRow?.rowId,
  ]);

  const lastSegmentCalibration = useMemo(() => {
    if (!pageState || points.length < 2) {
      return { baseXInches: 0, baseYInches: 0, suggestedHorizontal: null as number | null, suggestedVertical: null as number | null };
    }

    let start: MeasurePoint | null = null;
    let end: MeasurePoint | null = null;

    if (measurementMode === "fanout") {
      start = points[0] ?? null;
      end = points[points.length - 1] ?? null;
    } else {
      start = points[points.length - 2] ?? null;
      end = points[points.length - 1] ?? null;
    }

    if (!start || !end) {
      return { baseXInches: 0, baseYInches: 0, suggestedHorizontal: null as number | null, suggestedVertical: null as number | null };
    }

    const baseXInches = Math.abs(end.pdfX - start.pdfX) * inchesPerPdfUnit;
    const baseYInches = Math.abs(end.pdfY - start.pdfY) * inchesPerPdfUnit;
    const knownLength = Number(calibrationLengthInput);
    const valid = Number.isFinite(knownLength) && knownLength > 0;

    return {
      baseXInches,
      baseYInches,
      suggestedHorizontal: valid && baseXInches > 0 ? knownLength / baseXInches : null,
      suggestedVertical: valid && baseYInches > 0 ? knownLength / baseYInches : null,
    };
  }, [calibrationLengthInput, inchesPerPdfUnit, measurementMode, pageState, points]);

  const roundedTotal = roundToNearestIncrement(pointMetrics.total, ROUND_INCREMENT_IN);

  const togglePopover = useCallback((key: string) => {
    setOpenPopovers((prev) => ({
      ...Object.keys(prev).reduce((acc, k) => ({ ...acc, [k]: false }), {}),
      [key]: !prev[key],
    }));
  }, []);

  // --- Handlers ---

  const addPointAt = (clientX: number, clientY: number) => {
    if (!pageState || !canvasRef.current) return;
    if (measurementMode === "path" && isPathEnded) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const canvasW = pageState.pdfWidth * pageState.renderScale;
    const canvasH = pageState.pdfHeight * pageState.renderScale;
    if (px < 0 || py < 0 || px > canvasW || py > canvasH) return;
    setPoints((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        pdfX: px / pageState.renderScale,
        pdfY: pageState.pdfHeight - py / pageState.renderScale,
      },
    ]);
  };

  const endCurrentPath = useCallback(() => {
    if (measurementMode !== "path" || points.length < 2) {
      return;
    }
    setIsPathEnded(true);
    setHoverPdf(null);
  }, [measurementMode, points.length]);

  const resumeCurrentPath = useCallback(() => {
    if (measurementMode !== "path") {
      return;
    }
    setIsPathEnded(false);
  }, [measurementMode]);

  const undoLastPoint = useCallback(() => {
    setPoints((previousPoints) => {
      const next = previousPoints.slice(0, -1);
      if (next.length < 2) {
        setIsPathEnded(false);
      }
      return next;
    });
  }, []);

  const clearMeasurements = useCallback(() => {
    setPoints([]);
    setIsPathEnded(false);
    setHoverPdf(null);
  }, []);

  const handlePointerDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewportRef.current) {
      return;
    }

    pointerSessionRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewportRef.current.scrollLeft,
      startScrollTop: viewportRef.current.scrollTop,
      dragged: false,
    };
  };

  const handlePointerUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const pointer = pointerSessionRef.current;
    pointerSessionRef.current = null;
    if (!pointer) {
      return;
    }

    if (!pointer.dragged) {
      addPointAt(event.clientX, event.clientY);
    }
  };

  const updateHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pageState || !canvasRef.current) {
      setHoverPdf(null);
      return;
    }

    if (measurementMode === "path" && isPathEnded) {
      setHoverPdf(null);
      return;
    }

    if (viewportRef.current && pointerSessionRef.current) {
      const drag = pointerSessionRef.current;
      const deltaX = event.clientX - drag.startClientX;
      const deltaY = event.clientY - drag.startClientY;
      if (!drag.dragged && Math.hypot(deltaX, deltaY) > 4) {
        drag.dragged = true;
      }
      if (drag.dragged) {
        viewportRef.current.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startClientX);
        viewportRef.current.scrollTop = drag.startScrollTop - (event.clientY - drag.startClientY);
        setHoverPdf(null);
        return;
      }
    }

    const rect = canvasRef.current.getBoundingClientRect();
    setHoverPdf({
      pdfX: (event.clientX - rect.left) / pageState.renderScale,
      pdfY: pageState.pdfHeight - (event.clientY - rect.top) / pageState.renderScale,
    });
  };

  const handleViewportWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !pageState) {
      return;
    }

    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }

    event.preventDefault();
    const viewport = viewportRef.current;
    const rect = viewport.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    zoomAnchorRef.current = {
      pdfX: (viewport.scrollLeft + clientX) / pageState.renderScale,
      pdfY: (viewport.scrollTop + clientY) / pageState.renderScale,
    };

    const direction = event.deltaY < 0 ? 1 : -1;
    setZoom((current) => {
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + direction * ZOOM_STEP));
      return next;
    });
  };

  const saveCurrentRowMeasurement = () => {
    const rowId = targetRow?.rowId;
    if (!rowId) {
      return;
    }

    setRowMeasurements((current) => {
      const next = {
        ...current,
        [rowId]: {
          rowId,
          wireKey: activeWireKey || rowId,
          pageNumber: activePageNumber,
          mode: measurementMode,
          points,
        },
      };
      void saveMeasurementsConfig(next);
      return next;
    });
  };

  const applyCurrentLength = () => {
    if (!canApply) {
      return;
    }
    onApply(roundedTotal);
    saveCurrentRowMeasurement();
  };

  const saveCurrentMeasurement = () => {
    if (canApply) {
      onApply(roundedTotal);
    }
    saveCurrentRowMeasurement();
  };

  const handleGoToPreviousRow = () => {
    applyCurrentLength();
    onGoToPreviousRow?.();
  };

  const handleGoToNextRow = () => {
    applyCurrentLength();
    onGoToNextRow?.();
  };

  const handleCloseDialog = () => {
    saveCurrentMeasurement();
    onOpenChange(false);
  };

  const applyHorizontalCalibration = () => {
    const v = lastSegmentCalibration.suggestedHorizontal;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) setHorizontalMultiplier(v);
  };

  const applyVerticalCalibration = () => {
    const v = lastSegmentCalibration.suggestedVertical;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) setVerticalMultiplier(v);
  };

  // Applies calibration to whichever axis dominates the last drawn segment,
  // so the user doesn't have to decide between X and Y manually.
  const applyDominantAxisCalibration = () => {
    const { baseXInches, baseYInches, suggestedHorizontal, suggestedVertical } = lastSegmentCalibration;
    if (baseXInches >= baseYInches) {
      if (typeof suggestedHorizontal === "number" && suggestedHorizontal > 0) setHorizontalMultiplier(suggestedHorizontal);
    } else {
      if (typeof suggestedVertical === "number" && suggestedVertical > 0) setVerticalMultiplier(suggestedVertical);
    }
  };

  const canMeasure = Boolean(activePage && pageState);
  const canApply = points.length >= 2 && roundedTotal > 0;
  const currentPageIndex = sortedPageNumbers.findIndex((p) => p === activePageNumber);
  const hasPreviousPage = currentPageIndex > 0;
  const hasNextPage = currentPageIndex >= 0 && currentPageIndex < sortedPageNumbers.length - 1;
  const canvasW = pageState ? pageState.pdfWidth * pageState.renderScale : 0;
  const canvasH = pageState ? pageState.pdfHeight * pageState.renderScale : 0;
  const hoverPx = hoverPdf ? toPx(hoverPdf.pdfX, hoverPdf.pdfY) : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!["e", "r", "u", "c", "s", "n"].includes(key)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      switch (key) {
        case "e":
          endCurrentPath();
          break;
        case "r":
          resumeCurrentPath();
          break;
        case "u":
          if (points.length > 0) {
            undoLastPoint();
          }
          break;
        case "c":
          if (points.length > 0) {
            clearMeasurements();
          }
          break;
        case "s":
          saveCurrentMeasurement();
          break;
        case "n":
          if (canGoNextRow) {
            handleGoToNextRow();
          }
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canGoNextRow,
    clearMeasurements,
    endCurrentPath,
    handleGoToNextRow,
    open,
    points.length,
    resumeCurrentPath,
    saveCurrentMeasurement,
    undoLastPoint,
  ]);

  useEffect(() => {
    const lensCanvas = lensCanvasRef.current;
    const sourceCanvas = canvasRef.current;
    if (!lensCanvas || !sourceCanvas || !hoverPx) {
      return;
    }

    const context = lensCanvas.getContext("2d");
    if (!context) {
      return;
    }

    const sampleSize = LENS_SIZE_PX / LENS_ZOOM;
    const sx = Math.max(0, Math.min(sourceCanvas.width - sampleSize, hoverPx.x - sampleSize / 2));
    const sy = Math.max(0, Math.min(sourceCanvas.height - sampleSize, hoverPx.y - sampleSize / 2));

    context.clearRect(0, 0, LENS_SIZE_PX, LENS_SIZE_PX);
    context.drawImage(
      sourceCanvas,
      sx,
      sy,
      sampleSize,
      sampleSize,
      0,
      0,
      LENS_SIZE_PX,
      LENS_SIZE_PX,
    );
    context.strokeStyle = "rgba(220, 38, 38, 0.95)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(LENS_SIZE_PX / 2, 0);
    context.lineTo(LENS_SIZE_PX / 2, LENS_SIZE_PX);
    context.moveTo(0, LENS_SIZE_PX / 2);
    context.lineTo(LENS_SIZE_PX, LENS_SIZE_PX / 2);
    context.stroke();
  }, [hoverPx]);

  useEffect(() => {
    if (!viewportRef.current || !pageState || !activePage) {
      return;
    }

    const viewport = viewportRef.current;
    const renderScale = pageState.renderScale;
    const pageChanged = lastRenderedPageRef.current !== activePage.pageNumber;

    if (pageChanged) {
      lastRenderedPageRef.current = activePage.pageNumber;
      prevRenderScaleRef.current = renderScale;
      hasCenteredForPageRef.current = false;
    }

    if (!hasCenteredForPageRef.current) {
      viewport.scrollLeft = Math.max(0, (canvasW - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (canvasH - viewport.clientHeight) / 2);
      hasCenteredForPageRef.current = true;
      return;
    }

    const previousScale = prevRenderScaleRef.current;
    if (Math.abs(previousScale - renderScale) < 0.0001 || previousScale <= 0) {
      prevRenderScaleRef.current = renderScale;
      return;
    }

    const zoomAnchor = zoomAnchorRef.current;
    if (zoomAnchor) {
      zoomAnchorRef.current = null;
      viewport.scrollLeft = Math.max(0, zoomAnchor.pdfX * renderScale - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, zoomAnchor.pdfY * renderScale - viewport.clientHeight / 2);
      prevRenderScaleRef.current = renderScale;
      return;
    }

    const centerPdfX = (viewport.scrollLeft + viewport.clientWidth / 2) / previousScale;
    const centerPdfY = (viewport.scrollTop + viewport.clientHeight / 2) / previousScale;
    viewport.scrollLeft = Math.max(0, centerPdfX * renderScale - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, centerPdfY * renderScale - viewport.clientHeight / 2);
    prevRenderScaleRef.current = renderScale;
  }, [activePage, canvasH, canvasW, pageState]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-80 flex flex-col overflow-hidden bg-black/50">
      <div className="relative m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Manual Measurement</div>
            <div className="text-sm font-semibold">
              {activePage?.title || "Layout PDF"}
              {activePage ? ` — Page ${activePage.pageNumber}` : ""}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{bestPageMatch.reason}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMeasurementMode((current) => (current === "path" ? "fanout" : "path"))}
            >
              {measurementMode === "path" ? "Path Mode" : "Fan-out Mode"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))}>
              <ZoomOut className="mr-1 h-4 w-4" />
              Zoom Out
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))}>
              <ZoomIn className="mr-1 h-4 w-4" />
              Zoom In
            </Button>
            <div className="w-14 text-right text-xs text-muted-foreground">{Math.round(zoom * 100)}%</div>
            <Button type="button" variant="outline" size="sm" onClick={handleCloseDialog}>
              Close
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="relative min-h-0 flex-1">

          {/* Canvas panel */}
          <div className="h-full min-h-0 bg-muted/20">
            <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
              <div>
                {measurementMode === "path"
                  ? `Path mode: each new click extends the previous segment (1→2→3...). E end${isPathEnded ? " (ended)" : ""} · R resume · U undo · C clear · S save · N next row.`
                  : "Fan-out mode: first click sets source; each endpoint click adds a branch. U undo · C clear · S save · N next row."}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={measurementMode !== "path" || points.length < 2 || isPathEnded}
                  onClick={endCurrentPath}
                >
                  End Path (E)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={measurementMode !== "path" || !isPathEnded}
                  onClick={resumeCurrentPath}
                >
                  Resume (R)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={points.length === 0}
                  onClick={undoLastPoint}
                >
                  <Undo2 className="mr-1 h-4 w-4" />
                  Undo (U)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={points.length === 0}
                  onClick={clearMeasurements}
                >
                  <Eraser className="mr-1 h-4 w-4" />
                  Clear (C)
                </Button>
              </div>
            </div>

            <div ref={viewportRef} className="h-full min-h-0 overflow-auto p-3 pb-72" onWheel={handleViewportWheel}>
              <div className="flex min-h-full min-w-full items-center justify-center">
                {loadingPayload ? (
                  <div className="text-sm text-muted-foreground">Loading layout…</div>
                ) : pdfLoadError ? (
                  <div className="text-sm text-destructive">{pdfLoadError}</div>
                ) : !payload?.pdf?.url || !layoutIndex ? (
                  <div className="text-sm text-muted-foreground">Layout PDF is unavailable for this project.</div>
                ) : (
                  <div
                    className={
                      pointerSessionRef.current?.dragged
                        ? "relative cursor-grabbing select-none"
                        : "relative cursor-grab select-none"
                    }
                    style={pageState ? { width: canvasW, height: canvasH } : undefined}
                    role="button"
                    tabIndex={0}
                    onMouseDown={handlePointerDown}
                    onMouseUp={handlePointerUp}
                    onMouseMove={updateHover}
                    onMouseLeave={() => {
                      setHoverPdf(null);
                      pointerSessionRef.current = null;
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
                  >
                    <canvas ref={canvasRef} className="bg-white" />

                    {pageState ? (
                      <svg className="pointer-events-none absolute inset-0" width={canvasW} height={canvasH}>
                        {allPathSegments.map((segment) => (
                          <line
                            key={segment.id}
                            x1={segment.fromX}
                            y1={segment.fromY}
                            x2={segment.toX}
                            y2={segment.toY}
                            stroke={segment.color}
                            strokeWidth={segment.isActive ? 2.4 : 1.7}
                            opacity={segment.isActive ? 0.95 : 0.45}
                          />
                        ))}
                        {/* Confirmed segments and point markers */}
                        {(pathVisibilityMode === "active" ? segmentRenderItems : []).map((seg) => (
                          <g key={seg.id}>
                            <line x1={seg.fromX} y1={seg.fromY} x2={seg.toX} y2={seg.toY} stroke={activePathColor} strokeWidth={2} />
                            <rect
                              x={seg.midX - 24}
                              y={seg.midY - 9}
                              width={48}
                              height={16}
                              rx={3}
                              fill="rgba(0,0,0,0.65)"
                            />
                            <text
                              x={seg.midX}
                              y={seg.midY + 4}
                              fill="white"
                              fontSize={10}
                              fontWeight={600}
                              textAnchor="middle"
                            >
                              {seg.lengthInches.toFixed(1)}&quot;
                            </text>
                          </g>
                        ))}
                        {points.map((point, index) => {
                          const cpx = toPx(point.pdfX, point.pdfY);
                          if (!cpx) return null;

                          return (
                            <g key={point.id}>
                              <circle cx={cpx.x} cy={cpx.y} r={5} fill="#0ea5e9" stroke="white" strokeWidth={1.5} />
                              <text x={cpx.x + 9} y={cpx.y - 9} fill="#0f172a" fontSize={11} fontWeight={700}>
                                {measurementMode === "fanout" && index === 0 ? "S" : index + 1}
                              </text>
                            </g>
                          );
                        })}

                        {/* Ghost point — shows where the next click will land */}
                        {hoverPdf ? (() => {
                          const ghost = toPx(hoverPdf.pdfX, hoverPdf.pdfY);
                          if (!ghost) return null;
                          const sourcePt = points.length > 0 ? points[0] : null;
                          const pendingPathStart =
                            measurementMode === "path" && points.length > 0
                              ? points[points.length - 1]
                              : null;
                          const guideStart = measurementMode === "fanout" ? sourcePt : pendingPathStart;
                          const lastPx = guideStart ? toPx(guideStart.pdfX, guideStart.pdfY) : null;
                          return (
                            <g>
                              {lastPx ? (
                                <line
                                  x1={lastPx.x}
                                  y1={lastPx.y}
                                  x2={ghost.x}
                                  y2={ghost.y}
                                  stroke={activePathColor}
                                  strokeWidth={1.5}
                                  strokeDasharray="4 3"
                                  opacity={0.55}
                                />
                              ) : null}
                              <circle cx={ghost.x} cy={ghost.y} r={4} fill="transparent" stroke="#0ea5e9" strokeWidth={2} opacity={0.7} />
                            </g>
                          );
                        })() : null}
                      </svg>
                    ) : null}
                    {hoverPx ? (
                      <div
                        className="pointer-events-none absolute z-20 overflow-hidden rounded-xl border-4 border-red-600 bg-white shadow-xl"
                        style={{
                          left: Math.min(canvasW - LENS_SIZE_PX - 8, hoverPx.x + 14),
                          top: Math.max(8, hoverPx.y - LENS_SIZE_PX - 14),
                          width: LENS_SIZE_PX,
                          height: LENS_SIZE_PX,
                        }}
                      >
                        <canvas
                          ref={lensCanvasRef}
                          width={LENS_SIZE_PX}
                          height={LENS_SIZE_PX}
                          className="h-full w-full"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Horizontal Toolbar - Similar to the Brand List toolbar */}
          <div className="absolute inset-x-0 bottom-3 z-30 mx-auto flex w-[calc(100%-1.25rem)] items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/94 px-4 py-3 shadow-2xl backdrop-blur-md">
            
            {/* Left Section - Status */}
            <div className="flex items-center gap-3">
              {rowPosition ? (
                <div className="text-sm font-medium text-muted-foreground">
                  Row {rowPosition.current} of {rowPosition.total}
                </div>
              ) : null}
              {targetRow ? (
                <div className="text-sm font-medium">
                  {targetRow.fromDeviceId || "Unknown"} → {targetRow.toDeviceId || "Unknown"}
                </div>
              ) : null}
            </div>

            {/* Center Section - Controls */}
            <div className="flex items-center gap-2">
              {/* Total Popover */}
              <Popover open={openPopovers.total} onOpenChange={(open) => setOpenPopovers((prev) => ({ ...prev, total: open }))}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={openPopovers.total ? "secondary" : "outline"}>
                    Total: {pointMetrics.total.toFixed(2)}"
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total</div>
                    <div className="mt-2 text-2xl font-semibold">{pointMetrics.total.toFixed(2)} in</div>
                    <div className="text-sm text-muted-foreground">
                      Rounded to nearest {ROUND_INCREMENT_IN}: <span className="font-medium text-foreground">{roundedTotal} in</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {measurementMode === "path"
                        ? "Path mode totals connected segments."
                        : `Fan-out mode totals ${Math.max(pointMetrics.segments.length, 0)} branch${pointMetrics.segments.length === 1 ? "" : "es"} from the source.`}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Path Visibility Popover */}
              <Popover open={openPopovers.visibility} onOpenChange={(open) => setOpenPopovers((prev) => ({ ...prev, visibility: open }))}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={openPopovers.visibility ? "secondary" : "outline"}>
                    {pathVisibilityMode === "all" ? "All Paths" : "Active Only"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Path Visibility</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={pathVisibilityMode === "all" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPathVisibilityMode("all")}
                      >
                        Show All
                      </Button>
                      <Button
                        type="button"
                        variant={pathVisibilityMode === "active" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPathVisibilityMode("active")}
                      >
                        Show Active
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Calibration Popover */}
              <Popover open={openPopovers.calibration} onOpenChange={(open) => setOpenPopovers((prev) => ({ ...prev, calibration: open }))}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={openPopovers.calibration ? "secondary" : "outline"}>
                    Calibrate
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" side="top">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Calibration</div>
                    <div className="mt-2 text-sm">
                      Base scale uses PDF units. Draw a known-length segment and calibrate.
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      H ×{horizontalMultiplier.toFixed(4)} · V ×{verticalMultiplier.toFixed(4)}
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <Input
                        value={calibrationLengthInput}
                        onChange={(e) => setCalibrationLengthInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="Known length (in)"
                        className="h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setHorizontalMultiplier(DEFAULT_HORIZONTAL_MULTIPLIER);
                          setVerticalMultiplier(DEFAULT_VERTICAL_MULTIPLIER);
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={typeof lastSegmentCalibration.suggestedHorizontal !== "number"}
                        onClick={applyHorizontalCalibration}
                      >
                        X Axis
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={typeof lastSegmentCalibration.suggestedVertical !== "number"}
                        onClick={applyVerticalCalibration}
                      >
                        Y Axis
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={points.length < 2}
                        onClick={applyDominantAxisCalibration}
                        title="Apply to whichever axis dominates the last segment"
                      >
                        Auto
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Draw a known-length segment, enter its true length above, then calibrate. <em>Auto</em> picks the dominant axis automatically.
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Segments Popover */}
              <Popover open={openPopovers.segments} onOpenChange={(open) => setOpenPopovers((prev) => ({ ...prev, segments: open }))}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={openPopovers.segments ? "secondary" : "outline"}>
                    {pointMetrics.segments.length} Segments
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Segments</div>
                    {pointMetrics.segments.length === 0 ? (
                      <div className="mt-2 text-sm text-muted-foreground">Add at least two points to create a segment.</div>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {pointMetrics.segments.map((seg, index) => (
                          <div key={seg.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                            <span className="text-muted-foreground">Segment {index + 1}</span>
                            <span className="font-medium">{seg.lengthInches.toFixed(2)} in</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Right Section - Navigation & Actions */}
            <div className="flex items-center gap-2">
              {/* Page Navigation */}
              <Popover open={openPopovers.pageNav} onOpenChange={(open) => setOpenPopovers((prev) => ({ ...prev, pageNav: open }))}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={openPopovers.pageNav ? "secondary" : "outline"}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Prev
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canMeasure || !hasPreviousPage}
                        onClick={() => { if (hasPreviousPage) setActivePageNumber(sortedPageNumbers[currentPageIndex - 1]); }}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Prev Page
                      </Button>
                      <div className="text-xs font-medium">
                        Page {activePageNumber}{pageCount ? ` / ${pageCount}` : ""}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canMeasure || !hasNextPage}
                        onClick={() => { if (hasNextPage) setActivePageNumber(sortedPageNumbers[currentPageIndex + 1]); }}
                      >
                        Next Page
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="text-sm text-muted-foreground">
                Page {activePageNumber}{pageCount ? ` / ${pageCount}` : ""}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={() => { if (hasNextPage) setActivePageNumber(sortedPageNumbers[currentPageIndex + 1]); }} disabled={!canMeasure || !hasNextPage}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>

              {/* Row Navigation */}
              {rowPosition && canGoNextRow ? (
                <Button type="button" variant="outline" size="sm" onClick={handleGoToNextRow}>
                  Next Row (N)
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : null}

              {/* Primary Actions */}
              <Button
                type="button"
                disabled={!canApply}
                size="sm"
                onClick={() => { applyCurrentLength(); handleCloseDialog(); }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
