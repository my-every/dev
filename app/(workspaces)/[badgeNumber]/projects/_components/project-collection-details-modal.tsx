"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Package,
  Pencil,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DateField,
  LwcTypeField,
  PdNumberField,
  RevisionField,
  UnitNumberField,
} from "@/components/projects/fields";
import { cn } from "@/lib/utils";
import type { LegalProjectRecord } from "@/types/legal-drawings";
import type { ProjectManifest } from "@/types/project-manifest";
import { MultiSheetWireListModal } from "@/components/wire-list/multi-sheet-wire-list-modal";

import { ProjectIcon } from "./project-icon";

interface ProjectCollectionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badgeNumber: string;
  project: ProjectManifest | null;
}

interface BrandingExportResult {
  generatedAt: string;
  sheetExports: Array<{
    sheetSlug: string;
    sheetName: string;
    rowCount: number;
    fileName: string;
    relativePath: string;
  }>;
  combinedFileName?: string;
  combinedRelativePath?: string;
}

interface WireListExportResult {
  generatedAt: string;
  sheetExports: Array<{
    sheetSlug: string;
    sheetName: string;
    rowCount: number;
    fileName: string;
    relativePath: string;
  }>;
}

type WireListSettingsMatrix = Record<string, Record<string, boolean>>;

type ProjectDetailsTab =
  | "details"
  | "assignments"
  | "legals"
  | "brand-lists"
  | "wire-lists"
  | "cross-wire";

type EditableProjectFields = Pick<
  ProjectManifest,
  | "name"
  | "unitNumber"
  | "revision"
  | "lwcType"
  | "dueDate"
  | "planConlayDate"
  | "planConassyDate"
  | "shipDate"
  | "status"
  | "color"
>;

function buildExportFileHref(projectId: string, relativePath: string): string {
  const normalized = relativePath.replace(/^exports\//, "");
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${segments}?download=1`;
}

function buildWireListPrintHref(
  projectId: string,
  sheetSlug: string,
  autoPrint = false,
): string {
  const base = `/print/project-context/${encodeURIComponent(projectId)}/wire-list/${encodeURIComponent(sheetSlug)}`;
  return autoPrint ? `${base}?autoprint=1` : base;
}

function formatDateValue(value?: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseDateInputValue(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatTokenLabel(value?: string | null): string {
  if (!value) return "Unknown";
  return value.replace(/[_-]+/g, " ");
}

function formatList(values: string[] | undefined, emptyLabel: string): string {
  if (!values || values.length === 0) return emptyLabel;
  return values.join(", ");
}

function hasUploadedLegalArtifacts(project: ProjectManifest): boolean {
  const hasOperationalSheets = (project.sheets ?? []).some(
    (sheet) => sheet.kind === "operational" && sheet.hasData,
  );
  return (
    hasOperationalSheets ||
    Boolean(project.activeWorkbookRevisionId) ||
    Boolean(project.activeLayoutRevisionId)
  );
}

function normalizeManifestAfterLegalUpload(
  manifest: ProjectManifest,
): ProjectManifest {
  if (!hasUploadedLegalArtifacts(manifest)) {
    return manifest;
  }

  const normalizedStatus =
    manifest.status === "legals_pending" ? "brandlist" : manifest.status;
  const normalizedLifecycleGates = manifest.lifecycleGates?.map((gate) => {
    if (gate.gateId === "BRANDLIST_COMPLETE" && gate.status === "LOCKED") {
      return {
        ...gate,
        status: "READY" as const,
      };
    }
    return gate;
  });

  if (
    normalizedStatus === manifest.status &&
    normalizedLifecycleGates === manifest.lifecycleGates
  ) {
    return manifest;
  }

  return {
    ...manifest,
    status: normalizedStatus,
    lifecycleGates: normalizedLifecycleGates,
  };
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4">
      <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="py-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b pb-3">
      <div className="rounded-lg bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ProjectCollectionDetailsModal({
  open,
  onOpenChange,
  badgeNumber,
  project,
}: ProjectCollectionDetailsModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProjectDetailsTab>("details");
  const [projectState, setProjectState] = useState<ProjectManifest | null>(
    project,
  );
  const [editDraft, setEditDraft] = useState<ProjectManifest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [legalDetail, setLegalDetail] = useState<LegalProjectRecord | null>(
    null,
  );
  const [loadingLegals, setLoadingLegals] = useState(false);

  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const workbookInputRef = useRef<HTMLInputElement | null>(null);
  const layoutInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingLegals, setUploadingLegals] = useState(false);
  const [legalsMessage, setLegalsMessage] = useState<string | null>(null);

  const [brandingExports, setBrandingExports] =
    useState<BrandingExportResult | null>(null);
  const [wireExports, setWireExports] = useState<WireListExportResult | null>(
    null,
  );
  const [loadingBrandingExports, setLoadingBrandingExports] = useState(false);
  const [loadingWireExports, setLoadingWireExports] = useState(false);
  const [regeneratingBranding, setRegeneratingBranding] = useState(false);
  const [regeneratingWire, setRegeneratingWire] = useState(false);

  const [wireGeneratingSheets, setWireGeneratingSheets] = useState<
    Record<string, "idle" | "generating" | "done" | "error">
  >({});
  const [brandGeneratingSheets, setBrandGeneratingSheets] = useState<
    Record<string, "idle" | "generating" | "done" | "error">
  >({});
  const [wireListSettingsMatrix, setWireListSettingsMatrix] =
    useState<WireListSettingsMatrix>({});
  const [savingWireListSettings, setSavingWireListSettings] = useState(false);
  const [wireListSettingsMessage, setWireListSettingsMessage] = useState<
    string | null
  >(null);
  const [schemaExternalLocations, setSchemaExternalLocations] = useState<
    Record<string, string[]>
  >({});
  const [loadingSchemaLocations, setLoadingSchemaLocations] = useState(false);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAssignmentSlug, setSelectedAssignmentSlug] = useState<
    string | null
  >(null);

  const [wireReviewOpen, setWireReviewOpen] = useState(false);
  const hasChildWorkflowOpen = wireReviewOpen;
  const collectionModalOpen = open && !hasChildWorkflowOpen;

  useEffect(() => {
    if (!open) {
      setProjectState(project);
      setEditDraft(null);
      setIsEditing(false);
      setSaveError(null);
      setActiveTab("details");
      setWorkbookFile(null);
      setLayoutFile(null);
      setLegalsMessage(null);
      setExpandedAssignments(new Set());
      setSelectedAssignmentSlug(null);
      return;
    }

    setProjectState(project);
    setEditDraft(null);
    setIsEditing(false);
    setSaveError(null);
  }, [open, project]);

  const currentProject = isEditing ? editDraft : projectState;

  const operationalSheets = useMemo(
    () =>
      (currentProject?.sheets ?? []).filter(
        (sheet) => sheet.kind === "operational",
      ),
    [currentProject?.sheets],
  );

  const assignmentEntries = useMemo(
    () =>
      Object.values(currentProject?.assignments ?? {}).sort((left, right) =>
        left.sheetName.localeCompare(right.sheetName),
      ),
    [currentProject?.assignments],
  );

  const selectedAssignment = useMemo(
    () =>
      assignmentEntries.find(
        (assignment) => assignment.sheetSlug === selectedAssignmentSlug,
      ) ?? null,
    [assignmentEntries, selectedAssignmentSlug],
  );

  const anyAssignmentHasLocations = useMemo(
    () =>
      assignmentEntries.some(
        (a) => (schemaExternalLocations[a.sheetSlug] ?? []).length > 0,
      ),
    [assignmentEntries, schemaExternalLocations],
  );

  useEffect(() => {
    if (!currentProject) {
      setWireListSettingsMatrix({});
      return;
    }

    const nextMatrix: WireListSettingsMatrix = {};
    for (const assignment of assignmentEntries) {
      const existingByKey = new Map(
        (assignment.externalLocations ?? []).map((item) => [
          String(item.location ?? "")
            .trim()
            .toUpperCase(),
          item,
        ]),
      );
      const row: Record<string, boolean> = {};
      for (const location of schemaExternalLocations[assignment.sheetSlug] ??
        []) {
        const key = location.trim().toUpperCase();
        if (key) row[key] = existingByKey.get(key)?.wireListVisible ?? true;
      }
      nextMatrix[assignment.sheetSlug] = row;
    }

    setWireListSettingsMatrix(nextMatrix);
  }, [assignmentEntries, currentProject, schemaExternalLocations]);

  const refreshLegalDetail = useCallback(async () => {
    if (!projectState?.pdNumber) {
      setLegalDetail(null);
      return;
    }

    setLoadingLegals(true);
    try {
      const response = await fetch(
        `/api/legal-drawings/${encodeURIComponent(projectState.pdNumber)}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        setLegalDetail(null);
        return;
      }
      const payload = (await response.json()) as LegalProjectRecord;
      setLegalDetail(payload);
    } finally {
      setLoadingLegals(false);
    }
  }, [projectState?.pdNumber]);

  const refreshBrandingExports = useCallback(async () => {
    if (!projectState?.id) {
      setBrandingExports(null);
      return;
    }

    setLoadingBrandingExports(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectState.id)}/exports?kind=branding`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        setBrandingExports(null);
        return;
      }
      setBrandingExports((await response.json()) as BrandingExportResult);
    } finally {
      setLoadingBrandingExports(false);
    }
  }, [projectState?.id]);

  const refreshWireExports = useCallback(async () => {
    if (!projectState?.id) {
      setWireExports(null);
      return;
    }

    setLoadingWireExports(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectState.id)}/exports?kind=wire-lists`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        setWireExports(null);
        return;
      }
      setWireExports((await response.json()) as WireListExportResult);
    } finally {
      setLoadingWireExports(false);
    }
  }, [projectState?.id]);

  const refreshSchemaLocations = useCallback(async () => {
    if (!projectState?.id || assignmentEntries.length === 0) {
      setSchemaExternalLocations({});
      return;
    }

    setLoadingSchemaLocations(true);
    try {
      const results = await Promise.allSettled(
        assignmentEntries.map(async (assignment) => {
          const response = await fetch(
            `/api/projects/${encodeURIComponent(projectState.id)}/wire-list-print-schemas?sheet=${encodeURIComponent(assignment.sheetSlug)}`,
            { cache: "no-store" },
          );
          if (!response.ok)
            return [assignment.sheetSlug, [] as string[]] as const;
          const schema = (await response.json()) as {
            pages?: Array<{
              pageType: string;
              locationGroups?: Array<{ location: string; isExternal: boolean }>;
            }>;
          };
          const tocPage = schema.pages?.find((p) => p.pageType === "toc");
          const locations = (tocPage?.locationGroups ?? [])
            .filter((g) => g.isExternal === true)
            .map((g) => String(g.location ?? "").trim())
            .filter(Boolean);
          return [
            assignment.sheetSlug,
            [...new Set(locations)].sort(),
          ] as const;
        }),
      );

      const next: Record<string, string[]> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          const [slug, locations] = result.value;
          next[slug] = locations;
        }
      }
      setSchemaExternalLocations(next);
    } finally {
      setLoadingSchemaLocations(false);
    }
  }, [projectState?.id, assignmentEntries]);

  useEffect(() => {
    if (!open || !projectState) {
      return;
    }

    void refreshLegalDetail();
    void refreshBrandingExports();
    void refreshWireExports();
    void refreshSchemaLocations();
  }, [
    open,
    projectState,
    refreshBrandingExports,
    refreshLegalDetail,
    refreshWireExports,
    refreshSchemaLocations,
  ]);

  const startEditing = useCallback(() => {
    if (!projectState) return;
    setActiveTab("details");
    setEditDraft({ ...projectState });
    setSaveError(null);
    setIsEditing(true);
  }, [projectState]);

  const cancelEditing = useCallback(() => {
    setEditDraft(null);
    setSaveError(null);
    setIsEditing(false);
  }, []);

  const setProjectField = useCallback(
    <K extends keyof EditableProjectFields>(
      key: K,
      value: EditableProjectFields[K],
    ) => {
      setEditDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!projectState || !editDraft) return;

    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectState.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        manifest?: ProjectManifest;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save project details.");
      }

      setProjectState(payload.manifest ?? editDraft);
      setEditDraft(null);
      setIsEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save project details.",
      );
    } finally {
      setSaving(false);
    }
  }, [editDraft, projectState]);

  const setWireListLocationVisibility = useCallback(
    (sheetSlug: string, location: string, visible: boolean) => {
      setWireListSettingsMatrix((prev) => ({
        ...prev,
        [sheetSlug]: {
          ...(prev[sheetSlug] ?? {}),
          [location]: visible,
        },
      }));
    },
    [],
  );

  const handleSaveWireListSettings = useCallback(async () => {
    if (!currentProject) return;

    setSavingWireListSettings(true);
    setWireListSettingsMessage(null);
    try {
      const nextAssignments = Object.fromEntries(
        assignmentEntries.map((assignment) => {
          const existingByKey = new Map(
            (assignment.externalLocations ?? []).map((item) => [
              String(item.location ?? "")
                .trim()
                .toUpperCase(),
              item,
            ]),
          );

          // Use schema-derived locations as the canonical set; fall back to existing entries
          const schemaLocations =
            schemaExternalLocations[assignment.sheetSlug] ?? [];
          const schemaKeys = new Set(
            schemaLocations.map((l) => l.trim().toUpperCase()),
          );

          const externalLocations = schemaLocations.map((location) => {
            const key = location.trim().toUpperCase();
            const existing = existingByKey.get(key);
            return {
              location,
              wireListVisible:
                wireListSettingsMatrix[assignment.sheetSlug]?.[key] ??
                existing?.wireListVisible ??
                true,
              brandingVisible: existing?.brandingVisible ?? true,
            };
          });

          // Preserve any existing entries not covered by the schema (e.g. brandingVisible-only entries)
          for (const [key, existing] of existingByKey) {
            if (!schemaKeys.has(key)) {
              externalLocations.push({
                location: String(existing.location ?? ""),
                wireListVisible: existing.wireListVisible ?? true,
                brandingVisible: existing.brandingVisible ?? true,
              });
            }
          }

          return [assignment.sheetSlug, { ...assignment, externalLocations }];
        }),
      );

      const nextManifest: ProjectManifest = {
        ...currentProject,
        assignments: nextAssignments,
      };

      const response = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextManifest),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        manifest?: ProjectManifest;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save wire list settings.");
      }

      // Merge our locally-built assignments (with the user's updated wireListVisible values)
      // into the server's manifest so enrichment side-effects (layout, labels, etc.) are
      // preserved while our externalLocations edits are never overwritten by re-enrichment.
      const serverManifest = payload.manifest ?? nextManifest;
      const mergedManifest: ProjectManifest = {
        ...serverManifest,
        assignments: {
          ...serverManifest.assignments,
          ...nextAssignments,
        },
      };
      setProjectState(mergedManifest);
      setWireListSettingsMessage("Wire list settings saved.");
    } catch (error) {
      setWireListSettingsMessage(
        error instanceof Error
          ? error.message
          : "Failed to save wire list settings.",
      );
    } finally {
      setSavingWireListSettings(false);
    }
  }, [
    assignmentEntries,
    currentProject,
    schemaExternalLocations,
    wireListSettingsMatrix,
  ]);

  if (!currentProject) return null;

  const openBrandReview = () => {
    setWireReviewOpen(false);
    onOpenChange(false);
    router.push(
      `/${badgeNumber}/projects/${encodeURIComponent(currentProject.id)}?action=brand-workspace`,
    );
  };

  const openLayoutWorkspace = () => {
    setWireReviewOpen(false);
    onOpenChange(false);
    router.push(
      `/${badgeNumber}/projects/${encodeURIComponent(currentProject.id)}?action=layout-workspace`,
    );
  };

  const openWireReview = () => {
    setWireReviewOpen(true);
  };

  const handleUploadLegals = async () => {
    if (!currentProject.id) {
      return;
    }

    if (!workbookFile && !layoutFile) {
      setLegalsMessage("Select a workbook or layout PDF first.");
      return;
    }

    setUploadingLegals(true);
    setLegalsMessage(null);
    try {
      const formData = new FormData();
      formData.set("pdNumber", currentProject.pdNumber);
      if (workbookFile) formData.set("workbook", workbookFile);
      if (layoutFile) formData.set("layout", layoutFile);

      const response = await fetch(
        `/api/projects/revisions/${encodeURIComponent(currentProject.id)}/files`,
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setLegalsMessage(payload.error || "Failed to upload legal files.");
        return;
      }

      setWorkbookFile(null);
      setLayoutFile(null);
      if (workbookInputRef.current) workbookInputRef.current.value = "";
      if (layoutInputRef.current) layoutInputRef.current.value = "";
      const refreshedManifestResponse = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}`,
        {
          cache: "no-store",
        },
      );
      if (refreshedManifestResponse.ok) {
        const refreshedPayload = (await refreshedManifestResponse.json()) as {
          manifest?: ProjectManifest;
        };
        if (refreshedPayload.manifest) {
          const normalizedManifest = normalizeManifestAfterLegalUpload(
            refreshedPayload.manifest,
          );
          if (normalizedManifest !== refreshedPayload.manifest) {
            await fetch(
              `/api/projects/${encodeURIComponent(currentProject.id)}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(normalizedManifest),
              },
            ).catch(() => null);
          }
          setProjectState(normalizedManifest);
        }
      }
      setLegalsMessage("Legal files uploaded and schemas regenerated.");
      void refreshLegalDetail();
      void refreshBrandingExports();
      void refreshWireExports();
    } finally {
      setUploadingLegals(false);
    }
  };

  const handleRegenerateBrandingExports = async (combine = false) => {
    if (!currentProject?.id) return;

    const slugs = Object.keys(currentProject.assignments ?? {});
    const initialState = Object.fromEntries(
      slugs.map((s) => [s, "generating" as const]),
    );
    setBrandGeneratingSheets(initialState);
    setRegeneratingBranding(true);
    try {
      const url = `/api/projects/${encodeURIComponent(currentProject.id)}/exports?kind=branding${combine ? "&combine=1" : ""}`;
      const response = await fetch(url, { method: "POST" });
      if (response.ok) {
        const result = (await response.json()) as BrandingExportResult;
        const doneState: Record<string, "done" | "error"> = {};
        for (const slug of slugs) {
          doneState[slug] = result.sheetExports.some(
            (e) => e.sheetSlug === slug,
          )
            ? "done"
            : "error";
        }
        setBrandGeneratingSheets(doneState);
        setBrandingExports(result);
      } else {
        setBrandGeneratingSheets(
          Object.fromEntries(slugs.map((s) => [s, "error" as const])),
        );
        await refreshBrandingExports();
      }
    } catch {
      setBrandGeneratingSheets(
        Object.fromEntries(slugs.map((s) => [s, "error" as const])),
      );
    } finally {
      setRegeneratingBranding(false);
    }
  };

  const handleRegenerateWireExports = async () => {
    if (!currentProject?.id) return;

    const slugs = Object.keys(currentProject.assignments ?? {});
    const initialState = Object.fromEntries(
      slugs.map((s) => [s, "generating" as const]),
    );
    setWireGeneratingSheets(initialState);
    setRegeneratingWire(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/exports?kind=wire-lists`,
        {
          method: "POST",
        },
      );
      if (response.ok) {
        const result = (await response.json()) as WireListExportResult;
        const doneState: Record<string, "done" | "error"> = {};
        for (const slug of slugs) {
          doneState[slug] = result.sheetExports.some(
            (e) => e.sheetSlug === slug,
          )
            ? "done"
            : "error";
        }
        setWireGeneratingSheets(doneState);
        setWireExports(result);
      } else {
        setWireGeneratingSheets(
          Object.fromEntries(slugs.map((s) => [s, "error" as const])),
        );
        await refreshWireExports();
      }
    } catch {
      setWireGeneratingSheets(
        Object.fromEntries(slugs.map((s) => [s, "error" as const])),
      );
    } finally {
      setRegeneratingWire(false);
    }
  };

  const headerRevision =
    legalDetail?.latestRevision ?? currentProject.revision ?? "—";
  const tabItems: Array<{
    id: ProjectDetailsTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    editable: boolean;
  }> = [
    { id: "details", label: "Details", icon: FileText, editable: true },
    { id: "legals", label: "Legals", icon: Upload, editable: false },
    {
      id: "brand-lists",
      label: "Brand Lists",
      icon: FileSpreadsheet,
      editable: false,
    },
    { id: "wire-lists", label: "Wire Lists", icon: Layers, editable: false },
    {
      id: "cross-wire",
      label: "Cross Wire",
      icon: ExternalLink,
      editable: false,
    },
  ];

  return (
    <>
      <Dialog
        open={collectionModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            cancelEditing();
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="max-w-[98vw]! h-[90vh] w-full flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex shrink-0 items-center gap-3 border-b px-4 py-3 justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ProjectIcon
                name={currentProject.name}
                color={currentProject.color ?? undefined}
                interactive={false}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-lg font-semibold">
                  {currentProject.name}
                </DialogTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {currentProject.pdNumber}
                  </span>
                  <span className="text-muted-foreground/30">·</span>
                  <Badge
                    variant="outline"
                    className="h-5 text-[10px] font-mono"
                  >
                    Rev {headerRevision}
                  </Badge>
                  {currentProject.lwcType ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      {currentProject.lwcType}
                    </Badge>
                  ) : null}
                  {currentProject.status ? (
                    <Badge variant="outline" className="h-5 text-[10px]">
                      {formatTokenLabel(currentProject.status)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <DialogDescription className="sr-only">
                Project details for {currentProject.name} (
                {currentProject.pdNumber})
              </DialogDescription>
            </div>
            {!loadingLegals ? (
              <div className="shrink-0">
                {isEditing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditing}
                    className="h-8 px-3 text-muted-foreground"
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEditing}
                    className="h-8 px-3"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            ) : null}
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ProjectDetailsTab)}
            className="flex h-full flex-1"
          >
            <div className="w-48 shrink-0 border-r bg-muted/30 p-3 ">
              <TabsList className="h-auto w-full flex-col gap-1 bg-transparent p-0">
                {tabItems.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isDisabled = isEditing && !tab.editable;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      disabled={isDisabled}
                      className={cn(
                        "w-full justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                        "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                        isDisabled &&
                          "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                      {isActive ? (
                        <ChevronRight className="ml-auto h-3 w-3 shrink-0" />
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 h-full overflow-y-auto p-6">
              <TabsContent value="details" className="mt-0 space-y-4">
                <SectionHeader
                  icon={FileText}
                  title="Details"
                  description="Scheduling dates, status, and color metadata for this project instance"
                />

                {isEditing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1.5 md:col-span-2">
                      <Label
                        htmlFor="project-name"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Project Name
                      </Label>
                      <Input
                        id="project-name"
                        value={currentProject.name}
                        onChange={(event) =>
                          setProjectField("name", event.target.value)
                        }
                        className="h-9 text-sm"
                      />
                    </div>

                    <PdNumberField
                      mode="create"
                      label="PD Number"
                      value={currentProject.pdNumber || ""}
                      disabled
                      description="PD number is managed by project identity."
                    />

                    <UnitNumberField
                      mode="create"
                      label="Unit"
                      value={currentProject.unitNumber || ""}
                      onChange={(value) => setProjectField("unitNumber", value)}
                    />

                    <RevisionField
                      mode="create"
                      label="Revision"
                      value={currentProject.revision || ""}
                      onChange={(value) => setProjectField("revision", value)}
                    />

                    <LwcTypeField
                      mode="create"
                      label="LWC Type"
                      value={currentProject.lwcType ?? undefined}
                      onChange={(value) => setProjectField("lwcType", value)}
                      showRegistryDescription={false}
                    />

                    <DateField
                      mode="create"
                      label="Due Date"
                      value={parseDateInputValue(currentProject.dueDate)}
                      onChange={(date) =>
                        setProjectField(
                          "dueDate",
                          date ? date.toISOString().slice(0, 10) : null,
                        )
                      }
                    />

                    <DateField
                      mode="create"
                      label="Plan ConLay"
                      value={parseDateInputValue(currentProject.planConlayDate)}
                      onChange={(date) =>
                        setProjectField(
                          "planConlayDate",
                          date ? date.toISOString().slice(0, 10) : null,
                        )
                      }
                    />

                    <DateField
                      mode="create"
                      label="Plan ConAssy"
                      value={parseDateInputValue(
                        currentProject.planConassyDate,
                      )}
                      onChange={(date) =>
                        setProjectField(
                          "planConassyDate",
                          date ? date.toISOString().slice(0, 10) : null,
                        )
                      }
                    />

                    <DateField
                      mode="create"
                      label="Ship Date"
                      value={parseDateInputValue(currentProject.shipDate)}
                      onChange={(date) =>
                        setProjectField(
                          "shipDate",
                          date ? date.toISOString().slice(0, 10) : null,
                        )
                      }
                    />

                    <div className="grid gap-1.5 md:col-span-2">
                      <Label
                        htmlFor="project-status"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Status
                      </Label>
                      <Input
                        id="project-status"
                        value={String(currentProject.status || "")}
                        onChange={(event) =>
                          setProjectField("status", event.target.value)
                        }
                        className="h-9 text-sm"
                        placeholder="Status"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <DetailRow icon={FileText} label="Project Name">
                      {currentProject.name}
                    </DetailRow>
                    <DetailRow icon={FileText} label="PD Number">
                      {currentProject.pdNumber || "Not set"}
                    </DetailRow>
                    <DetailRow icon={Package} label="Unit">
                      {currentProject.unitNumber
                        ? `Unit ${currentProject.unitNumber}`
                        : "Not set"}
                    </DetailRow>
                    <DetailRow icon={GitBranch} label="Revision">
                      {currentProject.revision || "Not set"}
                    </DetailRow>
                    <DetailRow icon={Layers} label="LWC Type">
                      {String(currentProject.lwcType || "Not set")}
                    </DetailRow>
                    <DetailRow icon={Calendar} label="Due Date">
                      {formatDateValue(currentProject.dueDate)}
                    </DetailRow>
                    <DetailRow icon={Calendar} label="Plan ConLay">
                      {formatDateValue(
                        currentProject.planConlayDate ||
                          legalDetail?.planConlayDate ||
                          null,
                      )}
                    </DetailRow>
                    <DetailRow icon={Calendar} label="Plan ConAssy">
                      {formatDateValue(
                        currentProject.planConassyDate ||
                          legalDetail?.planConassyDate ||
                          null,
                      )}
                    </DetailRow>
                    <DetailRow icon={Calendar} label="Ship Date">
                      {formatDateValue(
                        currentProject.shipDate ||
                          legalDetail?.shipDate ||
                          null,
                      )}
                    </DetailRow>
                    <DetailRow icon={FileText} label="Status">
                      {formatTokenLabel(currentProject.status || "unknown")}
                    </DetailRow>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Project Color
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={currentProject.color || "#ffcc61"}
                        onChange={(event) =>
                          setProjectField("color", event.target.value)
                        }
                        className="h-9 w-12 rounded-md border border-border bg-transparent p-1"
                      />
                      <Input
                        value={currentProject.color || "#ffcc61"}
                        onChange={(event) =>
                          setProjectField("color", event.target.value)
                        }
                        className="h-8 w-40 font-mono text-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className="h-5 w-5 rounded-full border border-border"
                        style={{
                          backgroundColor: currentProject.color || "#ffcc61",
                        }}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {currentProject.color || "#ffcc61"}
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="assignments" className="mt-0 space-y-4">
                <SectionHeader
                  icon={GitBranch}
                  title="Assignments"
                  description="Operational assignments from the current project manifest. Click any row to inspect details."
                />

                {assignmentEntries.length === 0 ? (
                  <EmptyStateCard
                    title="No assignments found in this manifest."
                    description="Upload project content or regenerate the manifest to populate assignment rows."
                  />
                ) : (
                  <div className="flex flex-col gap-4 xl:flex-row">
                    <div className="min-w-0 flex-1 rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 px-3 py-2" />
                            <TableHead className="py-2">Project</TableHead>
                            <TableHead className="py-2">Stage</TableHead>
                            <TableHead className="py-2">Status</TableHead>
                            <TableHead className="py-2">Unit Type</TableHead>
                            <TableHead className="py-2">SWS</TableHead>

                            <TableHead className="py-2" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentEntries.map((assignment, idx) => {
                            const isExpanded = expandedAssignments.has(
                              assignment.sheetSlug,
                            );
                            const toggleExpand = () => {
                              if (isExpanded) {
                                setExpandedAssignments(new Set());
                                setSelectedAssignmentSlug((prev) =>
                                  prev === assignment.sheetSlug ? null : prev,
                                );
                                return;
                              }
                              setExpandedAssignments(
                                new Set([assignment.sheetSlug]),
                              );
                              setSelectedAssignmentSlug(assignment.sheetSlug);
                            };

                            return (
                              <React.Fragment key={assignment.sheetSlug}>
                                <TableRow
                                  index={idx}
                                  className={cn(
                                    "cursor-pointer",
                                    isExpanded && "bg-muted/20",
                                  )}
                                  onClick={toggleExpand}
                                >
                                  <TableCell className="px-3 py-2.5">
                                    <ChevronRight
                                      className={cn(
                                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                                        isExpanded && "rotate-90",
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <div className="text-sm font-medium text-foreground">
                                      {assignment.sheetName}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <Badge
                                      variant="outline"
                                      className="h-5 text-[10px]"
                                    >
                                      {formatTokenLabel(assignment.stage)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <Badge
                                      variant="secondary"
                                      className="h-5 text-[10px]"
                                    >
                                      {formatTokenLabel(assignment.status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2.5 text-sm">
                                    {assignment.unitType || "—"}
                                  </TableCell>
                                  <TableCell className="py-2.5 text-sm">
                                    {assignment.swsType || "—"}
                                  </TableCell>

                                  <TableCell className="py-2.5">
                                    <div
                                      className="flex items-center justify-end gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {assignment.files.wireListPDFPath ? (
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <a
                                            href={buildExportFileHref(
                                              currentProject.id,
                                              assignment.files.wireListPDFPath,
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <Download className="h-3 w-3" />
                                          </a>
                                        </Button>
                                      ) : null}
                                      <Button
                                        asChild
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs"
                                      >
                                        <a
                                          href={`/${badgeNumber}/projects/${encodeURIComponent(currentProject.id)}`}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {isExpanded ? (
                                  <tr className="bg-muted/15">
                                    <td colSpan={10} className="px-4 py-3">
                                      <div className="h-18 rounded-lg border border-dashed border-border/60 bg-background/40" />
                                    </td>
                                  </tr>
                                ) : null}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <aside className="w-full border xl:max-w-70 xl:w-[18rem] xl:border-l-0 xl:h-auto rounded-xl border-border bg-background/40">
                      <div className="h-full flex-col overflow-y-auto p-6">
                        {selectedAssignment ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {selectedAssignment.sheetName}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {selectedAssignment.sheetSlug}
                              </p>
                            </div>
                            <div className="grid gap-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">
                                  Stage
                                </span>
                                <span className="font-medium text-foreground">
                                  {formatTokenLabel(selectedAssignment.stage)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">
                                  Status
                                </span>
                                <span className="font-medium text-foreground">
                                  {formatTokenLabel(selectedAssignment.status)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">
                                  SWS
                                </span>
                                <span className="font-medium text-foreground">
                                  {selectedAssignment.swsType || "—"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">
                                  Parts
                                </span>
                                <span className="font-medium text-foreground">
                                  {selectedAssignment.partNumbers.length}
                                </span>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Reserved Detail Space
                              </p>
                              <div className="h-32 rounded-lg border border-dashed border-border/70 bg-muted/20" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-center">
                            <p className="text-xs text-muted-foreground">
                              Select an assignment row to open inline details.
                            </p>
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="legals" className="mt-0 space-y-4">
                <SectionHeader
                  icon={Upload}
                  title="Legals"
                  description="Upload project legals for revision changes and review revision artifact health"
                />

                <div className="grid gap-3 rounded-xl border border-border bg-background/40 p-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">
                      Workbook (.xlsx/.xls)
                    </span>
                    <input
                      ref={workbookInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onClick={(event) => {
                        (event.currentTarget as HTMLInputElement).value = "";
                      }}
                      onChange={(event) =>
                        setWorkbookFile(event.target.files?.[0] ?? null)
                      }
                      className="block w-full text-xs"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">
                      Layout (.pdf)
                    </span>
                    <input
                      ref={layoutInputRef}
                      type="file"
                      accept=".pdf"
                      onClick={(event) => {
                        (event.currentTarget as HTMLInputElement).value = "";
                      }}
                      onChange={(event) =>
                        setLayoutFile(event.target.files?.[0] ?? null)
                      }
                      className="block w-full text-xs"
                    />
                  </label>

                  <div className="sm:col-span-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleUploadLegals()}
                      disabled={uploadingLegals}
                    >
                      {uploadingLegals ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Upload Legals
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={openLayoutWorkspace}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Layout Workspace
                    </Button>
                    {legalsMessage ? (
                      <span className="text-xs text-muted-foreground">
                        {legalsMessage}
                      </span>
                    ) : null}
                  </div>
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Upload workbook and/or layout to enable revision refresh.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Revisions
                  </div>
                  {loadingLegals ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading legal revisions...
                    </div>
                  ) : !legalDetail?.revisions?.length ? (
                    <EmptyStateCard
                      title="No legal revisions discovered yet."
                      description="Upload workbook and layout files to start revision tracking."
                    />
                  ) : (
                    [...legalDetail.revisions]
                      .sort((left, right) =>
                        right.revision.localeCompare(left.revision),
                      )
                      .map((revision) => {
                        const artifactValues = Object.values(
                          revision.artifacts,
                        );
                        const presentCount =
                          artifactValues.filter(Boolean).length;
                        return (
                          <div
                            key={revision.revision}
                            className="rounded-xl border border-border bg-background/40 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold">
                                {revision.revision}
                              </span>
                              {revision.revision ===
                              legalDetail.latestRevision ? (
                                <Badge className="h-5 border-primary/20 bg-primary/10 text-[10px] text-primary">
                                  Latest
                                </Badge>
                              ) : null}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {presentCount}/{artifactValues.length} artifacts
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </TabsContent>

              <TabsContent value="brand-lists" className="mt-0 space-y-4">
                <SectionHeader
                  icon={FileSpreadsheet}
                  title="Brand Lists"
                  description="Review brand list outputs and download generated files"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      Brand List Exports
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Review, approve, and export brand lists.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        void handleRegenerateBrandingExports(false)
                      }
                      disabled={regeneratingBranding}
                    >
                      {regeneratingBranding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Generate
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleRegenerateBrandingExports(true)}
                      disabled={regeneratingBranding}
                    >
                      {regeneratingBranding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                      )}
                      Generate &amp; Combine
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  {regeneratingBranding ? (
                    <div className="absolute inset-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-background/80 backdrop-blur-sm p-4">
                      <div className="mb-1 text-sm font-semibold">
                        Generating brand lists…
                      </div>
                      {assignmentEntries.map((assignment) => {
                        const state =
                          brandGeneratingSheets[assignment.sheetSlug] ??
                          "generating";
                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="flex items-center gap-2 text-sm"
                          >
                            {state === "generating" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : state === "done" ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-destructive" />
                            )}
                            <span
                              className={cn(
                                "truncate",
                                state === "done" && "text-foreground",
                                state === "error" && "text-destructive",
                              )}
                            >
                              {assignment.sheetName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {loadingBrandingExports ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading brand list exports…
                    </div>
                  ) : !brandingExports ||
                    brandingExports.sheetExports.length === 0 ? (
                    <EmptyStateCard
                      title="No brand lists exported yet."
                      description="Click Generate to produce brand list outputs for all sheets."
                      action={
                        <Button size="sm" onClick={openBrandReview}>
                          Open Brand List Review
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-2">
                      {brandingExports.combinedRelativePath ? (
                        <a
                          href={buildExportFileHref(
                            currentProject.id,
                            brandingExports.combinedRelativePath,
                          )}
                          className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm hover:bg-primary/10"
                        >
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {brandingExports.combinedFileName ||
                                "Combined Brand Workbook"}
                            </span>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      ) : null}

                      {brandingExports.sheetExports.map((entry) => (
                        <a
                          key={entry.relativePath}
                          href={buildExportFileHref(
                            currentProject.id,
                            entry.relativePath,
                          )}
                          className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm hover:bg-muted/50"
                        >
                          <span className="truncate">{entry.fileName}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="wire-lists" className="mt-0 space-y-4">
                <SectionHeader
                  icon={GitBranch}
                  title="Wire Lists"
                  description="Generate, review, and download wire list outputs"
                />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      Wire List Exports
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Generate, review, and download wire list PDFs.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void handleRegenerateWireExports()}
                    disabled={regeneratingWire}
                  >
                    {regeneratingWire ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Generate
                  </Button>
                </div>

                <div className="relative">
                  {regeneratingWire ? (
                    <div className="absolute inset-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-background/80 backdrop-blur-sm p-4">
                      <div className="mb-1 text-sm font-semibold">
                        Generating wire lists…
                      </div>
                      {assignmentEntries.map((assignment) => {
                        const state =
                          wireGeneratingSheets[assignment.sheetSlug] ??
                          "generating";
                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="flex items-center gap-2 text-sm"
                          >
                            {state === "generating" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : state === "done" ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-destructive" />
                            )}
                            <span
                              className={cn(
                                "truncate",
                                state === "done" && "text-foreground",
                                state === "error" && "text-destructive",
                              )}
                            >
                              {assignment.sheetName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {loadingWireExports ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading wire list exports…
                    </div>
                  ) : !wireExports || wireExports.sheetExports.length === 0 ? (
                    <EmptyStateCard
                      title="No wire lists exported yet."
                      description="Click Generate to produce wire list PDFs for all sheets."
                      action={
                        <Button size="sm" onClick={openWireReview}>
                          Open Multi Wire List Modal
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-2">
                      {wireExports.sheetExports.map((entry) => (
                        <a
                          key={entry.relativePath}
                          href={buildExportFileHref(
                            currentProject.id,
                            entry.relativePath,
                          )}
                          className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm hover:bg-muted/50"
                        >
                          <span className="truncate">{entry.fileName}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        Wire List Settings
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Toggle external location visibility by sheet, then open
                        View/Print to launch browser print directly.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleSaveWireListSettings()}
                      disabled={
                        savingWireListSettings ||
                        assignmentEntries.length === 0 ||
                        !anyAssignmentHasLocations
                      }
                    >
                      {savingWireListSettings ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Save Settings
                    </Button>
                  </div>

                  {wireListSettingsMessage ? (
                    <p className="text-xs text-muted-foreground">
                      {wireListSettingsMessage}
                    </p>
                  ) : null}

                  {assignmentEntries.length === 0 ||
                  !anyAssignmentHasLocations ? (
                    <EmptyStateCard
                      title="No external locations found yet."
                      description="Generate wire lists or sync assignment external locations to enable per-sheet visibility toggles."
                    />
                  ) : (
                    <div className="space-y-3">
                      {assignmentEntries.map((assignment) => {
                        const locations = (
                          schemaExternalLocations[assignment.sheetSlug] ?? []
                        )
                          .map((loc) => ({
                            label: loc,
                            key: loc.trim().toUpperCase(),
                          }))
                          .filter((loc) => loc.key);
                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="rounded-lg border border-border overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2">
                              <div>
                                <span className="text-xs font-semibold text-foreground">
                                  {assignment.sheetName}
                                </span>
                                <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                  {assignment.sheetSlug}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  window.open(
                                    buildWireListPrintHref(
                                      currentProject.id,
                                      assignment.sheetSlug,
                                      true,
                                    ),
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View/Print
                              </Button>
                            </div>
                            {loadingSchemaLocations ? (
                              <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading schema locations…
                              </p>
                            ) : locations.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                No external locations found in wire list schema.
                              </p>
                            ) : (
                              <table className="min-w-full border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-border bg-muted/20">
                                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                                      Location
                                    </th>
                                    <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">
                                      Wire List Visible
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {locations.map((loc) => (
                                    <tr
                                      key={loc.key}
                                      className="border-t border-border"
                                    >
                                      <td className="px-3 py-2 font-mono font-medium text-foreground">
                                        {loc.label}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex justify-center">
                                          <Switch
                                            checked={
                                              wireListSettingsMatrix[
                                                assignment.sheetSlug
                                              ]?.[loc.key] ?? true
                                            }
                                            onCheckedChange={(checked) =>
                                              setWireListLocationVisibility(
                                                assignment.sheetSlug,
                                                loc.key,
                                                checked,
                                              )
                                            }
                                            aria-label={`Toggle wire list visibility of ${loc.label} for ${assignment.sheetName}`}
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="cross-wire" className="mt-0 space-y-4">
                <SectionHeader
                  icon={ExternalLink}
                  title="Cross Wire List"
                  description="Preview and print all external wiring connections grouped by unit type"
                />

                <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold">Print Preview</div>
                    <p className="text-xs text-muted-foreground">
                      Opens an interactive editor where you can configure,
                      preview, and print the cross wire list for this project.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/print/project-context/${encodeURIComponent(currentProject.id)}/cross-wire`,
                        "_blank",
                        "noreferrer",
                      )
                    }
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Cross Wire List
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
                  <div className="text-sm font-semibold">Generate Schema</div>
                  <p className="text-xs text-muted-foreground">
                    Rebuilds the cross wire schema from all assignment brand
                    list schemas. Use this after updating wire data.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      window.open(
                        `/print/project-context/${encodeURIComponent(currentProject.id)}/cross-wire?generate=1`,
                        "_blank",
                        "noreferrer",
                      )
                    }
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    Regenerate &amp; Open
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {isEditing ? (
            <div className="flex items-center justify-between gap-3 border-t bg-background px-6 py-3">
              <div className="min-w-0">
                {saveError ? (
                  <p className="truncate text-sm text-destructive">
                    {saveError}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="h-8"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8"
                >
                  {saving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save changes
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <MultiSheetWireListModal
        projectId={currentProject.id}
        currentSheetSlug={operationalSheets[0]?.slug}
        open={wireReviewOpen}
        onOpenChange={(nextOpen) => {
          setWireReviewOpen(nextOpen);
          if (!nextOpen) {
            void refreshWireExports();
          }
        }}
        workspaceMode="wire-list"
        showTrigger={false}
      />
    </>
  );
}
