"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { loadBrowserPdfJs } from "@/lib/layout-matching/extract-pdf-text";
import type { LayoutPagesIndexDocument } from "@/lib/layout-matching";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";


interface LayoutPdfWorkspaceProps {
  pdfUrl: string;
  layoutIndex: LayoutPagesIndexDocument;
  initialPageNumber?: number;
  initialHighlightQuery?: string;
  projectName?: string;
  projectNumber?: string;
  projectColor?: string;
  className?: string;
}

interface RenderedPageState {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface WorkspaceSize {
  width: number;
  height: number;
}

interface ViewerRegion {
  id: string;
  label: string;
  kind: "anchor" | "rail" | "panduct" | "device-cluster";
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ViewerTextItem {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SearchMatch {
  id: string;
  pageNumber: number;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WorkspaceCommandItem {
  id: string;
  label: string;
  value: string;
  meta: string;
  action: () => void;
}

function normalizeTerm(value: string) {
  return value.trim().toLowerCase();
}

export function LayoutPdfWorkspace({
  pdfUrl,
  layoutIndex,
  initialPageNumber,
  initialHighlightQuery,
  projectName,
  projectNumber,
  projectColor,
  className,
}: LayoutPdfWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const viewportHostRef = useRef<HTMLDivElement | null>(null);
  const commandRef = useRef<HTMLDivElement | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any | null>(null);
  const [activePageNumber, setActivePageNumber] = useState(
    initialPageNumber ?? layoutIndex.pages[0]?.pageNumber ?? 1,
  );
  const [zoom, setZoom] = useState(1);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [highlightQuery, setHighlightQuery] = useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [renderedPage, setRenderedPage] = useState<RenderedPageState | null>(
    null,
  );
  const [viewportSize, setViewportSize] = useState<ViewportSize>({
    width: 0,
    height: 0,
  });
  const [workspaceSize, setWorkspaceSize] = useState<WorkspaceSize>({
    width: 0,
    height: 0,
  });
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);

  useEffect(() => {
    if (!initialPageNumber) {
      return;
    }
    setActivePageNumber(initialPageNumber);
  }, [initialPageNumber]);

  useEffect(() => {
    if (!initialHighlightQuery?.trim()) {
      return;
    }
    setHighlightQuery(initialHighlightQuery);
    setActiveSearchMatchIndex(0);
  }, [initialHighlightQuery]);

  const activePage = useMemo(
    () =>
      layoutIndex.pages.find((page) => page.pageNumber === activePageNumber) ??
      layoutIndex.pages[0] ??
      null,
    [activePageNumber, layoutIndex.pages],
  );

  const filteredPages = useMemo(() => {
    const normalized = normalizeTerm(sidebarQuery);
    if (!normalized) {
      return layoutIndex.pages;
    }

    return layoutIndex.pages.filter((page) => {
      const haystack = [
        page.title,
        page.normalizedTitle,
        page.panelNumber,
        page.boxNumber,
        page.unitType,
        page.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [layoutIndex.pages, sidebarQuery]);

  useEffect(() => {
    let cancelled = false;

    loadBrowserPdfJs()
      .then((pdfjsLib) => pdfjsLib.getDocument(pdfUrl).promise)
      .then((document) => {
        if (!cancelled) {
          setPdfDocument(document);
        }
      })
      .catch((error) => {
        console.error("Failed to load layout PDF", error);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!viewportHostRef.current || !workspaceRef.current) {
      return;
    }

    const viewportElement = viewportHostRef.current;
    const workspaceElement = workspaceRef.current;
    const updateViewport = () => {
      setViewportSize((current) => {
        const next = {
          width: viewportElement.clientWidth,
          height: viewportElement.clientHeight,
        };

        if (current.width === next.width && current.height === next.height) {
          return current;
        }

        return next;
      });
      setWorkspaceSize((current) => {
        const next = {
          width: workspaceElement.clientWidth,
          height: workspaceElement.clientHeight,
        };

        if (current.width === next.width && current.height === next.height) {
          return current;
        }

        return next;
      });
    };
    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(viewportElement);
    observer.observe(workspaceElement);
    return () => observer.disconnect();
  }, []);

  const autoHideNavigator = workspaceSize.width > 0 && workspaceSize.width < 1120;
  const autoHideInspector = workspaceSize.width > 0 && workspaceSize.width < 1440;
  const showNavigator = navigatorOpen && !autoHideNavigator;
  const showInspector = detailsOpen && !autoHideInspector;

  useEffect(() => {
    if (!commandOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        commandRef.current &&
        !commandRef.current.contains(event.target as Node)
      ) {
        setCommandOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [commandOpen]);

  useEffect(() => {
    if (
      !pdfDocument ||
      !activePage ||
      !canvasRef.current ||
      !viewportSize.width ||
      !viewportSize.height
    ) {
      return;
    }

    let cancelled = false;

    const renderPage = async () => {
      const page = await pdfDocument.getPage(activePage.pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.max(
        0.2,
        Math.min(
          (viewportSize.width - 24) / baseViewport.width,
          (viewportSize.height - 24) / baseViewport.height,
        ),
      );
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      await page.render({ canvasContext: context, viewport }).promise;

      if (!cancelled) {
        setRenderedPage({ width: viewport.width, height: viewport.height });
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [activePage, pdfDocument, viewportSize, zoom]);

  useEffect(() => {
    const viewport = viewportHostRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activePageNumber]);

  const searchMatches = useMemo<SearchMatch[]>(() => {
    const needle = normalizeTerm(highlightQuery);
    if (!needle) {
      return [];
    }

    return layoutIndex.pages.flatMap((page) =>
      page.textItems
        .filter((item) => normalizeTerm(item.text).includes(needle))
        .map((item, index) => ({
          id: `${page.pageNumber}-${index}-${item.text}`,
          pageNumber: page.pageNumber,
          text: item.text,
          left: item.x,
          top: (page.height ?? 0) - (item.y + item.height),
          width: item.width,
          height: item.height,
        })),
    );
  }, [highlightQuery, layoutIndex.pages]);

  useEffect(() => {
    setActiveSearchMatchIndex(0);
  }, [highlightQuery]);

  const activeSearchMatch = searchMatches[activeSearchMatchIndex] ?? null;

  useEffect(() => {
    if (
      activeSearchMatch &&
      activePageNumber !== activeSearchMatch.pageNumber
    ) {
      setActivePageNumber((current) =>
        current === activeSearchMatch.pageNumber
          ? current
          : activeSearchMatch.pageNumber,
      );
    }
  }, [activePageNumber, activeSearchMatch]);

  const pageCommandItems = useMemo<WorkspaceCommandItem[]>(() => {
    return layoutIndex.pages.map((page) => ({
      id: `page-${page.pageNumber}`,
      label: page.normalizedTitle || page.title || `Page ${page.pageNumber}`,
      value: [
        page.title,
        page.normalizedTitle,
        page.panelNumber,
        page.boxNumber,
        page.unitType,
        `page ${page.pageNumber}`,
      ]
        .filter(Boolean)
        .join(" "),
      meta: `Page ${page.pageNumber}${page.panelNumber ? ` · ${page.panelNumber}` : ""}`,
      action: () => {
        setActivePageNumber(page.pageNumber);
        setCommandOpen(false);
      },
    }));
  }, [layoutIndex.pages]);

  const activePageCommandItems = useMemo<WorkspaceCommandItem[]>(() => {
    if (!activePage) {
      return [];
    }

    const items: WorkspaceCommandItem[] = [];
    if (activePage.panelNumber) {
      items.push({
        id: `active-panel-${activePage.pageNumber}`,
        label: `Jump to panel ${activePage.panelNumber}`,
        value: activePage.panelNumber,
        meta: "Page panel",
        action: () => {
          setHighlightQuery(activePage.panelNumber ?? "");
          setCommandOpen(false);
        },
      });
    }
    if (activePage.boxNumber) {
      items.push({
        id: `active-box-${activePage.pageNumber}`,
        label: `Jump to box ${activePage.boxNumber}`,
        value: activePage.boxNumber,
        meta: "Page box",
        action: () => {
          setHighlightQuery(activePage.boxNumber ?? "");
          setCommandOpen(false);
        },
      });
    }

    activePage.rails.forEach((rail, index) => {
      items.push({
        id: `rail-${index}`,
        label: rail.railLabel,
        value: rail.railLabel,
        meta: "Rail",
        action: () => {
          setHoveredRegionId(`rail-${index}`);
          setCommandOpen(false);
        },
      });
    });

    activePage.panducts.forEach((panduct, index) => {
      items.push({
        id: `panduct-${index}`,
        label: panduct.label,
        value: panduct.label,
        meta: "Panduct",
        action: () => {
          setHoveredRegionId(`panduct-${index}`);
          setCommandOpen(false);
        },
      });
    });

    activePage.railGroups?.forEach((group, groupIndex) => {
      (group.deviceClusters ?? []).forEach((cluster, clusterIndex) => {
        items.push({
          id: `cluster-${groupIndex}-${clusterIndex}`,
          label: cluster.label,
          value: cluster.label,
          meta: `${cluster.deviceTags.length} device${cluster.deviceTags.length === 1 ? "" : "s"}`,
          action: () => {
            setHoveredRegionId(`device-cluster-${groupIndex}-${clusterIndex}`);
            setCommandOpen(false);
          },
        });
      });
    });

    return items;
  }, [activePage]);

  const freeTextSearchLabel = commandQuery.trim();

  const highlightMatches = useMemo(() => {
    if (!activePage || !highlightQuery || !renderedPage) {
      return [];
    }

    const needle = normalizeTerm(highlightQuery);
    if (!needle) {
      return [];
    }

    const scaleX =
      renderedPage.width / (activePage.width || renderedPage.width);
    const scaleY =
      renderedPage.height / (activePage.height || renderedPage.height);

    return activePage.textItems
      .filter((item) => normalizeTerm(item.text).includes(needle))
      .map((item, index) => ({
        id: `${activePage.pageNumber}-${index}`,
        left: item.x * scaleX,
        top: renderedPage.height - (item.y + item.height) * scaleY,
        width: Math.max(item.width * scaleX, 18),
        height: Math.max(item.height * scaleY, 10),
        isActive:
          activeSearchMatch?.pageNumber === activePage.pageNumber &&
          normalizeTerm(activeSearchMatch.text) === normalizeTerm(item.text),
      }));
  }, [activePage, activeSearchMatch, highlightQuery, renderedPage]);

  const detectedRegions = useMemo<ViewerRegion[]>(() => {
    if (!activePage || !renderedPage) {
      return [];
    }

    const scaleX =
      renderedPage.width / (activePage.width || renderedPage.width);
    const scaleY =
      renderedPage.height / (activePage.height || renderedPage.height);
    const regions: ViewerRegion[] = [];

    activePage.anchors?.forEach((anchor, index) => {
      if (typeof anchor.x !== "number" || typeof anchor.y !== "number") {
        return;
      }

      regions.push({
        id: `anchor-${index}`,
        label: anchor.text,
        kind: "anchor",
        left: anchor.x * scaleX,
        top: renderedPage.height - (anchor.y + (anchor.height ?? 10)) * scaleY,
        width: Math.max((anchor.width ?? 24) * scaleX, 24),
        height: Math.max((anchor.height ?? 10) * scaleY, 12),
      });
    });

    activePage.rails.forEach((rail, index) => {
      const anchor = activePage.anchors?.find(
        (candidate) => candidate.text === rail.railLabel,
      );
      const corridorLeft = rail.spanXStart ?? anchor?.x ?? 24;
      const corridorRight =
        rail.spanXEnd ?? (anchor?.x ?? 24) + (anchor?.width ?? 120);
      const corridorTop = rail.corridorTop ?? (anchor?.y ?? rail.railY) - 18;
      const corridorBottom =
        rail.corridorBottom ??
        (anchor?.y ?? rail.railY) + (anchor?.height ?? 12);
      regions.push({
        id: `rail-${index}`,
        label: rail.railLabel,
        kind: "rail",
        left: corridorLeft * scaleX,
        top: renderedPage.height - corridorBottom * scaleY,
        width: Math.max((corridorRight - corridorLeft) * scaleX, 48),
        height: Math.max((corridorBottom - corridorTop) * scaleY, 12),
      });
    });

    activePage.panducts.forEach((panduct, index) => {
      const anchor = activePage.anchors?.find(
        (candidate) => candidate.text === panduct.label,
      );
      regions.push({
        id: `panduct-${index}`,
        label: panduct.label,
        kind: "panduct",
        left: (panduct.corridorLeft ?? anchor?.x ?? panduct.x ?? 24) * scaleX,
        top:
          renderedPage.height -
          (panduct.corridorBottom ??
            (anchor?.y ?? panduct.y) +
              (anchor?.height ?? panduct.height ?? 12)) *
            scaleY,
        width: Math.max(
          ((panduct.corridorRight ??
            (anchor?.x ?? panduct.x ?? 24) +
              (anchor?.width ?? panduct.width ?? 100)) -
            (panduct.corridorLeft ?? anchor?.x ?? panduct.x ?? 24)) *
            scaleX,
          40,
        ),
        height: Math.max(
          ((panduct.corridorBottom ??
            (anchor?.y ?? panduct.y) +
              (anchor?.height ?? panduct.height ?? 12)) -
            (panduct.corridorTop ?? (anchor?.y ?? panduct.y) - 16)) *
            scaleY,
          12,
        ),
      });
    });

    activePage.railGroups?.forEach((group, groupIndex) => {
      group.deviceClusters?.forEach((cluster, clusterIndex) => {
        regions.push({
          id: `device-cluster-${groupIndex}-${clusterIndex}`,
          label: cluster.label,
          kind: "device-cluster",
          left: cluster.xStart * scaleX,
          top: renderedPage.height - cluster.yBottom * scaleY,
          width: Math.max((cluster.xEnd - cluster.xStart) * scaleX, 30),
          height: Math.max((cluster.yBottom - cluster.yTop) * scaleY, 20),
        });
      });
    });

    return regions;
  }, [activePage, renderedPage]);

  const renderedTextItems = useMemo<ViewerTextItem[]>(() => {
    if (!activePage || !renderedPage) {
      return [];
    }

    const scaleX =
      renderedPage.width / (activePage.width || renderedPage.width);
    const scaleY =
      renderedPage.height / (activePage.height || renderedPage.height);

    return activePage.textItems.map((item, index) => ({
      id: `text-${activePage.pageNumber}-${index}`,
      text: item.text,
      left: item.x * scaleX,
      top: renderedPage.height - (item.y + item.height) * scaleY,
      width: Math.max(item.width * scaleX, 6),
      height: Math.max(item.height * scaleY, 8),
    }));
  }, [activePage, renderedPage]);

  const sidebarResultSummary = sidebarQuery
    ? `${filteredPages.length} match${filteredPages.length === 1 ? "" : "es"}`
    : `${layoutIndex.pageCount} pages`;

  const searchResultSummary = highlightQuery
    ? `${searchMatches.length} text match${searchMatches.length === 1 ? "" : "es"}`
    : "Search all visible PDF text";

  const canGoPrevious = activePageNumber > 1;
  const canGoNext = activePageNumber < layoutIndex.pageCount;
  const canGoToPreviousSearchMatch = searchMatches.length > 1;
  const canGoToNextSearchMatch = searchMatches.length > 1;

  const goToPreviousSearchMatch = () => {
    if (searchMatches.length === 0) {
      return;
    }
    setActiveSearchMatchIndex(
      (current) => (current - 1 + searchMatches.length) % searchMatches.length,
    );
  };

  const goToNextSearchMatch = () => {
    if (searchMatches.length === 0) {
      return;
    }
    setActiveSearchMatchIndex(
      (current) => (current + 1) % searchMatches.length,
    );
  };

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden bg-background",
        className,
      )}
    >
      {showNavigator ? (
      <div className="hidden min-h-0 w-80 shrink-0 flex-col border-r border-border/60 lg:flex">
        <div className="space-y-3 border-b border-border/50 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Layout Navigator
            </p>
            <h3 className="mt-1 text-lg font-semibold">PDF Workspace</h3>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={sidebarQuery}
              onChange={(event) => setSidebarQuery(event.target.value)}
              placeholder="Search title, panel, box, text..."
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {sidebarResultSummary}
          </p>
        </div>

        <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-2 p-3">
            {filteredPages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                No pages matched that search yet. Try a panel number, box
                number, title fragment, or visible text.
              </div>
            ) : (
              filteredPages.map((page) => {
                const isActive = page.pageNumber === activePageNumber;
                return (
                  <button
                    key={page.pageNumber}
                    type="button"
                    onClick={() => setActivePageNumber(page.pageNumber)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/50 bg-background/50 hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Page {page.pageNumber}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {page.title || `Page ${page.pageNumber}`}
                        </p>
                      </div>
                      {page.unitType ? (
                        <span className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {page.unitType}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {page.panelNumber ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                          {page.panelNumber}
                        </span>
                      ) : null}
                      {page.boxNumber ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                          {page.boxNumber}
                        </span>
                      ) : null}
                   
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card/70">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <ProjectIcon
              name={projectName ?? projectNumber ?? "Project"}
              color={projectColor ?? "#ffcc61"}
              interactive={false}
            />
            <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Active Layout Page
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {activePage?.title || `Page ${activePageNumber}`}
            </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              ref={commandRef}
              className="relative w-[min(32rem,calc(100vw-8rem))] min-w-[16rem]"
            >
              <Command
                className="overflow-visible rounded-2xl border border-border/60 bg-background"
              >
                <CommandInput
                  value={commandQuery}
                  onValueChange={setCommandQuery}
                  onFocus={() => setCommandOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setCommandOpen(false);
                      return;
                    }
                    if (event.key === "Enter" && freeTextSearchLabel) {
                      event.preventDefault();
                      setHighlightQuery(freeTextSearchLabel);
                      setCommandOpen(false);
                    }
                  }}
                  placeholder="Search text, jump to a page, or inspect an entity..."
                  className="h-12"
                />
                {commandOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl">
                    <CommandList className="max-h-80">
                      <CommandEmpty>No results found.</CommandEmpty>
                      {freeTextSearchLabel ? (
                        <CommandGroup heading="Search">
                          <CommandItem
                            value={`Search ${freeTextSearchLabel}`}
                            onSelect={() => {
                              setHighlightQuery(freeTextSearchLabel);
                              setCommandOpen(false);
                            }}
                          >
                            <Search className="h-4 w-4" />
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span className="truncate">
                                Search visible text for “{freeTextSearchLabel}”
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Match text
                              </span>
                            </div>
                          </CommandItem>
                        </CommandGroup>
                      ) : null}
                      <CommandGroup heading="Current page">
                        {activePageCommandItems.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.value}
                            onSelect={item.action}
                          >
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span className="truncate">{item.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.meta}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Pages">
                        {pageCommandItems.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.value}
                            onSelect={item.action}
                          >
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span className="truncate">{item.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.meta}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </div>
                ) : null}
              </Command>
            </div>
            <div className="min-w-36 text-right text-xs text-muted-foreground">
              {searchResultSummary}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((prev) => Math.max(prev - 0.2, 0.6))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((prev) => Math.min(prev + 0.2, 2.4))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoPrevious}
              onClick={() =>
                setActivePageNumber((prev) => Math.max(1, prev - 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoNext}
              onClick={() =>
                setActivePageNumber((prev) =>
                  Math.min(layoutIndex.pageCount, prev + 1),
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDetailsOpen((current) => !current)}
            >
              {showInspector ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div
          ref={viewportHostRef}
          className="min-h-0 flex-1 overflow-auto bg-muted/20"
        >
          <div className="flex min-h-full min-w-full items-start justify-center p-3">
            <div className="relative">
              <canvas ref={canvasRef} className="bg-white" />
              {renderedPage && renderedTextItems.length > 0 ? (
                <div className="absolute inset-0 z-10 select-text">
                  {renderedTextItems.map((item) => (
                    <span
                      key={item.id}
                      className="absolute whitespace-pre text-transparent selection:bg-sky-300/60 selection:text-transparent"
                      style={{
                        left: item.left,
                        top: item.top,
                        width: item.width,
                        height: item.height,
                        lineHeight: `${item.height}px`,
                        fontSize: `${Math.max(item.height * 0.92, 8)}px`,
                        pointerEvents: "auto",
                        userSelect: "text",
                      }}
                    >
                      {item.text}
                    </span>
                  ))}
                </div>
              ) : null}
              {renderedPage && highlightMatches.length > 0 ? (
                <div className="pointer-events-none absolute inset-0">
                  {highlightMatches.map((match) => (
                    <div
                      key={match.id}
                      className={cn(
                        "absolute rounded-sm border",
                        match.isActive
                          ? "border-sky-500 bg-sky-300/35"
                          : "border-amber-400/70 bg-amber-300/35",
                      )}
                      style={{
                        left: match.left,
                        top: match.top,
                        width: match.width,
                        height: match.height,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {renderedPage && detectedRegions.length > 0 ? (
                <div className="pointer-events-none absolute inset-0">
                  {detectedRegions.map((region) => (
                    <div
                      key={region.id}
                      className={cn(
                        "absolute rounded-sm border transition-colors",
                        hoveredRegionId === region.id
                          ? "border-sky-500 bg-sky-300/25"
                          : "border-transparent bg-transparent",
                      )}
                      style={{
                        left: region.left,
                        top: region.top,
                        width: region.width,
                        height: region.height,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showInspector ? (
        <aside className="hidden w-80 min-h-0 shrink-0 border-l border-border/60 2xl:flex 2xl:flex-col">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Inspector
              </p>
              <p className="mt-1 text-sm font-medium">Metadata &amp; Entities</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDetailsOpen(false)}
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Metadata
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <MetaRow label="Page">
                      {activePage?.pageNumber ?? "—"}
                    </MetaRow>
                    <MetaRow label="Title">
                      {activePage?.title || "Untitled"}
                    </MetaRow>
                    <MetaRow label="Panel">
                      {activePage?.panelNumber || "—"}
                    </MetaRow>
                    <MetaRow label="Box">
                      {activePage?.boxNumber || "—"}
                    </MetaRow>
                    <MetaRow label="Unit">
                      {activePage?.unitType || "—"}
                    </MetaRow>
                    <MetaRow label="Rails">
                      {activePage?.rails.length ?? 0}
                    </MetaRow>
                    <MetaRow label="Panducts">
                      {activePage?.panducts.length ?? 0}
                    </MetaRow>
                    <MetaRow label="Device Clusters">
                      {activePage?.railGroups?.reduce(
                        (sum, group) =>
                          sum + (group.deviceClusters?.length ?? 0),
                        0,
                      ) ?? 0}
                    </MetaRow>
                    <MetaRow label="Text Items">
                      {activePage?.textItems.length ?? 0}
                    </MetaRow>
                  </div>
                </div>
              </div>

              <div className="min-h-0 rounded-2xl border border-border/50 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Detected Entities
                </p>
                <div className="mt-3 space-y-3 pr-1">
                  <EntitySection
                    title="Rails"
                    items={
                      activePage?.rails.map((rail, index) => ({
                        id: `rail-${index}`,
                        label: rail.railLabel,
                        meta: `Y ${rail.railY.toFixed(0)} · X ${Math.round(rail.spanXStart ?? 0)}-${Math.round(rail.spanXEnd ?? 0)}`,
                      })) ?? []
                    }
                    hoveredRegionId={hoveredRegionId}
                    setHoveredRegionId={setHoveredRegionId}
                  />
                  <EntitySection
                    title="Panducts"
                    items={
                      activePage?.panducts.map((panduct, index) => ({
                        id: `panduct-${index}`,
                        label: panduct.label,
                        meta: `X ${Math.round(panduct.corridorLeft ?? panduct.x ?? 0)}-${Math.round(panduct.corridorRight ?? panduct.x ?? 0)} · Y ${Math.round(panduct.corridorTop ?? panduct.y)}-${Math.round(panduct.corridorBottom ?? panduct.y)}`,
                      })) ?? []
                    }
                    hoveredRegionId={hoveredRegionId}
                    setHoveredRegionId={setHoveredRegionId}
                  />
                  <EntitySection
                    title="Device Clusters"
                    items={
                      activePage?.railGroups?.flatMap((group, groupIndex) =>
                        (group.deviceClusters ?? []).map(
                          (cluster, clusterIndex) => ({
                            id: `device-cluster-${groupIndex}-${clusterIndex}`,
                            label: cluster.label,
                            meta: `${cluster.deviceTags.length} devices · X ${Math.round(cluster.xStart)}-${Math.round(cluster.xEnd)}`,
                          }),
                        ),
                      ) ?? []
                    }
                    hoveredRegionId={hoveredRegionId}
                    setHoveredRegionId={setHoveredRegionId}
                  />
                  <EntitySection
                    title="Anchors"
                    items={
                      activePage?.anchors?.map((anchor, index) => ({
                        id: `anchor-${index}`,
                        label: anchor.text,
                        meta: anchor.kind,
                      })) ?? []
                    }
                    hoveredRegionId={hoveredRegionId}
                    setHoveredRegionId={setHoveredRegionId}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>
      ) : null}
    </div>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

function EntitySection({
  title,
  items,
  hoveredRegionId,
  setHoveredRegionId,
}: {
  title: string;
  items: Array<{ id: string; label: string; meta: string }>;
  hoveredRegionId: string | null;
  setHoveredRegionId: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
            No detected {title.toLowerCase()}.
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                hoveredRegionId === item.id
                  ? "border-sky-500 bg-sky-50"
                  : "border-border/50 hover:bg-muted/60",
              )}
              onMouseEnter={() => setHoveredRegionId(item.id)}
              onMouseLeave={() =>
                setHoveredRegionId((current) =>
                  current === item.id ? null : current,
                )
              }
            >
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.meta}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
