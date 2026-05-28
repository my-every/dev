"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchSheetSchema, fetchWireListPrintSchema } from "@/contexts/project-context";
import type { WireListPrintSchema } from "@/lib/wire-list-print/schema";
import type { BrandListExportSchema, BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
import type { LayoutPagePreview } from "@/lib/layout-matching";
import type {
  MultiSheetImportSession,
  MultiSheetReviewEntryMode,
} from "@/lib/wire-brand-list/multi-sheet-review";
import type { SheetSchema } from "@/types/sheet-schema";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";

export interface MultiSheetTabItem {
  slug: string;
  name: string;
  rowCount: number;
  hasExternalLocations: boolean;
  pageNumber?: number;
  pageTitle?: string;
  imageUrl?: string;
  resolvedPage?: LayoutPagePreview;
}

export interface LoadedSheetResources {
  sheet: SheetSchema | null;
  printSchema: WireListPrintSchema | null;
  brandSchema: BrandListExportSchema | null;
}

export interface MultiSheetPrintExportResult {
  projectId: string;
  generatedAt: string;
  approvedSheets: Array<{
    sheetSlug: string;
    sheetName: string;
    brandingRows: number;
    wireRows: number;
  }>;
  skippedSheets: Array<{
    sheetSlug: string;
    reason: string;
  }>;
  brandingWorkbook?: {
    fileName: string;
    relativePath: string;
  };
  wireListSchema?: {
    fileName: string;
    relativePath: string;
  };
  manifestFile?: {
    fileName: string;
    relativePath: string;
  };
}

export interface MultiSheetPrintSheetReview {
  sheetSlug: string;
  reviewedAt: string;
  reviewedByBadge: string | null;
  reviewedByName: string | null;
  approvedSchemaHash: string | null;
}

export interface MultiSheetPrintExportFilesState {
  brandingWorkbookExists: boolean;
  wireListSchemaExists: boolean;
  manifestFileExists: boolean;
}

export interface MultiSheetApproveSheetResult {
  approvedSlug: string;
  nextSlug: string | null;
  isFinalSheet: boolean;
}

interface ReviewToast {
  title: string;
  description?: string;
  duration?: number;
}

interface ReviewUser {
  badge?: string | null;
  legalName?: string | null;
  preferredName?: string | null;
}

interface UseMultiSheetBrandReviewControllerOptions {
  projectId?: string;
  isOpen: boolean;
  tabs: MultiSheetTabItem[];
  preferredSheetSlug?: string | null;
  user?: ReviewUser | null;
  toast: (payload: ReviewToast) => void;
}

interface MultiSheetSessionPayload {
  session?: {
    activeSheetSlug: string | null;
    approvedSheetSlugs: string[];
    editedAfterApprovalSheetSlugs?: string[];
    sheetReviews?: Record<string, MultiSheetPrintSheetReview>;
    lastCombinedExportResult: MultiSheetPrintExportResult | null;
    entryMode?: MultiSheetReviewEntryMode;
    importSession?: MultiSheetImportSession | null;
  } | null;
  exportFiles?: MultiSheetPrintExportFilesState;
}

function buildExportDownloadHref(projectId: string, relativePath: string) {
  const normalizedRelativePath = relativePath.replace(/^exports\//, "");
  const encodedSegments = normalizedRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encodedSegments}?download=1`;
}

function createManualBrandSchemaRow(options: {
  prefix: string;
  bundleName: string;
  toLocation: string;
  rowIndex: number;
}): BrandListSchemaRow {
  return {
    rowId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rowIndex: options.rowIndex,
    fromDeviceId: "",
    wireNo: "",
    wireId: "",
    gaugeSize: "",
    length: null,
    toDeviceId: "",
    toLocation: options.toLocation,
    bundleName: options.bundleName,
    bundleDisplay: options.bundleName,
    devicePrefix: options.prefix,
  };
}

async function fetchBrandListSchema(
  projectId: string,
  sheetSlug: string,
): Promise<BrandListExportSchema | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/wire-brand-list-schemas?sheet=${encodeURIComponent(sheetSlug)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<BrandListExportSchema>;
}

async function generateBrandListSchema(
  projectId: string,
  sheetSlug: string,
): Promise<BrandListExportSchema | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/wire-brand-list-schemas`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sheetSlug, save: true }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as { schema?: BrandListExportSchema };
  return payload.schema ?? null;
}

export function useMultiSheetBrandReviewController({
  projectId,
  isOpen,
  tabs,
  preferredSheetSlug,
  user,
  toast,
}: UseMultiSheetBrandReviewControllerOptions) {
  const [activeSlug, setActiveSlug] = useState<string | null>(preferredSheetSlug ?? null);
  const [resourceMap, setResourceMap] = useState<Record<string, LoadedSheetResources>>({});
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [approvedSlugs, setApprovedSlugs] = useState<string[]>([]);
  const [sheetReviews, setSheetReviews] = useState<Record<string, MultiSheetPrintSheetReview>>({});
  const [isCombining, setIsCombining] = useState(false);
  const [exportResult, setExportResult] = useState<MultiSheetPrintExportResult | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [selectedBrandRows, setSelectedBrandRows] = useState<Set<string>>(() => new Set());
  const [savedBrandSchemaSlugs, setSavedBrandSchemaSlugs] = useState<string[]>([]);
  const [exportFileState, setExportFileState] = useState<MultiSheetPrintExportFilesState | null>(null);
  const [editedAfterApprovalSlugs, setEditedAfterApprovalSlugs] = useState<string[]>([]);
  const [pendingBrandSchemaSlugs, setPendingBrandSchemaSlugs] = useState<string[]>([]);
  const [entryMode, setEntryMode] = useState<MultiSheetReviewEntryMode>("cover");
  const [importSession, setImportSession] = useState<MultiSheetImportSession | null>(null);
  const pendingBrandSchemaSaveRef = useRef<Record<string, Promise<BrandListExportSchema | null>>>({});
  const missingBrandSchemaSlugsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSelectedBrandRows(new Set());
  }, [activeSlug]);

  useEffect(() => {
    if (!tabs.length) {
      setActiveSlug(null);
      return;
    }

    setActiveSlug((prev) => {
      if (prev && tabs.some((tab) => tab.slug === prev)) {
        return prev;
      }

      if (preferredSheetSlug && tabs.some((tab) => tab.slug === preferredSheetSlug)) {
        return preferredSheetSlug;
      }

      return tabs[0]?.slug ?? null;
    });
    setApprovedSlugs((prev) => prev.filter((slug) => tabs.some((tab) => tab.slug === slug)));
    setEditedAfterApprovalSlugs((prev) => prev.filter((slug) => tabs.some((tab) => tab.slug === slug)));
    setSavedBrandSchemaSlugs((prev) => prev.filter((slug) => tabs.some((tab) => tab.slug === slug)));
    setPendingBrandSchemaSlugs((prev) => prev.filter((slug) => tabs.some((tab) => tab.slug === slug)));
    setSheetReviews((prev) => {
      const validSlugs = new Set(tabs.map((tab) => tab.slug));
      return Object.fromEntries(Object.entries(prev).filter(([slug]) => validSlugs.has(slug)));
    });
    setImportSession((prev) => {
      if (!prev) {
        return prev;
      }

      const validSlugs = new Set(tabs.map((tab) => tab.slug));
      const importedSheets = prev.importedSheets.filter((sheet) => validSlugs.has(sheet.sheetSlug));
      return {
        ...prev,
        matchedSheetSlugs: prev.matchedSheetSlugs.filter((slug) => validSlugs.has(slug)),
        completedSheetSlugs: prev.completedSheetSlugs.filter((slug) => validSlugs.has(slug)),
        activeSheetSlug: prev.activeSheetSlug && validSlugs.has(prev.activeSheetSlug) ? prev.activeSheetSlug : importedSheets[0]?.sheetSlug ?? null,
        importedSheets,
      };
    });
  }, [preferredSheetSlug, tabs]);

  const refreshSession = useCallback(async () => {
    if (!projectId) {
      return;
    }

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/session`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json() as MultiSheetSessionPayload;
    const session = payload.session;
    if (session) {
      // Validate stored activeSheetSlug against available tabs to prevent stale references
      const validTabSlugs = new Set(tabs.map((tab) => tab.slug));
      const validActiveSlug = session.activeSheetSlug && validTabSlugs.has(session.activeSheetSlug)
        ? session.activeSheetSlug
        : preferredSheetSlug && validTabSlugs.has(preferredSheetSlug)
          ? preferredSheetSlug
          : tabs[0]?.slug ?? null;
      setActiveSlug(validActiveSlug);
      // Also filter approved/edited slugs against valid tabs
      setApprovedSlugs(
        Array.isArray(session.approvedSheetSlugs)
          ? session.approvedSheetSlugs.filter((slug) => validTabSlugs.has(slug))
          : [],
      );
      setEditedAfterApprovalSlugs(
        Array.isArray(session.editedAfterApprovalSheetSlugs)
          ? session.editedAfterApprovalSheetSlugs.filter((slug) => validTabSlugs.has(slug))
          : [],
      );
      setSheetReviews(session.sheetReviews ?? {});
      setExportFileState(payload.exportFiles ?? null);
      setExportResult(
        session.lastCombinedExportResult && (payload.exportFiles?.brandingWorkbookExists ?? true)
          ? session.lastCombinedExportResult
          : null,
      );
      setEntryMode(session.entryMode === "import-review" || session.entryMode === "review" ? session.entryMode : "cover");
      setImportSession(session.importSession ?? null);
      return;
    }

    setApprovedSlugs([]);
    setEditedAfterApprovalSlugs([]);
    setSheetReviews({});
    setExportResult(null);
    setExportFileState(null);
    setEntryMode("cover");
    setImportSession(null);
  }, [preferredSheetSlug, projectId, tabs]);

  const refreshSavedBrandSchemas = useCallback(async () => {
    if (!projectId) {
      return;
    }

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/wire-brand-list-schemas`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json() as { sheets?: string[] };
    setSavedBrandSchemaSlugs(Array.isArray(payload.sheets) ? payload.sheets : []);
  }, [projectId]);

  useEffect(() => {
    if (!isOpen || !projectId) {
      return;
    }

    let cancelled = false;
    setHasLoadedSession(false);

    void refreshSession()
      .catch(() => {
        if (!cancelled) {
          setApprovedSlugs([]);
          setEditedAfterApprovalSlugs([]);
          setSheetReviews({});
          setExportResult(null);
          setExportFileState(null);
          setEntryMode("cover");
          setImportSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHasLoadedSession(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, refreshSession]);

  useEffect(() => {
    if (!isOpen || !projectId) {
      return;
    }

    let cancelled = false;
    void refreshSavedBrandSchemas()
      .catch(() => {
        if (!cancelled) {
          setSavedBrandSchemaSlugs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, refreshSavedBrandSchemas]);

  const loadResourcesForSheet = useCallback(async (sheetSlug: string, force = false) => {
    if (!projectId) {
      return;
    }

    if (!force && resourceMap[sheetSlug]) {
      return;
    }

    const savedSchemaSet = new Set(savedBrandSchemaSlugs);
    const shouldFetchBrandSchema =
      force ||
      savedSchemaSet.has(sheetSlug) ||
      !missingBrandSchemaSlugsRef.current.has(sheetSlug);

    setLoadingSlug(sheetSlug);
    try {
      const brandSchemaPromise = shouldFetchBrandSchema
        ? (async () => {
            const existing = await fetchBrandListSchema(projectId, sheetSlug);
            if (existing) {
              return existing;
            }
            // Fallback to lazy generation when no saved branding schema exists yet.
            return generateBrandListSchema(projectId, sheetSlug);
          })()
        : Promise.resolve(null);

      const [sheet, printSchema, brandSchema] = await Promise.all([
        fetchSheetSchema(projectId, sheetSlug),
        fetchWireListPrintSchema(projectId, sheetSlug),
        brandSchemaPromise,
      ]);

      if (brandSchema) {
        missingBrandSchemaSlugsRef.current.delete(sheetSlug);
        setSavedBrandSchemaSlugs((prev) =>
          prev.includes(sheetSlug) ? prev : [...prev, sheetSlug],
        );
      } else if (!savedSchemaSet.has(sheetSlug)) {
        missingBrandSchemaSlugsRef.current.add(sheetSlug);
      }

      setResourceMap((prev) => ({
        ...prev,
        [sheetSlug]: {
          sheet,
          printSchema,
          brandSchema,
        },
      }));
    } finally {
      setLoadingSlug((prev) => (prev === sheetSlug ? null : prev));
    }
  }, [projectId, resourceMap, savedBrandSchemaSlugs]);

  useEffect(() => {
    if (!isOpen || !activeSlug) {
      return;
    }

    void loadResourcesForSheet(activeSlug);
  }, [activeSlug, isOpen, loadResourcesForSheet]);

  useEffect(() => {
    if (!isOpen || !projectId || !hasLoadedSession) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/session`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activeSheetSlug: activeSlug,
          approvedSheetSlugs: approvedSlugs,
          editedAfterApprovalSheetSlugs: editedAfterApprovalSlugs,
          sheetReviews,
          lastCombinedExportResult: exportResult,
          entryMode,
          importSession,
        }),
      }).catch(() => null);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSlug, approvedSlugs, editedAfterApprovalSlugs, entryMode, exportResult, hasLoadedSession, importSession, isOpen, projectId, sheetReviews]);

  useEffect(() => {
    if (!hasLoadedSession || approvedSlugs.length === 0) {
      return;
    }

    const staleApprovedSlugs = approvedSlugs.filter((slug) => {
      const review = sheetReviews[slug];
      const schemaHash = resourceMap[slug]?.brandSchema?.schemaHash ?? null;
      return Boolean(review?.approvedSchemaHash && schemaHash && review.approvedSchemaHash !== schemaHash);
    });

    if (staleApprovedSlugs.length === 0) {
      return;
    }

    setApprovedSlugs((prev) => prev.filter((slug) => !staleApprovedSlugs.includes(slug)));
    setEditedAfterApprovalSlugs((prev) => Array.from(new Set([...prev, ...staleApprovedSlugs])));
    setSheetReviews((prev) => {
      const next = { ...prev };
      for (const slug of staleApprovedSlugs) {
        delete next[slug];
      }
      return next;
    });
  }, [approvedSlugs, hasLoadedSession, resourceMap, sheetReviews]);

  const activeIndex = useMemo(() => tabs.findIndex((tab) => tab.slug === activeSlug), [activeSlug, tabs]);
  const activeTab = activeIndex >= 0 ? tabs[activeIndex] : null;
  const activeResources = activeSlug ? resourceMap[activeSlug] : undefined;
  const activeBrandSchema = activeResources?.brandSchema ?? null;
  const activeBrandRowIds = useMemo(() => {
    if (!activeBrandSchema) {
      return [];
    }

    return activeBrandSchema.prefixGroups.flatMap((group) =>
      group.bundles.flatMap((bundle) => bundle.rows.map((row) => row.rowId)),
    );
  }, [activeBrandSchema]);

  const reviewState = useMemo(() => {
    const savedSet = new Set(savedBrandSchemaSlugs);
    const mappedSheets = tabs.filter((tab) => Boolean(tab.pageNumber)).length;
    const savedSchemas = tabs.filter((tab) => savedSet.has(tab.slug) || Boolean(resourceMap[tab.slug]?.brandSchema)).length;
    const allApproved = tabs.length > 0 && tabs.every((tab) => approvedSlugs.includes(tab.slug));
    const brandingWorkbookReady = Boolean(exportResult?.brandingWorkbook && (exportFileState?.brandingWorkbookExists ?? true));

    return {
      totalSheets: tabs.length,
      mappedSheets,
      savedSchemas,
      approvedSheets: approvedSlugs.length,
      editedSheets: editedAfterApprovalSlugs.length,
      allApproved,
      brandingWorkbookReady,
      wireListSchemaReady: Boolean(exportResult?.wireListSchema && (exportFileState?.wireListSchemaExists ?? true)),
      mappingNeedsReview: tabs.length > 0 && mappedSheets < tabs.length,
    };
  }, [approvedSlugs.length, editedAfterApprovalSlugs.length, exportFileState, exportResult, resourceMap, savedBrandSchemaSlugs, tabs]);

  const persistBrandSchema = useCallback((sheetSlug: string, schema: BrandListExportSchema): Promise<BrandListExportSchema | null> => {
    if (!projectId) {
      return Promise.resolve(null);
    }

    setPendingBrandSchemaSlugs((prev) => Array.from(new Set([...prev, sheetSlug])));
    const request = fetch(`/api/projects/${encodeURIComponent(projectId)}/wire-brand-list-schemas`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sheetSlug, schema }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(payload.error || `HTTP ${response.status}`);
        }

        return response.json() as Promise<{ schema: BrandListExportSchema }>;
      })
      .then((payload) => {
        setResourceMap((prev) => ({
          ...prev,
          [sheetSlug]: {
            ...(prev[sheetSlug] ?? { sheet: null, printSchema: null, brandSchema: null }),
            brandSchema: payload.schema,
          },
        }));
        missingBrandSchemaSlugsRef.current.delete(sheetSlug);
        setSavedBrandSchemaSlugs((prev) => Array.from(new Set([...prev, sheetSlug])));
        return payload.schema;
      })
      .catch((error) => {
        toast({
          title: "Brand schema save failed",
          description: error instanceof Error ? error.message : "Unable to save brand schema edits",
          duration: 3500,
        });
        return null;
      })
      .finally(() => {
        delete pendingBrandSchemaSaveRef.current[sheetSlug];
        setPendingBrandSchemaSlugs((prev) => prev.filter((slug) => slug !== sheetSlug));
      });

    pendingBrandSchemaSaveRef.current[sheetSlug] = request;
    return request;
  }, [projectId, toast]);

  const updateActiveBrandSchema = useCallback((mutator: (schema: BrandListExportSchema) => BrandListExportSchema) => {
    if (!activeSlug || !activeBrandSchema) {
      return;
    }

    const nextSchema = mutator(activeBrandSchema);
    const totalRows = nextSchema.prefixGroups.reduce(
      (sum, group) => sum + group.bundles.reduce((bundleSum, bundle) => bundleSum + bundle.rows.length, 0),
      0,
    );
    const normalizedSchema: BrandListExportSchema = {
      ...nextSchema,
      totalRows,
      generatedAt: new Date().toISOString(),
    };

    setResourceMap((prev) => ({
      ...prev,
      [activeSlug]: {
        ...(prev[activeSlug] ?? { sheet: null, printSchema: null, brandSchema: null }),
        brandSchema: normalizedSchema,
      },
    }));
    const wasApproved = approvedSlugs.includes(activeSlug);
    if (wasApproved) {
      setApprovedSlugs((prev) => prev.filter((slug) => slug !== activeSlug));
      setEditedAfterApprovalSlugs((prev) => Array.from(new Set([...prev, activeSlug])));
      setSheetReviews((prev) => {
        const next = { ...prev };
        delete next[activeSlug];
        return next;
      });
      setExportResult(null);
      setExportFileState(null);
    }
    setSavedBrandSchemaSlugs((prev) => Array.from(new Set([...prev, activeSlug])));
    void persistBrandSchema(activeSlug, normalizedSchema);
  }, [activeBrandSchema, activeSlug, approvedSlugs, persistBrandSchema]);

  const renameBrandBundle = useCallback((prefixIndex: number, bundleIndex: number, nextName: string) => {
    const normalizedNextName = normalizeDisplayTitle(nextName);
    updateActiveBrandSchema((schema) => ({
      ...schema,
      prefixGroups: schema.prefixGroups.map((group, groupIndex) => groupIndex === prefixIndex ? {
        ...group,
        bundles: group.bundles.map((bundle, currentBundleIndex) => currentBundleIndex === bundleIndex ? {
          ...bundle,
          bundleName: normalizedNextName,
          rows: bundle.rows.map((row) => ({
            ...row,
            bundleName: normalizedNextName,
            bundleDisplay: row.bundleDisplay === bundle.bundleName ? normalizedNextName : row.bundleDisplay,
          })),
        } : bundle),
      } : group),
    }));
  }, [updateActiveBrandSchema]);

  const updateBrandSchemaRow = useCallback((
    prefixIndex: number,
    bundleIndex: number,
    rowIndex: number,
    patch: Partial<BrandListSchemaRow>,
  ) => {
    updateActiveBrandSchema((schema) => ({
      ...schema,
      prefixGroups: schema.prefixGroups.map((group, groupIndex) => groupIndex === prefixIndex ? {
        ...group,
        bundles: group.bundles.map((bundle, currentBundleIndex) => currentBundleIndex === bundleIndex ? {
          ...bundle,
          rows: bundle.rows.map((row, currentRowIndex) => currentRowIndex === rowIndex ? {
            ...row,
            ...patch,
          } : row),
        } : bundle),
      } : group),
    }));
  }, [updateActiveBrandSchema]);

  const addBrandSchemaRow = useCallback((prefixIndex: number, bundleIndex: number) => {
    updateActiveBrandSchema((schema) => ({
      ...schema,
      prefixGroups: schema.prefixGroups.map((group, groupIndex) => groupIndex === prefixIndex ? {
        ...group,
        bundles: group.bundles.map((bundle, currentBundleIndex) => currentBundleIndex === bundleIndex ? {
          ...bundle,
          rows: [
            ...bundle.rows,
            createManualBrandSchemaRow({
              prefix: group.prefix,
              bundleName: bundle.bundleName,
              toLocation: bundle.toLocation,
              rowIndex: bundle.rows.length + 1,
            }),
          ],
        } : bundle),
      } : group),
    }));
  }, [updateActiveBrandSchema]);

  const removeBrandSchemaRow = useCallback((prefixIndex: number, bundleIndex: number, rowIndex: number) => {
    updateActiveBrandSchema((schema) => ({
      ...schema,
      prefixGroups: schema.prefixGroups.map((group, groupIndex) => groupIndex === prefixIndex ? {
        ...group,
        bundles: group.bundles.map((bundle, currentBundleIndex) => currentBundleIndex === bundleIndex ? {
          ...bundle,
          rows: bundle.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex),
        } : bundle),
      } : group),
    }));
  }, [updateActiveBrandSchema]);

  const updateBrandSchemaProjectInfo = useCallback((patch: Partial<BrandListExportSchema["projectInfo"]>) => {
    updateActiveBrandSchema((schema) => ({
      ...schema,
      projectInfo: {
        ...schema.projectInfo,
        ...patch,
      },
    }));
  }, [updateActiveBrandSchema]);

  const toggleSelectedBrandRow = useCallback((rowId: string, checked: boolean) => {
    setSelectedBrandRows((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  }, []);

  const toggleSelectedBrandRowGroup = useCallback((rowIds: string[], checked: boolean) => {
    setSelectedBrandRows((prev) => {
      const next = new Set(prev);
      for (const rowId of rowIds) {
        if (checked) {
          next.add(rowId);
        } else {
          next.delete(rowId);
        }
      }
      return next;
    });
  }, []);

  const duplicateSelectedBrandRows = useCallback(() => {
    if (selectedBrandRows.size === 0) {
      return;
    }

    updateActiveBrandSchema((schema) => ({
      ...schema,
      prefixGroups: schema.prefixGroups.map((group) => ({
        ...group,
        bundles: group.bundles.map((bundle) => {
          const duplicates = bundle.rows
            .filter((row) => selectedBrandRows.has(row.rowId))
            .map((row, duplicateIndex) => ({
              ...row,
              rowId: `duplicate-${Date.now()}-${duplicateIndex}-${row.rowId}`,
              rowIndex: bundle.rows.length + duplicateIndex + 1,
            }));

          return duplicates.length ? { ...bundle, rows: [...bundle.rows, ...duplicates] } : bundle;
        }),
      })),
    }));
  }, [selectedBrandRows, updateActiveBrandSchema]);

  const incrementSelectedBrandLengths = useCallback((delta: number) => {
    if (selectedBrandRows.size === 0) {
      return;
    }

    updateActiveBrandSchema((schema) => ({
      ...schema,
      prefixGroups: schema.prefixGroups.map((group) => ({
        ...group,
        bundles: group.bundles.map((bundle) => ({
          ...bundle,
          rows: bundle.rows.map((row) => selectedBrandRows.has(row.rowId) ? {
            ...row,
            length: Math.max(0, (typeof row.length === "number" ? row.length : 0) + delta),
          } : row),
        })),
      })),
    }));
  }, [selectedBrandRows, updateActiveBrandSchema]);

  const regenerateBrandSchemaForSheet = useCallback((sheetSlug: string) => {
    if (!projectId) {
      return Promise.resolve<BrandListExportSchema | null>(null);
    }

    return fetch(`/api/projects/${encodeURIComponent(projectId)}/wire-brand-list-schemas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sheetSlug, save: true }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(payload.error || `HTTP ${response.status}`);
        }

        return response.json() as Promise<{ schema: BrandListExportSchema }>;
      })
      .then((payload) => {
        setResourceMap((prev) => ({
          ...prev,
          [sheetSlug]: {
            ...(prev[sheetSlug] ?? { sheet: null, printSchema: null, brandSchema: null }),
            brandSchema: payload.schema,
          },
        }));
        return payload.schema;
      })
      .catch(() => null);
  }, [projectId]);

  const handleApproveSheet = useCallback(async (): Promise<MultiSheetApproveSheetResult | null> => {
    if (!activeSlug) {
      return null;
    }

    let latestSchema = activeResources?.brandSchema ?? null;
    const pendingSave = pendingBrandSchemaSaveRef.current[activeSlug];
    if (pendingSave) {
      latestSchema = await pendingSave;
    } else if (!latestSchema) {
      latestSchema = await regenerateBrandSchemaForSheet(activeSlug);
    }

    if (!latestSchema) {
      toast({
        title: "Approval blocked",
        description: "Save the latest brand schema changes successfully before approving this sheet.",
        duration: 3500,
      });
      return null;
    }

    setApprovedSlugs((prev) => (prev.includes(activeSlug) ? prev : [...prev, activeSlug]));
    setEditedAfterApprovalSlugs((prev) => prev.filter((slug) => slug !== activeSlug));
    setSheetReviews((prev) => ({
      ...prev,
      [activeSlug]: {
        sheetSlug: activeSlug,
        reviewedAt: new Date().toISOString(),
        reviewedByBadge: user?.badge ?? null,
        reviewedByName: user?.preferredName || user?.legalName || user?.badge || null,
        approvedSchemaHash: latestSchema?.schemaHash ?? null,
      },
    }));
    setEntryMode("review");

    const nextTab = tabs[activeIndex + 1];
    if (nextTab) {
      setActiveSlug(nextTab.slug);
      return {
        approvedSlug: activeSlug,
        nextSlug: nextTab.slug,
        isFinalSheet: false,
      };
    }

    toast({
      title: "Sheet approved",
      description: "This sheet is ready to be combined into the final multi-sheet export.",
      duration: 2500,
    });

    return {
      approvedSlug: activeSlug,
      nextSlug: null,
      isFinalSheet: true,
    };
  }, [activeIndex, activeResources?.brandSchema, activeSlug, regenerateBrandSchemaForSheet, tabs, toast, user?.badge, user?.legalName, user?.preferredName]);

  const handleUnapproveSheet = useCallback(() => {
    if (!activeSlug) {
      return;
    }

    setApprovedSlugs((prev) => prev.filter((slug) => slug !== activeSlug));
    setEditedAfterApprovalSlugs((prev) => prev.filter((slug) => slug !== activeSlug));
    setSheetReviews((prev) => {
      const next = { ...prev };
      delete next[activeSlug];
      return next;
    });
    setExportResult(null);
    toast({
      title: "Sheet unapproved",
      description: "This sheet has been moved back to review and the combined export has been cleared.",
      duration: 2500,
    });
  }, [activeSlug, toast]);

  const handleCombine = useCallback(async (): Promise<MultiSheetPrintExportResult> => {
    if (!projectId) {
      throw new Error("Project context required");
    }

    setIsCombining(true);

    try {
      const approvedSheetSlugs = tabs.filter((tab) => approvedSlugs.includes(tab.slug)).map((tab) => tab.slug);
      await Promise.all(
        approvedSheetSlugs.map((sheetSlug) => pendingBrandSchemaSaveRef.current[sheetSlug]).filter(Boolean),
      );

      const missingBrandSchemas = approvedSheetSlugs.filter((sheetSlug) => !resourceMap[sheetSlug]?.brandSchema);
      await Promise.all(missingBrandSchemas.map((sheetSlug) => regenerateBrandSchemaForSheet(sheetSlug)));

      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approvedSheetSlugs }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const result = await response.json() as MultiSheetPrintExportResult;
      setExportResult(result);
      setExportFileState({
        brandingWorkbookExists: Boolean(result.brandingWorkbook),
        wireListSchemaExists: Boolean(result.wireListSchema),
        manifestFileExists: Boolean(result.manifestFile),
      });
      if (typeof window !== "undefined" && result.brandingWorkbook?.relativePath) {
        const href = buildExportDownloadHref(projectId, result.brandingWorkbook.relativePath);
        window.open(href, "_blank", "noopener,noreferrer");
      }
      toast({
        title: "Combined export ready",
        description: result.brandingWorkbook
          ? `${result.approvedSheets.length} sheets merged and the workbook download has started.`
          : `${result.approvedSheets.length} sheets merged into shared project exports.`,
        duration: 3500,
      });
      return result;
    } catch (error) {
      toast({
        title: "Combine failed",
        description: error instanceof Error ? error.message : "Failed to generate combined print export",
        duration: 4000,
      });
      throw error;
    } finally {
      setIsCombining(false);
    }
  }, [approvedSlugs, projectId, regenerateBrandSchemaForSheet, resourceMap, tabs, toast]);

  const refreshSheetResources = useCallback(async (sheetSlug: string) => {
    await loadResourcesForSheet(sheetSlug, true);
  }, [loadResourcesForSheet]);

  const markSheetsChangedAfterImport = useCallback((sheetSlugs: string[]) => {
    if (!sheetSlugs.length) {
      return;
    }

    const changed = new Set(sheetSlugs);
    const previouslyApproved = approvedSlugs.filter((slug) => changed.has(slug));
    setApprovedSlugs((prev) => prev.filter((slug) => !changed.has(slug)));
    if (previouslyApproved.length > 0) {
      setEditedAfterApprovalSlugs((prev) => Array.from(new Set([...prev, ...previouslyApproved])));
    }
    setSheetReviews((prev) => {
      const next = { ...prev };
      for (const slug of sheetSlugs) {
        delete next[slug];
      }
      return next;
    });
    setExportResult(null);
    setExportFileState(null);
    setEntryMode("review");
  }, [approvedSlugs]);

  return {
    activeSlug,
    setActiveSlug,
    resourceMap,
    setResourceMap,
    loadingSlug,
    approvedSlugs,
    sheetReviews,
    isCombining,
    exportResult,
    hasLoadedSession,
    selectedBrandRows,
    setSelectedBrandRows,
    savedBrandSchemaSlugs,
    exportFileState,
    editedAfterApprovalSlugs,
    pendingBrandSchemaSlugs,
    entryMode,
    setEntryMode,
    importSession,
    setImportSession,
    isSavingBrandSchema: pendingBrandSchemaSlugs.length > 0,
    activeIndex,
    activeTab,
    activeResources,
    activeBrandSchema,
    activeBrandRowIds,
    reviewState,
    loadResourcesForSheet,
    refreshSheetResources,
    refreshSession,
    refreshSavedBrandSchemas,
    markSheetsChangedAfterImport,
    persistBrandSchema,
    updateActiveBrandSchema,
    renameBrandBundle,
    updateBrandSchemaRow,
    addBrandSchemaRow,
    removeBrandSchemaRow,
    updateBrandSchemaProjectInfo,
    toggleSelectedBrandRow,
    toggleSelectedBrandRowGroup,
    duplicateSelectedBrandRows,
    incrementSelectedBrandLengths,
    regenerateBrandSchemaForSheet,
    handleApproveSheet,
    handleUnapproveSheet,
    handleCombine,
  };
}
