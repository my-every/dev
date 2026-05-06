"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Undo2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LayoutPageIndexItem, LayoutPagesIndexDocument } from "@/lib/layout-matching";

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
    bundleDisplay?: string | null;
  } | null;
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

const ROUND_INCREMENT_IN = 10;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

// Singleton loader — avoids re-initialising pdfjs-dist across renders.
let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = import("pdfjs-dist").then((lib) => {
    // new URL() with import.meta.url is resolved by webpack 5 into a proper
    // hashed asset URL so the worker binary is served from the same bundle.
    lib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    return lib;
  });
  return pdfJsPromise;
}

// --- Pure helpers ---

function parseInchesFromRailLabel(label: string): number | null {
  const match = label.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function toMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function roundToNearestIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value) || value <= 0 || increment <= 0) return 0;
  return Math.round(value / increment) * increment;
}

function deriveInchesPerPdfUnit(page: LayoutPageIndexItem | null): number {
  if (!page) return 1 / 72;

  const ratios = page.rails
    .map((rail) => {
      const declaredInches = parseInchesFromRailLabel(rail.railLabel);
      const span =
        typeof rail.spanXStart === "number" && typeof rail.spanXEnd === "number"
          ? Math.abs(rail.spanXEnd - rail.spanXStart)
          : 0;
      if (!declaredInches || span < 1) return null;
      return declaredInches / span;
    })
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);

  return ratios.length === 0 ? 1 / 72 : toMedian(ratios);
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
  onOpenChange,
  onApply,
}: BrandRowMeasurementDialogProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tracks the render scale from the previous paint to compute scroll correction.
  const prevRenderScaleRef = useRef(1);

  const [loadingPayload, setLoadingPayload] = useState(false);
  const [payload, setPayload] = useState<LayoutWorkspacePayload | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDocument, setPdfDocument] = useState<any | null>(null);
  const [activePageNumber, setActivePageNumber] = useState(initialPageNumber ?? 1);
  const [zoom, setZoom] = useState(1);
  const [horizontalMultiplier, setHorizontalMultiplier] = useState(1);
  const [verticalMultiplier, setVerticalMultiplier] = useState(1);
  const [calibrationLengthInput, setCalibrationLengthInput] = useState("20");
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  // Tracks mouse position over the canvas in PDF coords for the ghost-point preview.
  const [hoverPdf, setHoverPdf] = useState<{ pdfX: number; pdfY: number } | null>(null);

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
    if (!open || !pdfUrl) { setPdfDocument(null); return; }

    let cancelled = false;

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url: pdfUrl }).promise)
      .then((doc) => { if (!cancelled) setPdfDocument(doc); })
      .catch((err) => { console.error("Failed to load PDF for measurement", err); });

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

    const renderPage = async () => {
      const page = await pdfDocument.getPage(activePage.pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });

      const fitScale = Math.max(
        0.1,
        Math.min(
          (viewportSize.width - 32) / baseViewport.width,
          (viewportSize.height - 32) / baseViewport.height,
        ),
      );
      const renderScale = fitScale * zoom;
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      await page.render({ canvasContext: context, viewport }).promise;

      if (!cancelled) {
        setPageState({
          pdfWidth: baseViewport.width,
          pdfHeight: baseViewport.height,
          renderScale,
        });
      }
    };

    void renderPage();
    return () => { cancelled = true; };
  }, [activePage, open, pdfDocument, viewportSize.height, viewportSize.width, zoom]);

  // When zoom changes the canvas grows or shrinks; keep the same content
  // pixel centred in the scroll viewport.
  useEffect(() => {
    if (!open || !viewportRef.current || !pageState) {
      prevRenderScaleRef.current = pageState?.renderScale ?? 1;
      return;
    }

    const vp = viewportRef.current;
    const prev = prevRenderScaleRef.current;
    const next = pageState.renderScale;

    if (prev !== next && prev > 0) {
      const centerPdfX = (vp.scrollLeft + vp.clientWidth / 2) / prev;
      const centerPdfY = (vp.scrollTop + vp.clientHeight / 2) / prev;
      vp.scrollLeft = Math.max(0, centerPdfX * next - vp.clientWidth / 2);
      vp.scrollTop = Math.max(0, centerPdfY * next - vp.clientHeight / 2);
    }

    prevRenderScaleRef.current = next;
  }, [open, pageState]);

  useEffect(() => {
    if (!open) {
      setPoints([]);
      setZoom(1);
      prevRenderScaleRef.current = 1;
      setHorizontalMultiplier(1);
      setVerticalMultiplier(1);
      setCalibrationLengthInput("20");
      setHoverPdf(null);
      setPageState(null);
    }
  }, [open]);

  useEffect(() => { setPoints([]); }, [activePageNumber]);

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

  const inchesPerPdfUnit = useMemo(() => deriveInchesPerPdfUnit(activePage), [activePage]);

  // Convert a point from PDF user-space to canvas pixel coordinates.
  // PDF Y=0 is at the bottom; canvas Y=0 is at the top.
  const toPx = (pdfX: number, pdfY: number): { x: number; y: number } | null => {
    if (!pageState) return null;
    return {
      x: pdfX * pageState.renderScale,
      y: (pageState.pdfHeight - pdfY) * pageState.renderScale,
    };
  };

  const pointMetrics = useMemo<{ total: number; segments: SegmentMetric[] }>(() => {
    if (!pageState || points.length < 2) return { total: 0, segments: [] };

    const { pdfHeight, renderScale } = pageState;
    let total = 0;
    const segments: SegmentMetric[] = [];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Distance in PDF user-space with per-axis calibration multipliers.
      const dxInches = Math.abs(curr.pdfX - prev.pdfX) * inchesPerPdfUnit * horizontalMultiplier;
      const dyInches = Math.abs(curr.pdfY - prev.pdfY) * inchesPerPdfUnit * verticalMultiplier;
      const lengthInches = Math.hypot(dxInches, dyInches);

      const prevPx = { x: prev.pdfX * renderScale, y: (pdfHeight - prev.pdfY) * renderScale };
      const currPx = { x: curr.pdfX * renderScale, y: (pdfHeight - curr.pdfY) * renderScale };

      total += lengthInches;
      segments.push({
        id: `${prev.id}-${curr.id}`,
        lengthInches,
        midX: (prevPx.x + currPx.x) / 2,
        midY: (prevPx.y + currPx.y) / 2,
      });
    }

    return { total, segments };
  }, [horizontalMultiplier, inchesPerPdfUnit, pageState, points, verticalMultiplier]);

  const lastSegmentCalibration = useMemo(() => {
    if (!pageState || points.length < 2) {
      return { baseXInches: 0, baseYInches: 0, suggestedHorizontal: null as number | null, suggestedVertical: null as number | null };
    }

    const start = points[points.length - 2];
    const end = points[points.length - 1];
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
  }, [calibrationLengthInput, inchesPerPdfUnit, pageState, points]);

  const roundedTotal = roundToNearestIncrement(pointMetrics.total, ROUND_INCREMENT_IN);

  // --- Handlers ---

  const addPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pageState || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
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

  const updateHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pageState || !canvasRef.current) { setHoverPdf(null); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    setHoverPdf({
      pdfX: (event.clientX - rect.left) / pageState.renderScale,
      pdfY: pageState.pdfHeight - (event.clientY - rect.top) / pageState.renderScale,
    });
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
            <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))}>
              <ZoomOut className="mr-1 h-4 w-4" />
              Zoom Out
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))}>
              <ZoomIn className="mr-1 h-4 w-4" />
              Zoom In
            </Button>
            <div className="w-14 text-right text-xs text-muted-foreground">{Math.round(zoom * 100)}%</div>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]">

          {/* Canvas panel */}
          <div className="min-h-0 border-r bg-muted/20">
            <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
              <div>Click to place points — chain segments for total wire length.</div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={points.length === 0} onClick={() => setPoints((p) => p.slice(0, -1))}>
                  <Undo2 className="mr-1 h-4 w-4" />
                  Undo
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={points.length === 0} onClick={() => setPoints([])}>
                  <Eraser className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>

            <div ref={viewportRef} className="h-full min-h-0 overflow-auto p-3">
              <div className="flex min-h-full min-w-full items-start justify-center">
                {loadingPayload ? (
                  <div className="text-sm text-muted-foreground">Loading layout…</div>
                ) : !payload?.pdf?.url || !layoutIndex ? (
                  <div className="text-sm text-muted-foreground">Layout PDF is unavailable for this project.</div>
                ) : (
                  <div
                    className="relative cursor-crosshair select-none"
                    style={pageState ? { width: canvasW, height: canvasH } : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={addPoint}
                    onMouseMove={updateHover}
                    onMouseLeave={() => setHoverPdf(null)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
                  >
                    <canvas ref={canvasRef} className="bg-white" />

                    {pageState ? (
                      <svg className="pointer-events-none absolute inset-0" width={canvasW} height={canvasH}>
                        {/* Confirmed segments and point markers */}
                        {points.map((point, index) => {
                          const prev = index > 0 ? points[index - 1] : null;
                          const ppx = prev ? toPx(prev.pdfX, prev.pdfY) : null;
                          const cpx = toPx(point.pdfX, point.pdfY);
                          if (!cpx) return null;
                          const seg = index > 0 ? pointMetrics.segments[index - 1] : null;

                          return (
                            <g key={point.id}>
                              {ppx ? (
                                <>
                                  <line x1={ppx.x} y1={ppx.y} x2={cpx.x} y2={cpx.y} stroke="#e11d48" strokeWidth={2} />
                                  {seg ? (
                                    <>
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
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                              <circle cx={cpx.x} cy={cpx.y} r={5} fill="#0ea5e9" stroke="white" strokeWidth={1.5} />
                              <text x={cpx.x + 9} y={cpx.y - 9} fill="#0f172a" fontSize={11} fontWeight={700}>
                                {index + 1}
                              </text>
                            </g>
                          );
                        })}

                        {/* Ghost point — shows where the next click will land */}
                        {hoverPdf ? (() => {
                          const ghost = toPx(hoverPdf.pdfX, hoverPdf.pdfY);
                          if (!ghost) return null;
                          const lastPt = points.length > 0 ? points[points.length - 1] : null;
                          const lastPx = lastPt ? toPx(lastPt.pdfX, lastPt.pdfY) : null;
                          return (
                            <g>
                              {lastPx ? (
                                <line
                                  x1={lastPx.x}
                                  y1={lastPx.y}
                                  x2={ghost.x}
                                  y2={ghost.y}
                                  stroke="#e11d48"
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="min-h-0 space-y-3 overflow-auto p-4">

            {targetRow ? (
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Target Row</div>
                <div className="mt-2 text-sm font-medium">
                  {targetRow.fromDeviceId || "Unknown"} — {targetRow.toDeviceId || "Unknown"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Wire {targetRow.wireNo || "—"} | Location {targetRow.toLocation || "—"}
                </div>
                {targetRow.bundleDisplay ? (
                  <div className="mt-1 text-xs text-muted-foreground">Bundle {targetRow.bundleDisplay}</div>
                ) : null}
                {sheetName ? <div className="mt-1 text-xs text-muted-foreground">Sheet {sheetName}</div> : null}
              </div>
            ) : null}

            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total</div>
              <div className="mt-2 text-2xl font-semibold">{pointMetrics.total.toFixed(2)} in</div>
              <div className="text-sm text-muted-foreground">
                Rounded to nearest {ROUND_INCREMENT_IN}: <span className="font-medium text-foreground">{roundedTotal} in</span>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Calibration</div>
              <div className="mt-2 text-sm">
                {inchesPerPdfUnit === 1 / 72
                  ? "Using default PDF ratio. Add rail span metadata for drawing-scale calibration."
                  : `Rail-based scale: ${inchesPerPdfUnit.toFixed(4)} in/unit.`}
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
                  onClick={() => { setHorizontalMultiplier(1); setVerticalMultiplier(1); }}
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

            <div className="rounded-xl border bg-card p-4">
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

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canMeasure || !hasPreviousPage}
                  onClick={() => { if (hasPreviousPage) setActivePageNumber(sortedPageNumbers[currentPageIndex - 1]); }}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
                <div className="text-xs text-muted-foreground">
                  Page {activePageNumber}{pageCount ? ` / ${pageCount}` : ""}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canMeasure || !hasNextPage}
                  onClick={() => { if (hasNextPage) setActivePageNumber(sortedPageNumbers[currentPageIndex + 1]); }}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canApply}
                onClick={() => { onApply(roundedTotal); onOpenChange(false); }}
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
