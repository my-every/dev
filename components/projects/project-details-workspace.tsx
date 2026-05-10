"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Package,
  Palette,
  Pencil,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerSwatch,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DateField,
  LwcTypeField,
  PdNumberField,
  RevisionField,
  UnitNumberField,
} from "@/components/projects/fields";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { LegalProjectRecord } from "@/types/legal-drawings";
import type { ProjectManifest } from "@/types/project-manifest";
import { parseRevisionFromFilename } from "@/lib/revision/types";
import { LayoutPdfWorkspaceDialog } from "@/components/projects/layout-pdf-workspace-dialog";
import { MultiWireListPrintWorkspaceDialog } from "@/components/projects/multi-wire-list-print-workspace-dialog";
import { AssignmentLabelDownloadButton } from "@/components/projects/assignment-label-download-button";
import { StageSelectorCell } from "@/components/projects/assignment-stage-selector-cell";
import { StatusButtonCell } from "@/components/projects/assignment-status-button-cell";
import { useLayoutUI } from "@/components/layout/layout-context";
import { activityService } from "@/lib/services/activity-service";
import type { ActivityAction } from "@/types/activity";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectDetailsWorkspaceProps {
  projectId: string;
  badgeNumber: string;
  initialSection?: string;
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

interface CrossWireSchemaSummary {
  generatedAt: string;
  totalCrossWireRows: number;
  unitTypeGroups?: Array<unknown>;
}

interface ResolvedVisibilityCell {
  wireListVisible: boolean;
  brandingVisible: boolean;
  crossWireVisible: boolean;
  source: "project" | "reference" | "manifest-default";
}

type ResolvedVisibilityBySheet = Record<
  string,
  Record<string, ResolvedVisibilityCell>
>;

type WireListSettingsMatrix = Record<string, Record<string, boolean>>;

interface RevisionRefreshJobProgress {
  uploadStored: boolean;
  legalRevisionBuilt: boolean;
  projectStateRefreshed: boolean;
  wireBrandSchemasGenerated: boolean;
  crossWireSchemaGenerated: boolean;
}

interface RevisionRefreshJob {
  jobId: string;
  projectId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: RevisionRefreshJobProgress;
  error?: string;
}

// ─── Scrollspy Section Definitions ────────────────────────────────────────────

interface ScrollspySection {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const PROJECT_SECTIONS: ScrollspySection[] = [
  { id: "details", label: "Details", icon: <FileText className="h-4 w-4" /> },
  { id: "assignments", label: "Assignments", icon: <GitBranch className="h-4 w-4" /> },
  { id: "legals", label: "Legals", icon: <Upload className="h-4 w-4" /> },
  { id: "brand-lists", label: "Brand Lists", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: "wire-lists", label: "Wire Lists", icon: <Layers className="h-4 w-4" /> },
  { id: "cross-wire", label: "Cross Wire", icon: <ExternalLink className="h-4 w-4" /> },
];

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active", dot: "bg-green-500" },
  { value: "paused", label: "Paused", dot: "bg-yellow-500" },
  { value: "completed", label: "Completed", dot: "bg-blue-500" },
  { value: "cancelled", label: "Cancelled", dot: "bg-red-500" },
] as const;

// ─── Helper Components ────────────────────────────────────────────────────────

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
    <div className="flex items-start gap-3 pb-3 border-b border-border/60">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
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
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 px-4 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// ─── Scrollspy Navigation Components ──────────────────────────────────────────

function NavItem({
  section,
  active,
  onClick,
}: {
  section: ScrollspySection;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <span className="shrink-0">{section.icon}</span>
      <span className="truncate">{section.label}</span>
    </button>
  );
}

function MobileNavDrawer({
  sections,
  activeId,
  onSelect,
}: {
  sections: ScrollspySection[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = sections.find((s) => s.id === activeId);

  return (
    <div className="relative border-b border-border bg-background px-4 py-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          {active?.icon ? <span className="shrink-0">{active.icon}</span> : null}
          <span>{active?.label ?? "Navigate…"}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-border bg-background px-4 py-2 shadow-md">
          <div className="space-y-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  onSelect(section.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  section.id === activeId
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span className="shrink-0">{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function formatDateValue(value: string | null | undefined): string {
  if (!value) return "Not set";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function formatTokenLabel(token: string): string {
  return token
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseDateInputValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProjectDetailsWorkspace({
  projectId,
  badgeNumber,
  initialSection = "details",
}: ProjectDetailsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { flashAside } = useLayoutUI();
  
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isScrollingRef = useRef(false);
  
  const [activeSection, setActiveSection] = useState(initialSection);
  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [editDraft, setEditDraft] = useState<ProjectManifest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [legalDetail, setLegalDetail] = useState<LegalProjectRecord | null>(null);
  const [hasLoadedLegals, setHasLoadedLegals] = useState(false);
  const [loadingLegals, setLoadingLegals] = useState(false);

  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [greenChangesFile, setGreenChangesFile] = useState<File | null>(null);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const workbookInputRef = useRef<HTMLInputElement | null>(null);
  const greenChangesInputRef = useRef<HTMLInputElement | null>(null);
  const layoutInputRef = useRef<HTMLInputElement | null>(null);
  const [revisionNameDraft, setRevisionNameDraft] = useState("");
  const [revisionNameTouched, setRevisionNameTouched] = useState(false);
  const [uploadingLegals, setUploadingLegals] = useState(false);
  const [legalsMessage, setLegalsMessage] = useState<string | null>(null);
  const [resolvedVisibilityBySheet, setResolvedVisibilityBySheet] = useState<ResolvedVisibilityBySheet>({});
  const [refreshJob, setRefreshJob] = useState<RevisionRefreshJob | null>(null);
  const refreshJobPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [brandingExports, setBrandingExports] = useState<BrandingExportResult | null>(null);
  const [hasLoadedBrandingExports, setHasLoadedBrandingExports] = useState(false);
  const [wireExports, setWireExports] = useState<WireListExportResult | null>(null);
  const [hasLoadedWireExports, setHasLoadedWireExports] = useState(false);
  const [loadingBrandingExports, setLoadingBrandingExports] = useState(false);
  const [loadingWireExports, setLoadingWireExports] = useState(false);
  const [regeneratingBranding, setRegeneratingBranding] = useState(false);
  const [regeneratingWire, setRegeneratingWire] = useState(false);

  const [wireGeneratingSheets, setWireGeneratingSheets] = useState<Record<string, "idle" | "generating" | "done" | "error">>({});
  const [brandGeneratingSheets, setBrandGeneratingSheets] = useState<Record<string, "idle" | "generating" | "done" | "error">>({});
  const [wireListSettingsMatrix, setWireListSettingsMatrix] = useState<WireListSettingsMatrix>({});
  const [savingWireListSettings, setSavingWireListSettings] = useState(false);
  const [savingWireListSettingsBySheet, setSavingWireListSettingsBySheet] = useState<Record<string, boolean>>({});
  const [regeneratingWireBySheet, setRegeneratingWireBySheet] = useState<Record<string, boolean>>({});
  const [wireListSettingsMessage, setWireListSettingsMessage] = useState<string | null>(null);
  const [schemaExternalLocations, setSchemaExternalLocations] = useState<Record<string, string[]>>({});
  const [loadingSchemaLocations, setLoadingSchemaLocations] = useState(false);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [expandedBrandAssignments, setExpandedBrandAssignments] = useState<Set<string>>(new Set());
  const [expandedCrossAssignments, setExpandedCrossAssignments] = useState<Set<string>>(new Set());
  const [selectedAssignmentSlug, setSelectedAssignmentSlug] = useState<string | null>(null);
  const [assignmentGroupMode, setAssignmentGroupMode] = useState<"flat" | "unit-type">("flat");

  const [brandListSettingsMatrix, setBrandListSettingsMatrix] = useState<WireListSettingsMatrix>({});
  const [savingBrandListSettings, setSavingBrandListSettings] = useState(false);
  const [savingBrandListSettingsBySheet, setSavingBrandListSettingsBySheet] = useState<Record<string, boolean>>({});
  const [regeneratingBrandBySheet, setRegeneratingBrandBySheet] = useState<Record<string, boolean>>({});
  const [brandListSettingsMessage, setBrandListSettingsMessage] = useState<string | null>(null);

  const [crossWireSettingsMatrix, setCrossWireSettingsMatrix] = useState<WireListSettingsMatrix>({});
  const [crossWireSchema, setCrossWireSchema] = useState<CrossWireSchemaSummary | null>(null);
  const [hasLoadedCrossWireSchema, setHasLoadedCrossWireSchema] = useState(false);
  const [loadingCrossWireSchema, setLoadingCrossWireSchema] = useState(false);
  const [regeneratingCrossWireSchema, setRegeneratingCrossWireSchema] = useState(false);
  const [savingCrossWireSettingsBySheet, setSavingCrossWireSettingsBySheet] = useState<Record<string, boolean>>({});
  const [crossWireSettingsMessage, setCrossWireSettingsMessage] = useState<string | null>(null);
  const [crossWireSwapLocationsAll, setCrossWireSwapLocationsAll] = useState(false);
  const [crossWireSwapLocationsBySheet, setCrossWireSwapLocationsBySheet] = useState<Record<string, boolean>>({});

  const [layoutWorkspaceOpen, setLayoutWorkspaceOpen] = useState(false);
  const [wireReviewOpen, setWireReviewOpen] = useState(false);

  // ─── Fetch Project Data ─────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
        if (!res.ok) {
          throw new Error("Failed to fetch project");
        }
        const data = await res.json();
        setProject(data.project ?? data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [projectId]);

  // ─── Scrollspy IntersectionObserver Setup ───────────────────────────────────

  useEffect(() => {
    if (!contentRef.current || loading) return;

    const sectionEls = PROJECT_SECTIONS
      .map((s) => contentRef.current?.querySelector(`[data-section="${s.id}"]`))
      .filter((el): el is Element => el instanceof Element);

    if (sectionEls.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.section;
          if (id) setActiveSection(id);
        }
      },
      {
        root: contentRef.current,
        threshold: 0.1,
        rootMargin: "-10% 0px -70% 0px",
      },
    );

    for (const el of sectionEls) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading]);

  // ─── Initial Section Scroll ─────────────────────────────────────────────────

  useEffect(() => {
    if (loading || !contentRef.current) return;
    
    const sectionParam = searchParams.get("section");
    const targetSection = sectionParam || initialSection;
    
    if (targetSection && targetSection !== "details") {
      const el = contentRef.current.querySelector(`[data-section="${targetSection}"]`);
      if (el) {
        setTimeout(() => {
          isScrollingRef.current = true;
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveSection(targetSection);
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 800);
        }, 100);
      }
    }
  }, [loading, initialSection, searchParams]);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    isScrollingRef.current = true;
    const el = contentRef.current?.querySelector(`[data-section="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  }, []);

  // ─── Activity Logging Helper ────────────────────────────────────────────────

  const logActivityWithFlash = useCallback(
    async (
      action: ActivityAction,
      metadata: Record<string, unknown>,
    ) => {
      try {
        await activityService.logAction(badgeNumber, "1st", {
          action,
          metadata: {
            ...metadata,
            projectName: project?.name,
            pdNumber: project?.pdNumber,
          },
          projectId: project?.id,
          result: "success",
        });
        flashAside();
      } catch (err) {
        console.error("[v0] Failed to log activity:", err);
      }
    },
    [badgeNumber, project?.id, project?.name, project?.pdNumber, flashAside],
  );

  // ─── Derived State ──────────────────────────────────────────────────────────

  const currentProject = isEditing && editDraft ? editDraft : project;

  const assignmentEntries = useMemo(() => {
    if (!currentProject?.assignments) return [];
    return Object.entries(currentProject.assignments)
      .map(([slug, data]) => ({
        sheetSlug: slug,
        sheetName: (data as { sheetName?: string }).sheetName ?? slug,
        status: (data as { status?: string }).status ?? "pending",
        stage: (data as { stage?: string }).stage,
        unitType: (data as { unitType?: string }).unitType,
        ...(data as Record<string, unknown>),
      }))
      .sort((a, b) => a.sheetName.localeCompare(b.sheetName));
  }, [currentProject?.assignments]);

  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentSlug) return undefined;
    return assignmentEntries.find((a) => a.sheetSlug === selectedAssignmentSlug);
  }, [assignmentEntries, selectedAssignmentSlug]);

  const anyAssignmentHasLocations = useMemo(() => {
    return Object.values(schemaExternalLocations).some((locs) => locs.length > 0);
  }, [schemaExternalLocations]);

  // ─── Edit Mode Handlers ─────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    if (project) {
      setEditDraft({ ...project });
      setIsEditing(true);
    }
  }, [project]);

  const cancelEditMode = useCallback(() => {
    setEditDraft(null);
    setIsEditing(false);
    setSaveError(null);
  }, []);

  const setProjectField = useCallback(
    <K extends keyof ProjectManifest>(key: K, value: ProjectManifest[K]) => {
      setEditDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!editDraft || !project) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Save failed");
      }
      const updated = await res.json();
      setProject(updated.project ?? updated);
      setEditDraft(null);
      setIsEditing(false);
      toast({ title: "Project saved" });
      void logActivityWithFlash("project_updated", { fields: Object.keys(editDraft) });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [editDraft, project, toast, logActivityWithFlash]);

  // ─── Navigation Handlers ────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    router.push(`/${badgeNumber}/projects`);
  }, [router, badgeNumber]);

  const openWireReview = useCallback(() => {
    setWireReviewOpen(true);
  }, []);

  const openBrandListApprovalEditor = useCallback(() => {
    router.push(`/${badgeNumber}/projects/${encodeURIComponent(projectId)}/brand-list-review`);
  }, [router, badgeNumber, projectId]);

  const openBrandImportReview = useCallback(() => {
    router.push(`/${badgeNumber}/projects/${encodeURIComponent(projectId)}/brand-list-review?promptImport=1`);
  }, [router, badgeNumber, projectId]);

  const openLayoutWorkspace = useCallback(() => {
    setLayoutWorkspaceOpen(true);
  }, []);

  // ─── Cross Wire Handlers ────────────────────────────────────────────────────

  const handleCrossWireSwapBySheet = useCallback((sheetSlug: string, checked: boolean) => {
    setCrossWireSwapLocationsBySheet((prev) => ({ ...prev, [sheetSlug]: checked }));
  }, []);

  const setAllCrossWireSwapBySheet = useCallback((checked: boolean) => {
    setCrossWireSwapLocationsBySheet(
      assignmentEntries.reduce((acc, a) => ({ ...acc, [a.sheetSlug]: checked }), {}),
    );
  }, [assignmentEntries]);

  const setCrossWireLocationVisibility = useCallback(
    (sheetSlug: string, locationKey: string, visible: boolean) => {
      setCrossWireSettingsMatrix((prev) => ({
        ...prev,
        [sheetSlug]: {
          ...(prev[sheetSlug] ?? {}),
          [locationKey]: visible,
        },
      }));
    },
    [],
  );

  const handleSaveCrossWireSettings = useCallback(async (sheetSlug: string) => {
    if (!project?.id) return;
    setSavingCrossWireSettingsBySheet((prev) => ({ ...prev, [sheetSlug]: true }));
    try {
      const settings = crossWireSettingsMatrix[sheetSlug] ?? {};
      const swapLocations = crossWireSwapLocationsAll || (crossWireSwapLocationsBySheet[sheetSlug] ?? false);
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/cross-wire/visibility`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetSlug,
            visibilitySettings: settings,
            swapLocations,
            regenerate: true,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      setCrossWireSettingsMessage("Settings saved and cross-wire regenerated.");
      setTimeout(() => setCrossWireSettingsMessage(null), 3000);
    } catch {
      setCrossWireSettingsMessage("Failed to save settings.");
    } finally {
      setSavingCrossWireSettingsBySheet((prev) => ({ ...prev, [sheetSlug]: false }));
    }
  }, [project?.id, crossWireSettingsMatrix, crossWireSwapLocationsAll, crossWireSwapLocationsBySheet]);

  // ─── Download Handlers ──────────────────────────────────────────────────────

  const handleDownloadAllWireLists = useCallback(async () => {
    if (!wireExports?.sheetExports?.length || !project?.id) return;
    for (const exp of wireExports.sheetExports) {
      const url = `/api/projects/${encodeURIComponent(project.id)}/wire-list/download?path=${encodeURIComponent(exp.relativePath)}`;
      window.open(url, "_blank");
    }
  }, [wireExports, project?.id]);

  const handleDownloadAllBrandLists = useCallback(async () => {
    if (!brandingExports?.sheetExports?.length || !project?.id) return;
    for (const exp of brandingExports.sheetExports) {
      const url = `/api/projects/${encodeURIComponent(project.id)}/brand-list/download?path=${encodeURIComponent(exp.relativePath)}`;
      window.open(url, "_blank");
    }
  }, [brandingExports, project?.id]);

  // ─── Render Loading/Error States ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error || "Project not found"}</p>
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: currentProject?.color || "#6b7280" }}
            >
              {currentProject?.name?.slice(0, 2).toUpperCase() || "PR"}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">{currentProject?.name || "Project"}</h1>
              <p className="text-xs text-muted-foreground">
                {currentProject?.pdNumber || "No PD"} · Rev {currentProject?.revision || "-"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEditMode} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={enterEditMode}>
              <Pencil className="mr-2 h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </header>

      {/* Mobile nav */}
      <MobileNavDrawer
        sections={PROJECT_SECTIONS}
        activeId={activeSection}
        onSelect={scrollToSection}
      />

      {/* Desktop layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar nav */}
        <aside className="hidden w-48 shrink-0 border-r border-border lg:block">
          <ScrollArea className="h-full">
            <nav className="space-y-1 p-3">
              {PROJECT_SECTIONS.map((section) => (
                <NavItem
                  key={section.id}
                  section={section}
                  active={activeSection === section.id}
                  onClick={() => scrollToSection(section.id)}
                />
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Scrollable content */}
        <div className="flex-1 min-w-0 overflow-y-auto" ref={contentRef}>
          <div className="mx-auto max-w-4xl px-4 py-6 space-y-12">
            
            {/* ─── Details Section ─────────────────────────────────────────── */}
            <section data-section="details" className="scroll-mt-6">
              <SectionHeader
                icon={FileText}
                title="Project Details"
                description="View and edit project information and metadata."
              />
              <div className="mt-4 space-y-3">
                {isEditing ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      value={editDraft?.name || ""}
                      onChange={(e) => setProjectField("name", e.target.value)}
                      placeholder="Project Name"
                    />
                    <PdNumberField
                      mode="create"
                      label="PD Number"
                      value={editDraft?.pdNumber || ""}
                      onChange={(value) => setProjectField("pdNumber", value)}
                    />
                    <UnitNumberField
                      mode="create"
                      label="Unit Number"
                      value={editDraft?.unitNumber ?? undefined}
                      onChange={(value) => setProjectField("unitNumber", value ?? null)}
                    />
                    <RevisionField
                      mode="create"
                      label="Revision"
                      value={editDraft?.revision || ""}
                      onChange={(value) => setProjectField("revision", value)}
                    />
                    <LwcTypeField
                      mode="create"
                      label="LWC Type"
                      value={editDraft?.lwcType ?? undefined}
                      onChange={(value) => setProjectField("lwcType", value)}
                      showRegistryDescription={false}
                    />
                    <DateField
                      mode="create"
                      label="Due Date"
                      value={parseDateInputValue(editDraft?.dueDate)}
                      onChange={(date) => setProjectField("dueDate", date ? date.toISOString().slice(0, 10) : null)}
                    />
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                      <Select
                        value={editDraft?.status || ""}
                        onValueChange={(value) => setProjectField("status", value as typeof PROJECT_STATUS_OPTIONS[number]["value"])}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dot)} />
                                {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium text-muted-foreground">Color</Label>
                      <ColorPicker
                        value={editDraft?.color || "#ffcc61"}
                        onValueChange={(value) => setProjectField("color", value)}
                      >
                        <ColorPickerTrigger asChild>
                          <button className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent">
                            <ColorPickerSwatch className="h-5 w-5 rounded-sm border border-border shrink-0" />
                            <span className="font-mono text-xs">{editDraft?.color || "#ffcc61"}</span>
                          </button>
                        </ColorPickerTrigger>
                        <ColorPickerContent>
                          <ColorPickerArea />
                          <ColorPickerHueSlider />
                          <ColorPickerInput />
                        </ColorPickerContent>
                      </ColorPicker>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <DetailRow icon={FileText} label="Project Name">{currentProject?.name}</DetailRow>
                    <DetailRow icon={FileText} label="PD Number">{currentProject?.pdNumber || "Not set"}</DetailRow>
                    <DetailRow icon={Package} label="Unit">{currentProject?.unitNumber ? `Unit ${currentProject.unitNumber}` : "Not set"}</DetailRow>
                    <DetailRow icon={GitBranch} label="Revision">{currentProject?.revision || "Not set"}</DetailRow>
                    <DetailRow icon={Layers} label="LWC Type">{String(currentProject?.lwcType || "Not set")}</DetailRow>
                    <DetailRow icon={Calendar} label="Due Date">{formatDateValue(currentProject?.dueDate)}</DetailRow>
                    <DetailRow icon={Calendar} label="Ship Date">{formatDateValue(currentProject?.shipDate)}</DetailRow>
                    <DetailRow icon={FileText} label="Status">
                      {(() => {
                        const opt = PROJECT_STATUS_OPTIONS.find((o) => o.value === currentProject?.status);
                        return (
                          <span className="flex items-center gap-2">
                            {opt && <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dot)} />}
                            {opt ? opt.label : formatTokenLabel(currentProject?.status || "unknown")}
                          </span>
                        );
                      })()}
                    </DetailRow>
                    <DetailRow icon={Palette} label="Color">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-sm border border-border shrink-0"
                          style={{ backgroundColor: currentProject?.color || "#ffcc61" }}
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {currentProject?.color || "#ffcc61"}
                        </span>
                      </span>
                    </DetailRow>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Workspace Actions
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button size="sm" variant="outline" className="justify-start gap-2" onClick={openWireReview}>
                          <Layers className="h-3.5 w-3.5" />
                          Open Multi-Sheet Workspace
                        </Button>
                        <Button size="sm" variant="outline" className="justify-start gap-2" onClick={openBrandListApprovalEditor}>
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          Open Brand List Approval Editor
                        </Button>
                        <Button size="sm" variant="outline" className="justify-start gap-2" onClick={openLayoutWorkspace}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open PDF Layout Workspace
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={handleDownloadAllWireLists}
                          disabled={!wireExports?.sheetExports?.length}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download All Wire List PDFs
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ─── Assignments Section ─────────────────────────────────────── */}
            <section data-section="assignments" className="scroll-mt-6">
              <SectionHeader
                icon={GitBranch}
                title="Assignments"
                description="View and manage project sheet assignments."
              />
              <div className="mt-4">
                {assignmentEntries.length === 0 ? (
                  <EmptyStateCard
                    title="No assignments found"
                    description="Upload project content or regenerate the manifest to populate assignments."
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="font-semibold">{assignmentEntries.length}</span>
                          <span className="ml-1 text-muted-foreground">Total</span>
                        </div>
                        <div>
                          <span className="font-semibold">
                            {assignmentEntries.filter((a) => a.status === "completed").length}
                          </span>
                          <span className="ml-1 text-muted-foreground">Completed</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs">
                        <button
                          onClick={() => setAssignmentGroupMode("flat")}
                          className={cn(
                            "rounded-md px-2.5 py-1 font-medium transition-colors",
                            assignmentGroupMode === "flat"
                              ? "bg-accent text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Assignments
                        </button>
                        <button
                          onClick={() => setAssignmentGroupMode("unit-type")}
                          className={cn(
                            "rounded-md px-2.5 py-1 font-medium transition-colors",
                            assignmentGroupMode === "unit-type"
                              ? "bg-accent text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Unit Type
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {assignmentEntries.map((assignment) => (
                        <div
                          key={assignment.sheetSlug}
                          className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">
                              {assignment.sheetName}
                            </div>
                            {assignment.unitType && (
                              <div className="text-xs text-muted-foreground">
                                {assignment.unitType}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={assignment.status === "completed" ? "default" : "outline"}
                              className="text-[10px]"
                            >
                              {formatTokenLabel(assignment.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ─── Legals Section ──────────────────────────────────────────── */}
            <section data-section="legals" className="scroll-mt-6">
              <SectionHeader
                icon={Upload}
                title="Legals"
                description="Manage legal document uploads and revisions."
              />
              <div className="mt-4">
                <EmptyStateCard
                  title="Legal document management"
                  description="Upload workbook, green changes, and layout files to manage project revisions."
                />
              </div>
            </section>

            {/* ─── Brand Lists Section ─────────────────────────────────────── */}
            <section data-section="brand-lists" className="scroll-mt-6">
              <SectionHeader
                icon={FileSpreadsheet}
                title="Brand Lists"
                description="Generate, combine, review, and control brand list outputs."
              />
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={openBrandImportReview}>
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    Import & Merge Brand List
                  </Button>
                  <Button size="sm" variant="outline" disabled={regeneratingBranding}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Generate
                  </Button>
                  <Button size="sm" variant="default">
                    <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                    Generate & Combine
                  </Button>
                </div>
                
                {assignmentEntries.length === 0 ? (
                  <EmptyStateCard
                    title="No brand list sheets"
                    description="Generate brand list schemas to populate visibility settings."
                  />
                ) : (
                  <div className="space-y-2">
                    {assignmentEntries.map((assignment) => (
                      <div
                        key={assignment.sheetSlug}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                      >
                        <span className="text-sm font-medium">{assignment.sheetName}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                            <Download className="h-3 w-3" />
                            PDF
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                            <Check className="h-3 w-3" />
                            Save + Generate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ─── Wire Lists Section ──────────────────────────────────────── */}
            <section data-section="wire-lists" className="scroll-mt-6">
              <SectionHeader
                icon={Layers}
                title="Wire Lists"
                description="Manage wire list exports and visibility settings per sheet."
              />
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={regeneratingWire}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Generate All
                  </Button>
                  <Button size="sm" variant="outline" onClick={openWireReview}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Open Wire Review
                  </Button>
                </div>
                
                {assignmentEntries.length === 0 ? (
                  <EmptyStateCard
                    title="No wire list sheets"
                    description="Generate wire list schemas to populate visibility settings."
                  />
                ) : (
                  <div className="space-y-2">
                    {assignmentEntries.map((assignment) => (
                      <div
                        key={assignment.sheetSlug}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                      >
                        <span className="text-sm font-medium">{assignment.sheetName}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                            <Download className="h-3 w-3" />
                            PDF
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                            <Check className="h-3 w-3" />
                            Save + Generate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ─── Cross Wire Section ──────────────────────────────────────── */}
            <section data-section="cross-wire" className="scroll-mt-6">
              <SectionHeader
                icon={ExternalLink}
                title="Cross Wire"
                description="Manage cross-wire schema generation and location visibility."
              />
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={regeneratingCrossWireSchema}>
                    <GitBranch className="mr-2 h-3.5 w-3.5" />
                    Generate
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Open External URL
                  </Button>
                </div>

                {crossWireSettingsMessage ? (
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs",
                      crossWireSettingsMessage.toLowerCase().includes("failed") ||
                        crossWireSettingsMessage.toLowerCase().includes("error")
                        ? "bg-destructive/10 text-destructive"
                        : "bg-green-500/10 text-green-700",
                    )}
                  >
                    {crossWireSettingsMessage}
                  </div>
                ) : null}

                {loadingSchemaLocations || loadingCrossWireSchema ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading cross wire settings...
                  </div>
                ) : assignmentEntries.length === 0 || !anyAssignmentHasLocations ? (
                  <EmptyStateCard
                    title="No external locations found"
                    description="Generate wire list schemas to populate cross wire visibility settings."
                  />
                ) : (
                  <div className="space-y-3">
                    {/* Global controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">Quick Actions:</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:text-xs"
                          onClick={() => {
                            setCrossWireSwapLocationsAll(true);
                            setAllCrossWireSwapBySheet(true);
                          }}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                          Swap All
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:text-xs"
                          onClick={() => {
                            setCrossWireSwapLocationsAll(false);
                            setAllCrossWireSwapBySheet(false);
                          }}
                        >
                          Clear Swaps
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground sm:text-xs">Swap all locations:</span>
                        <Switch
                          checked={crossWireSwapLocationsAll}
                          onCheckedChange={setCrossWireSwapLocationsAll}
                          aria-label="Toggle swapped cross wire locations for all assignments"
                        />
                      </div>
                    </div>

                    {/* Unified cross-wire locations table */}
                    <div className="overflow-hidden rounded-lg border border-border">
                      {/* Desktop table header */}
                      <div className="hidden border-b border-border bg-muted/50 sm:grid sm:grid-cols-[1fr_1fr_80px_100px_120px] sm:gap-2 sm:px-3 sm:py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          From Location
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          To Location
                        </div>
                        <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Visible
                        </div>
                        <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Swap Loc
                        </div>
                        <div className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Action
                        </div>
                      </div>

                      {/* Table rows */}
                      <div className="divide-y divide-border/60">
                        {assignmentEntries.map((assignment) => {
                          const locations = (schemaExternalLocations[assignment.sheetSlug] ?? [])
                            .map((loc) => ({
                              label: loc,
                              key: loc.trim().toUpperCase(),
                            }))
                            .filter((loc) => loc.key);
                          
                          if (locations.length === 0) {
                            return null;
                          }

                          const visibleCount = locations.filter(
                            (loc) => crossWireSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true,
                          ).length;
                          const isSavingSheet = savingCrossWireSettingsBySheet[assignment.sheetSlug] ?? false;
                          const isSwapped = crossWireSwapLocationsAll || (crossWireSwapLocationsBySheet[assignment.sheetSlug] ?? false);

                          return (
                            <div key={assignment.sheetSlug} className="bg-background/40">
                              {locations.map((loc, locIdx) => {
                                const isFirstInGroup = locIdx === 0;
                                const isLastInGroup = locIdx === locations.length - 1;
                                const isVisible = crossWireSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true;

                                return (
                                  <div
                                    key={`${assignment.sheetSlug}-${loc.key}`}
                                    className={cn(
                                      "grid grid-cols-[1fr_auto] items-center gap-2 px-2.5 py-2 transition-colors hover:bg-muted/30 sm:grid-cols-[1fr_1fr_80px_100px_120px] sm:gap-2 sm:px-3",
                                      !isLastInGroup && "border-b border-border/30"
                                    )}
                                  >
                                    {/* From Location (Assignment) */}
                                    <div className="min-w-0">
                                      {isFirstInGroup ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="truncate text-xs font-medium text-foreground sm:text-sm">
                                            {assignment.sheetName}
                                          </span>
                                          <Badge variant="outline" className="hidden h-4 shrink-0 px-1.5 text-[9px] sm:inline-flex">
                                            {visibleCount}/{locations.length}
                                          </Badge>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground/50 sm:text-xs">—</span>
                                      )}
                                    </div>

                                    {/* To Location (External) */}
                                    <div className="hidden min-w-0 sm:block">
                                      <span className="truncate font-mono text-xs text-foreground">
                                        {loc.label}
                                      </span>
                                    </div>

                                    {/* Mobile: To Location + Controls */}
                                    <div className="flex items-center gap-2 sm:hidden">
                                      <span className="truncate font-mono text-[10px] text-foreground">
                                        {loc.label}
                                      </span>
                                      <div className="flex shrink-0 items-center gap-3">
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span className="text-[8px] text-muted-foreground">Vis</span>
                                          <Switch
                                            checked={isVisible}
                                            onCheckedChange={(checked) =>
                                              setCrossWireLocationVisibility(
                                                assignment.sheetSlug,
                                                loc.key,
                                                checked,
                                              )
                                            }
                                            aria-label={`Toggle visibility of ${loc.label}`}
                                            className="scale-75"
                                          />
                                        </div>
                                        {isFirstInGroup && (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-[8px] text-muted-foreground">Swap</span>
                                            <Switch
                                              checked={isSwapped}
                                              disabled={crossWireSwapLocationsAll}
                                              onCheckedChange={(checked) =>
                                                handleCrossWireSwapBySheet(assignment.sheetSlug, checked)
                                              }
                                              aria-label={`Toggle swap for ${assignment.sheetName}`}
                                              className="scale-75"
                                            />
                                          </div>
                                        )}
                                        {isFirstInGroup && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => void handleSaveCrossWireSettings(assignment.sheetSlug)}
                                            disabled={isSavingSheet}
                                          >
                                            {isSavingSheet ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Check className="h-3 w-3" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Desktop: Visible toggle */}
                                    <div className="hidden justify-center sm:flex">
                                      <Switch
                                        checked={isVisible}
                                        onCheckedChange={(checked) =>
                                          setCrossWireLocationVisibility(
                                            assignment.sheetSlug,
                                            loc.key,
                                            checked,
                                          )
                                        }
                                        aria-label={`Toggle visibility of ${loc.label}`}
                                      />
                                    </div>

                                    {/* Desktop: Swap Location toggle */}
                                    <div className="hidden justify-center sm:flex">
                                      {isFirstInGroup ? (
                                        <Switch
                                          checked={isSwapped}
                                          disabled={crossWireSwapLocationsAll}
                                          onCheckedChange={(checked) =>
                                            handleCrossWireSwapBySheet(assignment.sheetSlug, checked)
                                          }
                                          aria-label={`Toggle swap locations for ${assignment.sheetName}`}
                                        />
                                      ) : (
                                        <span className="text-xs text-muted-foreground/40">—</span>
                                      )}
                                    </div>

                                    {/* Desktop: Action button */}
                                    <div className="hidden justify-end sm:flex">
                                      {isFirstInGroup ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 gap-1 px-2 text-[10px]"
                                          onClick={() => void handleSaveCrossWireSettings(assignment.sheetSlug)}
                                          disabled={isSavingSheet}
                                        >
                                          {isSavingSheet ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <Check className="h-2.5 w-2.5" />
                                          )}
                                          Save
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* Child Workflows */}
      <LayoutPdfWorkspaceDialog
        open={layoutWorkspaceOpen}
        onOpenChange={setLayoutWorkspaceOpen}
        projectId={project.id}
        badgeNumber={badgeNumber}
      />
<MultiWireListPrintWorkspaceDialog
  open={wireReviewOpen}
  onOpenChange={setWireReviewOpen}
  projectId={project.id}
  projectName={project.name}
  projectColor={project.color ?? undefined}
  sheets={assignmentEntries.map((a) => ({ slug: a.sheetSlug, name: a.sheetName, rowCount: 0 }))}
  />
    </div>
  );
}
