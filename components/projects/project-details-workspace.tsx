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
  Grid3X3,
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
import { MultiSheetReviewModal } from "@/components/wire-list/multi-sheet-review-modal";
import { AssignmentLabelDownloadButton } from "@/components/projects/assignment-label-download-button";
import { StageSelectorCell } from "@/components/projects/assignment-stage-selector-cell";
import { StatusButtonCell } from "@/components/projects/assignment-status-button-cell";
import { useLayoutUI } from "@/components/layout/layout-context";
import { activityService } from "@/lib/services/activity-service";
import type { ActivityAction } from "@/types/activity";
import { VisibilityMatrixConcept } from "@/components/projects/visibility-matrix-concept";
import { BoxSideTestTable } from "@/components/projects/box-side-test-table";

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

function buildExportFileHref(projectId: string, relativePath: string): string {
  const normalized = relativePath.replace(/^exports\//, "");
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${segments}?download=1`;
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
    { id: "visibility-matrix", label: "Vis Matrix", icon: <Grid3X3 className="h-4 w-4" /> },
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

// ──������� Scrollspy Navigation Components ──────────────────────────────────────────

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
  const [brandReviewOpen, setBrandReviewOpen] = useState(false);
  const [autoStartBrandImport, setAutoStartBrandImport] = useState(false);

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
  setProject(data.manifest ?? data.project ?? data);
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

  // Filter assignments for Brand List section - only include those with external locations
  const { brandListAssignments, brandListExcluded } = useMemo(() => {
    const included: typeof assignmentEntries = [];
    const excluded: Array<{ assignment: typeof assignmentEntries[0]; reason: string }> = [];
    for (const assignment of assignmentEntries) {
      const locations = schemaExternalLocations[assignment.sheetSlug] ?? [];
      if (locations.length > 0) {
        included.push(assignment);
      } else {
        excluded.push({ 
          assignment, 
          reason: "No external locations configured" 
        });
      }
    }
    return { brandListAssignments: included, brandListExcluded: excluded };
  }, [assignmentEntries, schemaExternalLocations]);

  // Filter assignments for Cross Wire section - only include those with external locations
  const { crossWireAssignments, crossWireExcluded } = useMemo(() => {
    const included: typeof assignmentEntries = [];
    const excluded: Array<{ assignment: typeof assignmentEntries[0]; reason: string }> = [];
    for (const assignment of assignmentEntries) {
      const locations = schemaExternalLocations[assignment.sheetSlug] ?? [];
      if (locations.length > 0) {
        included.push(assignment);
      } else {
        excluded.push({ 
          assignment, 
          reason: "No external locations" 
        });
      }
    }
    return { crossWireAssignments: included, crossWireExcluded: excluded };
  }, [assignmentEntries, schemaExternalLocations]);

  const assignmentGroups = useMemo(() => {
    if (assignmentGroupMode !== "unit-type") return null;
    const groups = new Map<string, typeof assignmentEntries>();
    for (const assignment of assignmentEntries) {
      const key = assignment.unitType || "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(assignment);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [assignmentEntries, assignmentGroupMode]);

  const latestLegalRevisionRecord = useMemo(() => {
    if (!legalDetail?.revisions?.length) return null;
    return (
      legalDetail.revisions.find(
        (revision) => revision.revision === legalDetail.latestRevision,
      ) ??
      [...legalDetail.revisions].sort((left, right) =>
        right.revision.localeCompare(left.revision),
      )[0]
    );
  }, [legalDetail]);

  // Collect unique unit types from assignment entries for the visibility matrix
  const availableUnitTypes = useMemo(() => {
    const unitTypes = new Set<string>();
    for (const assignment of assignmentEntries) {
      if (assignment.unitType) {
        unitTypes.add(assignment.unitType);
      }
    }
    return Array.from(unitTypes).sort();
  }, [assignmentEntries]);

  function deriveRevisionLabelFromFiles(files: (File | null | undefined)[]): string | null {
    for (const file of files) {
      if (!file) continue;
      const parsed = parseRevisionFromFilename(file.name);
      if (parsed) return parsed;
    }
    return null;
  }

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

  // Handler for updating assignment unitType via API
  const handleAssignmentUnitTypeChange = useCallback(async (sheetSlug: string, unitType: string) => {
    if (!project) return;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(sheetSlug)}`,
        {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            "x-badge-number": badgeNumber ?? "unknown",
          },
          body: JSON.stringify({ unitType }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to update unit type");
      }
      const updated = await res.json();
      // Update project state by merging the updated assignment into the existing project
      if (updated.assignment) {
        const updateFn = (prev: ProjectManifest | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            assignments: {
              ...prev.assignments,
              [sheetSlug]: updated.assignment,
            },
          };
        };
        setProject(updateFn);
        // Also update editDraft if in edit mode so UI reflects the change
        setEditDraft((prev) => prev ? updateFn(prev) : prev);
      }
      toast({ title: "Unit type updated" });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to update unit type",
        variant: "destructive" 
      });
    }
  }, [project, badgeNumber, toast]);

  // Handler for updating assignment boxSide via API
  const handleAssignmentBoxSideChange = useCallback(async (sheetSlug: string, boxSide: string) => {
    if (!project) return;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(sheetSlug)}`,
        {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            "x-badge-number": badgeNumber ?? "unknown",
          },
          body: JSON.stringify({ boxSide }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to update box side");
      }
      const updated = await res.json();
      // Update project state by merging the updated assignment into the existing project
      if (updated.assignment) {
        const updateFn = (prev: ProjectManifest | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            assignments: {
              ...prev.assignments,
              [sheetSlug]: updated.assignment,
            },
          };
        };
        setProject(updateFn);
        // Also update editDraft if in edit mode so UI reflects the change
        setEditDraft((prev) => prev ? updateFn(prev) : prev);
      }
      toast({ title: "Box side updated" });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to update box side",
        variant: "destructive" 
      });
    }
  }, [project, badgeNumber, toast]);

  // ─── Navigation Handlers ────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    router.push(`/${badgeNumber}/projects`);
  }, [router, badgeNumber]);

  const openWireReview = useCallback(() => {
    setWireReviewOpen(true);
  }, []);

  const openBrandListApprovalEditor = useCallback(() => {
    setAutoStartBrandImport(false);
    setBrandReviewOpen(true);
  }, []);

  const openBrandImportReview = useCallback(() => {
    setAutoStartBrandImport(true);
    setBrandReviewOpen(true);
  }, []);

  const openLayoutWorkspace = useCallback(() => {
    setLayoutWorkspaceOpen(true);
  }, []);

  // Stable project ID ref — avoids recreating updateAssignment on every state change.
  const projectIdRef = useRef<string | null>(null);
  if (project?.id) projectIdRef.current = project.id;

  const updateAssignment = useCallback(
    async (sheetSlug: string, patch: { stage?: string; status?: string }) => {
      const pId = projectIdRef.current;
      if (!pId) return;
      const res = await fetch(
        `/api/projects/${encodeURIComponent(pId)}/assignments/${encodeURIComponent(sheetSlug)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-badge-number": badgeNumber,
            "x-shift": "1st",
          },
          body: JSON.stringify(patch),
        },
      );
      if (res.ok) {
        const updated = await res.json();
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            assignments: {
              ...prev.assignments,
              [sheetSlug]: {
                ...(prev.assignments?.[sheetSlug] ?? {}),
                ...updated.assignment,
              },
            },
          };
        });
      }
    },
    [badgeNumber],
  );

  // ─── Legals Upload Handler ──────────────────────────────────────────────────

  const handleUploadLegals = useCallback(async () => {
    if (!project?.id) return;

    if (!workbookFile && !greenChangesFile && !layoutFile) {
      setLegalsMessage("Select a UCP wire list, green changes workbook, or layout PDF first.");
      return;
    }

    setUploadingLegals(true);
    setLegalsMessage(null);
    try {
      const formData = new FormData();
      formData.set("pdNumber", project.pdNumber);
      const computedRevision = deriveRevisionLabelFromFiles([
        workbookFile,
        greenChangesFile,
        layoutFile,
      ]);
      const effectiveRevisionName = revisionNameDraft.trim() || computedRevision || project.revision;
      if (effectiveRevisionName) {
        formData.set("revisionName", effectiveRevisionName);
      }
      if (workbookFile) formData.set("workbook", workbookFile);
      if (greenChangesFile) formData.set("greenChanges", greenChangesFile);
      if (layoutFile) formData.set("layout", layoutFile);

      const response = await fetch(
        `/api/projects/revisions/${encodeURIComponent(project.id)}/files?async=1`,
        {
          method: "POST",
          headers: {
            "x-badge-number": badgeNumber,
            "x-shift": "1st",
          },
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        refreshJob?: RevisionRefreshJob;
      };

      if (!response.ok) {
        setLegalsMessage(payload.error || "Failed to upload legal files.");
        return;
      }

      setWorkbookFile(null);
      setGreenChangesFile(null);
      setLayoutFile(null);
      setRevisionNameDraft("");
      setRevisionNameTouched(false);
      if (workbookInputRef.current) workbookInputRef.current.value = "";
      if (greenChangesInputRef.current) greenChangesInputRef.current.value = "";
      if (layoutInputRef.current) layoutInputRef.current.value = "";

      if (payload.refreshJob) {
        setRefreshJob(payload.refreshJob);
        setLegalsMessage("Revision files uploaded. Refreshing project...");
      } else {
        setLegalsMessage("Revision files uploaded successfully.");
        // Refetch legal details
        setHasLoadedLegals(false);
      }

      const uploadedFiles: string[] = [];
      if (workbookFile) uploadedFiles.push("workbook");
      if (greenChangesFile) uploadedFiles.push("green-changes");
      if (layoutFile) uploadedFiles.push("layout");
      void logActivityWithFlash("LEGAL_FILES_UPLOADED", {
        files: uploadedFiles,
        details: {
          workbook: workbookFile?.name,
          greenChanges: greenChangesFile?.name,
          layout: layoutFile?.name,
          revision: effectiveRevisionName,
        },
      });
    } catch (err) {
      setLegalsMessage(
        err instanceof Error ? err.message : "Failed to upload legal files.",
      );
    } finally {
      setUploadingLegals(false);
    }
  }, [
    badgeNumber,
    greenChangesFile,
    layoutFile,
    logActivityWithFlash,
    project,
    revisionNameDraft,
    workbookFile,
  ]);

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

  // ─── Bulk Save & Generate Handlers for Visibility Matrix ──────────────────

  const handleBulkSaveAndGenerateWireLists = useCallback(async (): Promise<string | null> => {
    if (!project?.id || assignmentEntries.length === 0) return null;

    // Save all wire list settings
    await Promise.all(
      assignmentEntries.map(async (assignment) => {
        const settings = wireListSettingsMatrix[assignment.sheetSlug] ?? {};
        await fetch(
          `/api/projects/${encodeURIComponent(project.id)}/assignment-visibility`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sheetSlug: assignment.sheetSlug,
              kind: "wire",
              visibilitySettings: settings,
            }),
          }
        );
      })
    );

    // Generate all wire lists and return download URL directly
    // The download-all endpoint generates and returns ZIP in one request
    return `/api/projects/${encodeURIComponent(project.id)}/wire-list-pdf/download-all`;
  }, [project?.id, assignmentEntries, wireListSettingsMatrix]);

  const handleBulkSaveAndGenerateBrandLists = useCallback(async (): Promise<string | null> => {
    if (!project?.id || assignmentEntries.length === 0) return null;

    // Save all brand list settings
    await Promise.all(
      assignmentEntries.map(async (assignment) => {
        const settings = brandListSettingsMatrix[assignment.sheetSlug] ?? {};
        await fetch(
          `/api/projects/${encodeURIComponent(project.id)}/assignment-visibility`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sheetSlug: assignment.sheetSlug,
              kind: "branding",
              visibilitySettings: settings,
            }),
          }
        );
      })
    );

    // Generate all brand lists and return download URL directly
    // The download-all endpoint generates and returns ZIP in one request
    return `/api/projects/${encodeURIComponent(project.id)}/brand-list-pdf/download-all`;
  }, [project?.id, assignmentEntries, brandListSettingsMatrix]);

  const handleBulkSaveAndGenerateCrossWire = useCallback(async (): Promise<string | null> => {
    if (!project?.id || assignmentEntries.length === 0) return null;

    // Save all cross wire settings
    await Promise.all(
      assignmentEntries.map(async (assignment) => {
        const settings = crossWireSettingsMatrix[assignment.sheetSlug] ?? {};
        const isSwapped = crossWireSwapLocationsAll || (crossWireSwapLocationsBySheet[assignment.sheetSlug] ?? false);
        await fetch(
          `/api/projects/${encodeURIComponent(project.id)}/cross-wire-visibility`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sheetSlug: assignment.sheetSlug,
              visibilitySettings: settings,
              swapLocations: isSwapped,
            }),
          }
        );
      })
    );

    // Return the cross-wire PDF download URL
    return `/api/projects/${encodeURIComponent(project.id)}/cross-wire-pdf`;
  }, [project?.id, assignmentEntries, crossWireSettingsMatrix, crossWireSwapLocationsAll, crossWireSwapLocationsBySheet]);

  const refreshBrandingExports = useCallback(async () => {
    if (!project?.id) {
      setBrandingExports(null);
      setHasLoadedBrandingExports(false);
      return;
    }

    setLoadingBrandingExports(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/exports?kind=branding`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setBrandingExports(null);
        return;
      }
      setBrandingExports((await response.json()) as BrandingExportResult);
    } finally {
      setLoadingBrandingExports(false);
      setHasLoadedBrandingExports(true);
    }
  }, [project?.id]);

  const refreshWireExports = useCallback(async () => {
    if (!project?.id) {
      setWireExports(null);
      setHasLoadedWireExports(false);
      return;
    }

    setLoadingWireExports(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/exports?kind=wire`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setWireExports(null);
        return;
      }
      setWireExports((await response.json()) as WireListExportResult);
    } finally {
      setLoadingWireExports(false);
      setHasLoadedWireExports(true);
    }
  }, [project?.id]);

  const refreshSchemaLocations = useCallback(async () => {
    if (!project?.id || assignmentEntries.length === 0) {
      setSchemaExternalLocations({});
      return;
    }

    setLoadingSchemaLocations(true);
    try {
      const results = await Promise.allSettled(
        assignmentEntries.map(async (assignment) => {
          const response = await fetch(
            `/api/projects/${encodeURIComponent(project.id)}/wire-list-print-schemas?sheet=${encodeURIComponent(assignment.sheetSlug)}`,
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

      const newMap: Record<string, string[]> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          const [slug, locs] = r.value;
          newMap[slug] = locs;
        }
      }
      setSchemaExternalLocations(newMap);
    } finally {
      setLoadingSchemaLocations(false);
    }
  }, [project?.id, assignmentEntries]);

  const hasSchemaExternalLocations = useMemo(
    () => Object.keys(schemaExternalLocations).length > 0,
    [schemaExternalLocations],
  );

  // ─── Fetch Schema External Locations on Load ──────────────────────────────

  useEffect(() => {
    if (
      !loading &&
      project?.id &&
      assignmentEntries.length > 0 &&
      !loadingSchemaLocations &&
      !hasSchemaExternalLocations
    ) {
      void refreshSchemaLocations();
    }
  }, [
    loading,
    project?.id,
    assignmentEntries.length,
    loadingSchemaLocations,
    hasSchemaExternalLocations,
    refreshSchemaLocations,
  ]);

  // ─── Brand List Settings Handlers ───────────────────────────────────────────

  const setBrandListVisibility = useCallback((sheetSlug: string, key: string, visible: boolean) => {
    setBrandListSettingsMatrix((prev) => ({
      ...prev,
      [sheetSlug]: {
        ...(prev[sheetSlug] ?? {}),
        [key]: visible,
      },
    }));
    // Mark as dirty
    setBrandGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "idle" }));
  }, []);

  const handleSaveAndGenerateBrandList = useCallback(async (sheetSlug: string) => {
    if (!project?.id) return;

    // Set to generating state
    setBrandGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "generating" }));
    setSavingBrandListSettingsBySheet((prev) => ({ ...prev, [sheetSlug]: true }));

    try {
      // Save visibility settings
      await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/assignment-visibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetSlug,
            visibilitySettings: brandListSettingsMatrix[sheetSlug] ?? {},
          }),
        },
      );

      // Regenerate brand list
      setRegeneratingBrandBySheet((prev) => ({ ...prev, [sheetSlug]: true }));
      await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/brand-list/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetSlugs: [sheetSlug] }),
        },
      );

      setBrandGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "done" }));
      await refreshBrandingExports();

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setBrandGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "idle" }));
      }, 3000);
    } catch {
      setBrandGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "error" }));
    } finally {
      setSavingBrandListSettingsBySheet((prev) => ({ ...prev, [sheetSlug]: false }));
      setRegeneratingBrandBySheet((prev) => ({ ...prev, [sheetSlug]: false }));
    }
  }, [project?.id, brandListSettingsMatrix, refreshBrandingExports]);

  // ─── Wire List Settings Handlers ────────────────────────────────────────────

  const setWireListVisibility = useCallback((sheetSlug: string, key: string, visible: boolean) => {
    setWireListSettingsMatrix((prev) => ({
      ...prev,
      [sheetSlug]: {
        ...(prev[sheetSlug] ?? {}),
        [key]: visible,
      },
    }));
    // Mark as dirty
    setWireGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "idle" }));
  }, []);

  const handleSaveAndGenerateWireList = useCallback(async (sheetSlug: string) => {
    if (!project?.id) return;

    // Set to generating state
    setWireGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "generating" }));
    setSavingWireListSettingsBySheet((prev) => ({ ...prev, [sheetSlug]: true }));

    try {
      // Save visibility settings
      await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/assignment-visibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetSlug,
            visibilitySettings: wireListSettingsMatrix[sheetSlug] ?? {},
          }),
        },
      );

      // Regenerate wire list
      setRegeneratingWireBySheet((prev) => ({ ...prev, [sheetSlug]: true }));
      await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/wire-list/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetSlugs: [sheetSlug] }),
        },
      );

      setWireGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "done" }));
      await refreshWireExports();

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setWireGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "idle" }));
      }, 3000);
    } catch {
      setWireGeneratingSheets((prev) => ({ ...prev, [sheetSlug]: "error" }));
    } finally {
      setSavingWireListSettingsBySheet((prev) => ({ ...prev, [sheetSlug]: false }));
      setRegeneratingWireBySheet((prev) => ({ ...prev, [sheetSlug]: false }));
    }
  }, [project?.id, wireListSettingsMatrix, refreshWireExports]);

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
              <div className="mt-4 space-y-3">
                {assignmentEntries.length > 0 ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex flex-1 items-center divide-x divide-border">
                      <div className="flex flex-col items-center gap-0.5 py-1 pr-4">
                        <span className="text-lg font-semibold text-foreground">{assignmentEntries.length}</span>
                        <span className="text-[11px] text-muted-foreground">Total</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 py-1 px-4">
                        <span className="text-lg font-semibold text-foreground">
                          {assignmentEntries.filter((a) => a.status === "completed").length}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Completed</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs shrink-0">
                      <button
                        onClick={() => setAssignmentGroupMode("flat")}
                        className={cn(
                          "rounded-md px-2.5 py-1 font-medium transition-colors",
                          assignmentGroupMode === "flat"
                            ? "bg-background text-foreground shadow-sm"
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
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Unit Type
                      </button>
                    </div>
                  </div>
                ) : null}

                {assignmentEntries.length === 0 ? (
                  <EmptyStateCard
                    title="No assignments found in this manifest."
                    description="Upload project content or regenerate the manifest to populate assignment rows."
                  />
                ) : (
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 px-3 py-2" />
                          <TableHead className="py-2 min-w-[160px]">Project</TableHead>
                          <TableHead className="py-2 min-w-[120px]">Stage</TableHead>
                          <TableHead className="py-2 min-w-[100px]">Status</TableHead>
                          {assignmentGroupMode === "flat" ? (
                            <TableHead className="py-2 min-w-[100px]">Unit Type</TableHead>
                          ) : null}
                          <TableHead className="py-2 w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignmentGroups
                          ? assignmentGroups.map(([unitType, groupAssignments]) => (
                              <React.Fragment key={unitType}>
                                <tr className="bg-muted/40 border-b border-border/60">
                                  <td colSpan={6} className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        {unitType}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground/50">
                                        {groupAssignments.length} assignment{groupAssignments.length !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {groupAssignments.map((assignment, idx) => {
                                  const isExpanded = expandedAssignments.has(assignment.sheetSlug);
                                  const toggleExpand = () => {
                                    if (isExpanded) {
                                      setExpandedAssignments(new Set());
                                      setSelectedAssignmentSlug((prev) =>
                                        prev === assignment.sheetSlug ? null : prev,
                                      );
                                      return;
                                    }
                                    setExpandedAssignments(new Set([assignment.sheetSlug]));
                                    setSelectedAssignmentSlug(assignment.sheetSlug);
                                  };
                                  return (
                                    <React.Fragment key={assignment.sheetSlug}>
                                      <TableRow
                                        index={idx}
                                        className={cn("cursor-pointer", isExpanded && "bg-card/20")}
                                        onClick={toggleExpand}
                                      >
                                        <TableCell className="px-3 py-2.5">
                                          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150", isExpanded && "rotate-90")} />
                                        </TableCell>
                                        <TableCell className="py-2.5 max-w-[160px]">
                                          <div className="truncate text-sm font-medium text-foreground" title={(assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName}>
                                            {(assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                                          <StageSelectorCell
                                            currentStage={assignment.stage}
                                            onSave={(newStage) => updateAssignment(assignment.sheetSlug, { stage: newStage })}
                                          />
                                        </TableCell>
                                        <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                                          <StatusButtonCell
                                            currentStatus={assignment.status}
                                            onSave={(newStatus) => updateAssignment(assignment.sheetSlug, { status: newStatus })}
                                          />
                                        </TableCell>
                                        <TableCell className="py-2.5">
                                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            {(assignment as Record<string, unknown>).files && ((assignment as Record<string, unknown>).files as Record<string, unknown>).wireListPDFPath ? (
                                              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                                <a href={buildExportFileHref(project?.id ?? "", ((assignment as Record<string, unknown>).files as Record<string, unknown>).wireListPDFPath as string)} target="_blank" rel="noopener noreferrer">
                                                  <Download className="h-3 w-3" />
                                                </a>
                                              </Button>
                                            ) : null}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                      {isExpanded ? (
                                        <tr className="bg-card/15">
                                          <td colSpan={10} className="px-4 py-3">
                                            <div className="grid grid-cols-3 gap-2">
                                              {(assignment as Record<string, unknown>).blueLabels && ((assignment as Record<string, unknown>).blueLabels as unknown[])?.length ? (
                                                <AssignmentLabelDownloadButton
                                                  projectId={project?.id ?? ""}
                                                  assignmentSlug={assignment.sheetSlug}
                                                  labelType="blue"
                                                  className="w-full justify-center"
                                                />
                                              ) : null}
                                              {(assignment as Record<string, unknown>).whiteLabels && ((assignment as Record<string, unknown>).whiteLabels as unknown[])?.length ? (
                                                <AssignmentLabelDownloadButton
                                                  projectId={project?.id ?? ""}
                                                  assignmentSlug={assignment.sheetSlug}
                                                  labelType="white"
                                                  className="w-full justify-center"
                                                />
                                              ) : null}
                                              {(assignment as Record<string, unknown>).partNumbers && ((assignment as Record<string, unknown>).partNumbers as unknown[])?.length ? (
                                                <AssignmentLabelDownloadButton
                                                  projectId={project?.id ?? ""}
                                                  assignmentSlug={assignment.sheetSlug}
                                                  labelType="cable"
                                                  className="w-full justify-center"
                                                />
                                              ) : null}
                                            </div>
                                          </td>
                                        </tr>
                                      ) : null}
                                    </React.Fragment>
                                  );
                                })}
                              </React.Fragment>
                            ))
                          : assignmentEntries.map((assignment, idx) => {
                              const isExpanded = expandedAssignments.has(assignment.sheetSlug);
                              const toggleExpand = () => {
                                if (isExpanded) {
                                  setExpandedAssignments(new Set());
                                  setSelectedAssignmentSlug((prev) =>
                                    prev === assignment.sheetSlug ? null : prev,
                                  );
                                  return;
                                }
                                setExpandedAssignments(new Set([assignment.sheetSlug]));
                                setSelectedAssignmentSlug(assignment.sheetSlug);
                              };
                              return (
                                <React.Fragment key={assignment.sheetSlug}>
                                  <TableRow
                                    index={idx}
                                    className={cn("cursor-pointer", isExpanded && "bg-card/20")}
                                    onClick={toggleExpand}
                                  >
                                    <TableCell className="px-3 py-2.5">
                                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150", isExpanded && "rotate-90")} />
                                    </TableCell>
                                    <TableCell className="py-2.5 max-w-[160px]">
                                      <div className="truncate text-sm font-medium text-foreground" title={(assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName}>
                                        {(assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                                      <StageSelectorCell
                                        currentStage={assignment.stage}
                                        onSave={(newStage) => updateAssignment(assignment.sheetSlug, { stage: newStage })}
                                      />
                                    </TableCell>
                                    <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
                                      <StatusButtonCell
                                        currentStatus={assignment.status}
                                        onSave={(newStatus) => updateAssignment(assignment.sheetSlug, { status: newStatus })}
                                      />
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      {assignment.unitType || "—"}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        {(assignment as Record<string, unknown>).files && ((assignment as Record<string, unknown>).files as Record<string, unknown>).wireListPDFPath ? (
                                          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                            <a href={buildExportFileHref(project?.id ?? "", ((assignment as Record<string, unknown>).files as Record<string, unknown>).wireListPDFPath as string)} target="_blank" rel="noopener noreferrer">
                                              <Download className="h-3 w-3" />
                                            </a>
                                          </Button>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded ? (
                                    <tr className="bg-card/15">
                                      <td colSpan={10} className="px-4 py-3">
                                        <div className="grid grid-cols-3 gap-2">
                                          {(assignment as Record<string, unknown>).blueLabels && ((assignment as Record<string, unknown>).blueLabels as unknown[])?.length ? (
                                            <AssignmentLabelDownloadButton
                                              projectId={project?.id ?? ""}
                                              assignmentSlug={assignment.sheetSlug}
                                              labelType="blue"
                                              className="w-full justify-center"
                                            />
                                          ) : null}
                                          {(assignment as Record<string, unknown>).whiteLabels && ((assignment as Record<string, unknown>).whiteLabels as unknown[])?.length ? (
                                            <AssignmentLabelDownloadButton
                                              projectId={project?.id ?? ""}
                                              assignmentSlug={assignment.sheetSlug}
                                              labelType="white"
                                              className="w-full justify-center"
                                            />
                                          ) : null}
                                          {(assignment as Record<string, unknown>).partNumbers && ((assignment as Record<string, unknown>).partNumbers as unknown[])?.length ? (
                                            <AssignmentLabelDownloadButton
                                              projectId={project?.id ?? ""}
                                              assignmentSlug={assignment.sheetSlug}
                                              labelType="cable"
                                              className="w-full justify-center"
                                            />
                                          ) : null}
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </React.Fragment>
                              );
                            })}
                      </TableBody>
                    </Table>
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
              <div className="mt-4 space-y-4">
                {legalDetail ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-5">
                    <div className="flex flex-col gap-0.5 py-1">
                      <span className="text-[11px] text-muted-foreground">Latest Revision</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {legalDetail.latestRevision ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-muted-foreground">Workbook</span>
                      <span className="text-sm font-medium">
                        {legalDetail.hasWorkbook ? (
                          <span className="text-green-600">Present</span>
                        ) : (
                          <span className="text-muted-foreground">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-muted-foreground">Layout</span>
                      <span className="text-sm font-medium">
                        {legalDetail.hasLayout ? (
                          <span className="text-green-600">Present</span>
                        ) : (
                          <span className="text-muted-foreground">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-muted-foreground">Compare</span>
                      <span className="text-sm font-medium">
                        {legalDetail.hasGreenChangesWorkbook ? (
                          <span className="text-green-600">Present</span>
                        ) : (
                          <span className="text-muted-foreground">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-muted-foreground">Revisions</span>
                      <span className="text-sm font-semibold text-foreground">
                        {legalDetail.revisions.length}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-xl border border-border bg-background/40 p-4 sm:grid-cols-2">
                  <input
                    ref={workbookInputRef}
                    type="file"
                    accept=".xlsx,.xls,.xlsm,.xlsb"
                    className="hidden"
                    onClick={(event) => {
                      (event.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(event) =>
                      setWorkbookFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <input
                    ref={greenChangesInputRef}
                    type="file"
                    accept=".xlsx,.xls,.xlsm,.xlsb"
                    className="hidden"
                    onClick={(event) => {
                      (event.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(event) =>
                      setGreenChangesFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <input
                    ref={layoutInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onClick={(event) => {
                      (event.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(event) =>
                      setLayoutFile(event.target.files?.[0] ?? null)
                    }
                  />

                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      UCP Wire List
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => workbookInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {workbookFile ? "Replace Workbook" : "Choose Workbook"}
                    </Button>
                    <p className="truncate text-xs text-muted-foreground">
                      {workbookFile?.name || latestLegalRevisionRecord?.workbookFileName || "No workbook selected"}
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Layout PDF
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => layoutInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {layoutFile ? "Replace Layout" : "Choose Layout PDF"}
                    </Button>
                    <p className="truncate text-xs text-muted-foreground">
                      {layoutFile?.name || latestLegalRevisionRecord?.layoutFileName || "No layout selected"}
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      UCP Wire List Green Changes (Compare)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => greenChangesInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {greenChangesFile ? "Replace Compare Workbook" : "Choose Compare Workbook"}
                    </Button>
                    <p className="truncate text-xs text-muted-foreground">
                      {greenChangesFile?.name || latestLegalRevisionRecord?.greenChangesWorkbookFileName || "No compare workbook selected"}
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Revision Label
                    </span>
                    <Input
                      placeholder="e.g. A.1"
                      value={revisionNameDraft}
                      onChange={(e) => {
                        setRevisionNameDraft(e.target.value);
                        setRevisionNameTouched(true);
                      }}
                      className="h-9 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Computed: {deriveRevisionLabelFromFiles([workbookFile, greenChangesFile, layoutFile]) || legalDetail?.latestRevision || "Not detected"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={uploadingLegals || (!workbookFile && !greenChangesFile && !layoutFile)}
                    onClick={handleUploadLegals}
                  >
                    {uploadingLegals ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-3.5 w-3.5" />
                        Upload Revision Files
                      </>
                    )}
                  </Button>
                  {legalsMessage && (
                    <span className="text-xs text-muted-foreground">{legalsMessage}</span>
                  )}
                </div>
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
                
                {brandListAssignments.length === 0 ? (
                  <EmptyStateCard
                    title="No brand list sheets"
                    description="Generate brand list schemas to populate visibility settings."
                  />
                ) : (
                  <div className="space-y-2">
                    {brandListAssignments.map((assignment) => {
                      const isExpanded = expandedBrandAssignments.has(assignment.sheetSlug);
                      const toggleExpand = () => {
                        setExpandedBrandAssignments((prev) => {
                          const next = new Set(prev);
                          if (next.has(assignment.sheetSlug)) {
                            next.delete(assignment.sheetSlug);
                          } else {
                            next.add(assignment.sheetSlug);
                          }
                          return next;
                        });
                      };
                      const locations = schemaExternalLocations[assignment.sheetSlug] ?? [];
                      const genState = brandGeneratingSheets[assignment.sheetSlug] ?? "idle";
                      const brandExport = brandingExports?.sheetExports?.find(
                        (e) => e.sheetSlug === assignment.sheetSlug,
                      );
                      const hasPDF = !!brandExport?.relativePath;
                      const normalizedTitle = (assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName;

                      return (
                        <div key={assignment.sheetSlug} className="rounded-lg border border-border bg-card overflow-hidden">
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={toggleExpand}
                          >
                            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0", isExpanded && "rotate-90")} />
                            <span className="truncate text-sm font-medium flex-1" title={normalizedTitle}>{normalizedTitle}</span>
                            {locations.length > 0 && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] shrink-0">
                                {locations.length}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {hasPDF && genState !== "generating" && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 px-2 text-xs"
                                >
                                  <a
                                    href={`/api/projects/${encodeURIComponent(project?.id ?? "")}/brand-list/download?path=${encodeURIComponent(brandExport.relativePath)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Download className="h-3 w-3" />
                                    PDF
                                  </a>
                                </Button>
                              )}
                              {genState === "generating" ? (
                                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Generating
                                </Button>
                              ) : genState === "done" ? (
                                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-green-600" disabled>
                                  <Check className="h-3 w-3" />
                                  Done
                                </Button>
                              ) : genState === "error" ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 gap-1 px-2 text-xs"
                                  onClick={() => handleSaveAndGenerateBrandList(assignment.sheetSlug)}
                                >
                                  Retry
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-border/60 bg-muted/20 px-3 py-2 space-y-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                External Locations
                              </div>
                              {loadingSchemaLocations ? (
                                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading locations...
                                </div>
                              ) : locations.length === 0 ? (
                                <div className="py-2 text-xs text-muted-foreground italic">
                                  No external locations found for this sheet.
                                </div>
                              ) : (
                                <div className="grid gap-1.5">
                                  {locations.map((loc) => {
                                    const key = loc.trim().toUpperCase();
                                    const isVisible = brandListSettingsMatrix[assignment.sheetSlug]?.[key] ?? true;
                                    return (
                                      <div key={key} className="flex items-center justify-between gap-2 py-1">
                                        <span className="font-mono text-xs text-foreground truncate">{loc}</span>
                                        <Switch
                                          checked={isVisible}
                                          onCheckedChange={(checked) => setBrandListVisibility(assignment.sheetSlug, key, checked)}
                                          aria-label={`Toggle visibility of ${loc}`}
                                          className="shrink-0"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="pt-2 border-t border-border/40">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="w-full h-8 text-xs"
                                  onClick={() => handleSaveAndGenerateBrandList(assignment.sheetSlug)}
                                  disabled={genState === "generating"}
                                >
                                  {genState === "generating" ? (
                                    <>
                                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                      Saving & Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="mr-1.5 h-3 w-3" />
                                      Save & Generate
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Excluded Assignments */}
                {brandListExcluded.length > 0 && (
                  <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Excluded from Brand List ({brandListExcluded.length})
                    </p>
                    <div className="space-y-1.5">
                      {brandListExcluded.map(({ assignment, reason }) => {
                        const normalizedTitle = (assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName;
                        return (
                          <div key={assignment.sheetSlug} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-foreground/70" title={normalizedTitle}>
                              {normalizedTitle}
                            </span>
                            <span className="shrink-0 text-muted-foreground/60 italic">
                              {reason}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
                    {assignmentEntries.map((assignment) => {
                      const isExpanded = expandedAssignments.has(`wire-${assignment.sheetSlug}`);
                      const toggleExpand = () => {
                        setExpandedAssignments((prev) => {
                          const next = new Set(prev);
                          const key = `wire-${assignment.sheetSlug}`;
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        });
                      };
                      const locations = schemaExternalLocations[assignment.sheetSlug] ?? [];
                      const genState = wireGeneratingSheets[assignment.sheetSlug] ?? "idle";
                      const wireExport = wireExports?.sheetExports?.find(
                        (e) => e.sheetSlug === assignment.sheetSlug,
                      );
                      const hasPDF = !!wireExport?.relativePath;
                      const normalizedTitle = (assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName;

                      return (
                        <div key={assignment.sheetSlug} className="rounded-lg border border-border bg-card overflow-hidden">
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={toggleExpand}
                          >
                            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0", isExpanded && "rotate-90")} />
                            <span className="truncate text-sm font-medium flex-1" title={normalizedTitle}>{normalizedTitle}</span>
                            {locations.length > 0 && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] shrink-0">
                                {locations.length}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {hasPDF && genState !== "generating" && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 px-2 text-xs"
                                >
                                  <a
                                    href={`/api/projects/${encodeURIComponent(project?.id ?? "")}/wire-list/download?path=${encodeURIComponent(wireExport.relativePath)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Download className="h-3 w-3" />
                                    PDF
                                  </a>
                                </Button>
                              )}
                              {genState === "generating" ? (
                                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Generating
                                </Button>
                              ) : genState === "done" ? (
                                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-green-600" disabled>
                                  <Check className="h-3 w-3" />
                                  Done
                                </Button>
                              ) : genState === "error" ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 gap-1 px-2 text-xs"
                                  onClick={() => handleSaveAndGenerateWireList(assignment.sheetSlug)}
                                >
                                  Retry
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-border/60 bg-muted/20 px-3 py-2 space-y-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                External Locations
                              </div>
                              {loadingSchemaLocations ? (
                                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading locations...
                                </div>
                              ) : locations.length === 0 ? (
                                <div className="py-2 text-xs text-muted-foreground italic">
                                  No external locations found for this sheet.
                                </div>
                              ) : (
                                <div className="grid gap-1.5">
                                  {locations.map((loc) => {
                                    const key = loc.trim().toUpperCase();
                                    const isVisible = wireListSettingsMatrix[assignment.sheetSlug]?.[key] ?? true;
                                    return (
                                      <div key={key} className="flex items-center justify-between gap-2 py-1">
                                        <span className="font-mono text-xs text-foreground truncate">{loc}</span>
                                        <Switch
                                          checked={isVisible}
                                          onCheckedChange={(checked) => setWireListVisibility(assignment.sheetSlug, key, checked)}
                                          aria-label={`Toggle visibility of ${loc}`}
                                          className="shrink-0"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="pt-2 border-t border-border/40">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="w-full h-8 text-xs"
                                  onClick={() => handleSaveAndGenerateWireList(assignment.sheetSlug)}
                                  disabled={genState === "generating"}
                                >
                                  {genState === "generating" ? (
                                    <>
                                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                      Saving & Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="mr-1.5 h-3 w-3" />
                                      Save & Generate
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* ─── Cross Wire Section ────────────────────────────────────��─── */}
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

                    {/* Expandable rows - matching Brand/Wire List pattern */}
                    <div className="space-y-2">
                      {crossWireAssignments.map((assignment) => {
                        const isExpanded = expandedAssignments.has(`cross-${assignment.sheetSlug}`);
                        const toggleExpand = () => {
                          setExpandedAssignments((prev) => {
                            const next = new Set(prev);
                            const key = `cross-${assignment.sheetSlug}`;
                            if (next.has(key)) {
                              next.delete(key);
                            } else {
                              next.add(key);
                            }
                            return next;
                          });
                        };
                        const locations = schemaExternalLocations[assignment.sheetSlug] ?? [];
                        const isSavingSheet = savingCrossWireSettingsBySheet[assignment.sheetSlug] ?? false;
                        const isSwapped = crossWireSwapLocationsAll || (crossWireSwapLocationsBySheet[assignment.sheetSlug] ?? false);
                        const normalizedTitle = (assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName;
                        const visibleCount = locations.filter(
                          (loc) => crossWireSettingsMatrix[assignment.sheetSlug]?.[loc.trim().toUpperCase()] ?? true,
                        ).length;

                        return (
                          <div key={assignment.sheetSlug} className="rounded-lg border border-border bg-card overflow-hidden">
                            <div
                              className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={toggleExpand}
                            >
                              <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0", isExpanded && "rotate-90")} />
                              <span className="truncate text-sm font-medium flex-1" title={normalizedTitle}>{normalizedTitle}</span>
                              {locations.length > 0 && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] shrink-0">
                                  {visibleCount}/{locations.length}
                                </Badge>
                              )}
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-muted-foreground">Swap</span>
                                  <Switch
                                    checked={isSwapped}
                                    disabled={crossWireSwapLocationsAll}
                                    onCheckedChange={(checked) => handleCrossWireSwapBySheet(assignment.sheetSlug, checked)}
                                    aria-label={`Toggle swap for ${normalizedTitle}`}
                                    className="scale-75"
                                  />
                                </div>
                                {isSavingSheet ? (
                                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 px-2 text-xs"
                                    onClick={() => void handleSaveCrossWireSettings(assignment.sheetSlug)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-border/60 bg-muted/20 px-3 py-2 space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  External Locations
                                </div>
                                {loadingSchemaLocations ? (
                                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading locations...
                                  </div>
                                ) : locations.length === 0 ? (
                                  <div className="py-2 text-xs text-muted-foreground italic">
                                    No external locations found for this sheet.
                                  </div>
                                ) : (
                                  <div className="grid gap-1.5">
                                    {locations.map((loc) => {
                                      const key = loc.trim().toUpperCase();
                                      const isVisible = crossWireSettingsMatrix[assignment.sheetSlug]?.[key] ?? true;

                                      return (
                                        <div key={key} className="flex items-center justify-between gap-2 py-1">
                                          <span className="font-mono text-xs text-foreground truncate">{loc}</span>
                                          <Switch
                                            checked={isVisible}
                                            onCheckedChange={(checked) => setCrossWireLocationVisibility(assignment.sheetSlug, key, checked)}
                                            aria-label={`Toggle visibility of ${loc}`}
                                            className="shrink-0"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="pt-2 border-t border-border/40">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="w-full h-8 text-xs"
                                    onClick={() => void handleSaveCrossWireSettings(assignment.sheetSlug)}
                                    disabled={isSavingSheet}
                                  >
                                    {isSavingSheet ? (
                                      <>
                                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                        Saving...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="mr-1.5 h-3 w-3" />
                                        Save Settings
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Excluded Assignments */}
                    {crossWireExcluded.length > 0 && (
                      <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Excluded from Cross Wire ({crossWireExcluded.length})
                        </p>
                        <div className="space-y-1.5">
                          {crossWireExcluded.map(({ assignment, reason }) => {
                            const normalizedTitle = (assignment as Record<string, unknown>).normalizedTitle as string ?? assignment.sheetName;
                            return (
                              <div key={assignment.sheetSlug} className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate text-foreground/70" title={normalizedTitle}>
                                  {normalizedTitle}
                                </span>
                                <span className="shrink-0 text-muted-foreground/60 italic">
                                  {reason}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ─── Box Side Test Table ──────────────────────────────────────── */}
            <section data-section="box-side-test" className="scroll-mt-6">
              <BoxSideTestTable
                projectId={project.id}
                assignments={assignmentEntries.map((a) => ({
                  sheetSlug: a.sheetSlug,
                  sheetName: a.sheetName,
                  normalizedTitle: (a as Record<string, unknown>).normalizedTitle as string | undefined,
                  boxSide: (a as Record<string, unknown>).boxSide as string | undefined,
                }))}
                badgeNumber={badgeNumber ?? undefined}
              />
            </section>

            {/* ─── Visibility Matrix Concept Section ──────────────────────────── */}
            <section data-section="visibility-matrix" className="scroll-mt-6">
              <SectionHeader
                icon={Grid3X3}
                title="Visibility Matrix (Concept)"
                description="Experimental unified view of Wire List, Brand List, and Cross Wire visibility settings."
              />
              <div className="mt-4">
                <VisibilityMatrixConcept
                  projectId={project.id}
                  assignments={assignmentEntries.map((a) => ({
                    sheetSlug: a.sheetSlug,
                    sheetName: a.sheetName,
                    normalizedTitle: (a as Record<string, unknown>).normalizedTitle as string | undefined,
                    unitType: a.unitType,
                    boxSide: (a as Record<string, unknown>).boxSide as string | undefined,
                  }))}
                  externalLocations={schemaExternalLocations}
                  wireListSettings={wireListSettingsMatrix}
                  brandListSettings={brandListSettingsMatrix}
                  crossWireSettings={crossWireSettingsMatrix}
                  availableUnitTypes={availableUnitTypes}
                  isEditing={isEditing}
                  onWireListChange={(slug, loc, vis) => setWireListLocationVisibility(slug, loc, vis)}
                  onBrandListChange={(slug, loc, vis) => setBrandListLocationVisibility(slug, loc, vis)}
                  onCrossWireChange={(slug, loc, vis) => setCrossWireLocationVisibility(slug, loc, vis)}
                  onUnitTypeChange={handleAssignmentUnitTypeChange}
                  onBoxSideChange={handleAssignmentBoxSideChange}
                  onSaveAndGenerateAllWireLists={handleBulkSaveAndGenerateWireLists}
                  onSaveAndGenerateAllBrandLists={handleBulkSaveAndGenerateBrandLists}
                  onSaveAndGenerateCrossWire={handleBulkSaveAndGenerateCrossWire}
                  loading={loadingSchemaLocations}
                />
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
      <MultiSheetReviewModal
        projectId={project.id}
        open={brandReviewOpen}
        onOpenChange={(nextOpen) => {
          setBrandReviewOpen(nextOpen);
          if (!nextOpen) {
            setAutoStartBrandImport(false);
            void refreshBrandingExports();
          }
        }}
        showTrigger={false}
        title="Brand List Approval Editor"
        combineLabel="Combine Brand List"
        autoStartImport={autoStartBrandImport}
        onImportStarted={() => setAutoStartBrandImport(false)}
      />
    </div>
  );
}
