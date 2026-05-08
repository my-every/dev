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
  Palette,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { parseImportedBrandWorkbook } from "@/lib/wire-brand-list/import-workbook";
import { validateWorkbookFile } from "@/lib/workbook/parse-workbook";
import { LayoutPdfWorkspaceDialog } from "@/components/projects/layout-pdf-workspace-dialog";
import { MultiWireListPrintWorkspaceDialog } from "@/components/projects/multi-wire-list-print-workspace-dialog";

import { ProjectIcon } from "./project-icon";
import { AssignmentLabelDownloadButton } from "@/components/projects/assignment-label-download-button";
import { StageSelectorCell } from "@/components/projects/assignment-stage-selector-cell";
import { StatusButtonCell } from "@/components/projects/assignment-status-button-cell";

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

interface RevisionRefreshJobProgress {
  uploadStored: boolean;
  legalRevisionBuilt: boolean;
  projectStateRefreshed: boolean;
  wireBrandSchemasGenerated: boolean;
  crossWireSchemaGenerated: boolean;
}

interface RevisionRefreshJob {
  jobId: string;
  status: "running" | "completed" | "failed";
  message: string;
  error: string | null;
  progress: RevisionRefreshJobProgress;
}

type WireListSettingsMatrix = Record<string, Record<string, boolean>>;

type ProjectDetailsTab =
  | "details"
  | "assignments"
  | "legals"
  | "brand-lists"
  | "wire-lists"
  | "cross-wire";

interface TabGuidanceItem {
  title: string;
  description: string;
}

interface ProjectTabMeta {
  id: ProjectDetailsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  editable: boolean;
  title: string;
  description: string;
  guidanceTitle: string;
  guidanceDescription: string;
  guidanceItems: TabGuidanceItem[];
}

const PROJECT_STATUS_OPTIONS = [
  { value: "legals_pending", label: "Legals Pending", dot: "bg-slate-400" },
  { value: "brandlist",      label: "Brand List",     dot: "bg-blue-500"  },
  { value: "branding",       label: "Branding",       dot: "bg-purple-500"},
  { value: "kitting",        label: "Kitting",        dot: "bg-amber-500" },
  { value: "active",         label: "Active",         dot: "bg-green-500" },
  { value: "blocked",        label: "Blocked",        dot: "bg-red-500"   },
  { value: "completed",      label: "Completed",      dot: "bg-emerald-500"},
  { value: "shipped",        label: "Shipped",        dot: "bg-teal-500"  },
] as const;

const PROJECT_TAB_META: ProjectTabMeta[] = [
  {
    id: "details",
    label: "Details",
    icon: FileText,
    editable: true,
    title: "Project Details",
    description: "Core scheduling, project identity, revision, and workflow metadata.",
    guidanceTitle: "Details Guidance",
    guidanceDescription:
      "Use this tab to confirm the project identity, due dates, revision, LWC type, and current workflow status.",
    guidanceItems: [
      { title: "Project Name", description: "The display name used across project cards, lists, and dashboards." },
      { title: "PD Number", description: "The stable project identifier. This should stay locked once the project is created." },
      { title: "Revision", description: "The active project revision. Legal uploads may update this value." },
      { title: "Dates", description: "Due, ConLay, ConAssy, and Ship dates help prioritize the project schedule." },
    ],
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: GitBranch,
    editable: false,
    title: "Assignments",
    description: "Operational sheet assignments from the current project manifest.",
    guidanceTitle: "Assignments Guidance",
    guidanceDescription:
      "Use this tab to review each operational assignment, its stage, status, unit type, SWS mapping, and generated files.",
    guidanceItems: [
      { title: "Stage", description: "The workflow stage the assignment belongs to, such as build-up, wiring, or cross-wire." },
      { title: "Status", description: "Shows whether the assignment is pending, active, or completed." },
      { title: "SWS", description: "Links the assignment to a standard work sheet type for tracking and instruction." },
      { title: "Inline Details", description: "Selecting a row opens assignment-specific details in the right panel." },
    ],
  },
  {
    id: "legals",
    label: "Legals",
    icon: Upload,
    editable: false,
    title: "Legals",
    description: "Upload workbook and layout files, then review revision artifact health.",
    guidanceTitle: "Legals Guidance",
    guidanceDescription:
      "Use this tab to upload legal drawing files and verify whether required revision files exist.",
    guidanceItems: [
      { title: "Workbook", description: "The Excel legal drawing workbook used to generate assignment and print schemas." },
      { title: "Layout PDF", description: "The layout drawing used for visual review and layout workspace support." },
      { title: "Green Changes", description: "Indicates whether revision-change workbook data is present." },
      { title: "Latest Revision", description: "The newest discovered revision for this project." },
    ],
  },
  {
    id: "brand-lists",
    label: "Brand Lists",
    icon: FileSpreadsheet,
    editable: false,
    title: "Brand Lists",
    description: "Generate, combine, review, and control brand list outputs.",
    guidanceTitle: "Brand List Guidance",
    guidanceDescription:
      "Use this tab to generate brand list exports and control which external locations appear in the output.",
    guidanceItems: [
      { title: "Generate", description: "Creates separate brand list output per assignment." },
      { title: "Generate & Combine", description: "Creates individual outputs and a combined workbook." },
      { title: "Visibility", description: "Controls whether each external location appears in brand list exports." },
    ],
  },
  {
    id: "wire-lists",
    label: "Wire Lists",
    icon: Layers,
    editable: false,
    title: "Wire Lists",
    description: "Generate, review, print, and control wire list PDFs.",
    guidanceTitle: "Wire List Guidance",
    guidanceDescription:
      "Use this tab to generate wire list PDFs and control external location visibility per assignment.",
    guidanceItems: [
      { title: "Generate", description: "Rebuilds wire list PDFs from the current project assignment data." },
      { title: "Visibility", description: "Controls which external locations appear in the wire list output." },
      { title: "Print Preview", description: "Opens the printable wire list view for a selected assignment." },
    ],
  },
  {
    id: "cross-wire",
    label: "Cross Wire",
    icon: ExternalLink,
    editable: false,
    title: "Cross Wire List",
    description: "Preview and print external wiring connections grouped by unit type.",
    guidanceTitle: "Cross Wire Guidance",
    guidanceDescription:
      "Use this tab to open the cross-wire print preview or regenerate the cross-wire schema.",
    guidanceItems: [
      { title: "Cross Wire Preview", description: "Opens the printable external wiring connection report." },
      { title: "Regenerate Schema", description: "Rebuilds the cross-wire schema from assignment brand list schemas." },
    ],
  },
];

function getTabMeta(tab: ProjectDetailsTab): ProjectTabMeta {
  return PROJECT_TAB_META.find((item) => item.id === tab) ?? PROJECT_TAB_META[0]!;
}

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

function deriveRevisionLabelFromFiles(files: Array<File | null | undefined>): string {
  for (const file of files) {
    if (!file) {
      continue;
    }

    const parsed = parseRevisionFromFilename(file.name);
    if (parsed.revision && parsed.revision.toLowerCase() !== "unknown") {
      return parsed.revision;
    }
  }

  return "";
}

function hasUploadedLegalFiles(project: ProjectManifest): boolean {
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
  if (!hasUploadedLegalFiles(manifest)) {
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
      <div className="flex items-center gap-2 py-1.5 text-sm text-card-foreground">
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
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: React.ReactNode[];
}) {
  return (
    <div className="flex items-start gap-3 border-b pb-3">
      <div className="flex flex-1 flex-wrap justify-start gap-2">
        <div className="rounded-lg bg-card p-2">
          <Icon className="h-4 w-4 text-card-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-card-foreground">{description}</p>
        </div>
      </div>
      {actions?.length ? (
        <div className="flex max-w-max items-center gap-2">{actions}</div>
      ) : null}
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
      <p className="text-sm text-card-foreground">{title}</p>
      <p className="mt-1 text-xs text-card-foreground/70">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function ProjectTabGuidanceAside({
  meta,
  selectedAssignment,
}: {
  meta: ProjectTabMeta;
  selectedAssignment?: {
    sheetName: string;
    sheetSlug: string;
    stage?: string;
    status?: string;
    swsType?: string | null;
    partNumbers?: string[];
  } | null;
}) {
  return (
    <aside className="hidden w-72 shrink-0 border-l border-border bg-muted/20 xl:block">
      <div className="sticky top-0 max-h-[calc(90vh-4rem)] overflow-y-auto p-5">
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">{meta.guidanceTitle}</p>
          <p className="mt-1 text-xs leading-5 text-card-foreground">{meta.guidanceDescription}</p>

          <Separator className="my-4" />

          <div className="space-y-3">
            {meta.guidanceItems.map((item) => (
              <div key={item.title} className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">{item.title}</p>
                <p className="text-xs leading-5 text-card-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          {meta.id === "assignments" ? (
            <>
              <Separator className="my-4" />
              {selectedAssignment ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-card-foreground">
                      Selected Assignment
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {selectedAssignment.sheetName}
                    </p>
                    <p className="font-mono text-xs text-card-foreground">
                      {selectedAssignment.sheetSlug}
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-card-foreground">Stage</span>
                      <span className="font-medium text-foreground">
                        {formatTokenLabel(selectedAssignment.stage)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-card-foreground">Status</span>
                      <span className="font-medium text-foreground">
                        {formatTokenLabel(selectedAssignment.status)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-card-foreground">SWS</span>
                      <span className="font-medium text-foreground">
                        {selectedAssignment.swsType || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-card-foreground">Parts</span>
                      <span className="font-medium text-foreground">
                        {selectedAssignment.partNumbers?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs leading-5 text-card-foreground">
                  Select an assignment row to see its live details here.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function ProjectTabContentShell({
  meta,
  children,
  selectedAssignment,
}: {
  meta: ProjectTabMeta;
  children: React.ReactNode;
  selectedAssignment?: Parameters<typeof ProjectTabGuidanceAside>[0]["selectedAssignment"];
}) {
  const Icon = meta.icon;
  return (
    <div className="flex min-h-full">
      <main className="min-w-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <SectionHeader icon={Icon} title={meta.title} description={meta.description} />
          {children}
        </div>
      </main>
      <ProjectTabGuidanceAside meta={meta} selectedAssignment={selectedAssignment} />
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
  const { toast } = useToast();
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

  const [brandingExports, setBrandingExports] =
    useState<BrandingExportResult | null>(null);
  const [hasLoadedBrandingExports, setHasLoadedBrandingExports] =
    useState(false);
  const [wireExports, setWireExports] = useState<WireListExportResult | null>(
    null,
  );
  const [hasLoadedWireExports, setHasLoadedWireExports] = useState(false);
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
  const [savingWireListSettingsBySheet, setSavingWireListSettingsBySheet] =
    useState<Record<string, boolean>>({});
  const [regeneratingWireBySheet, setRegeneratingWireBySheet] = useState<
    Record<string, boolean>
  >({});
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
  const [expandedBrandAssignments, setExpandedBrandAssignments] = useState<Set<string>>(
    new Set(),
  );
  const [expandedCrossAssignments, setExpandedCrossAssignments] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAssignmentSlug, setSelectedAssignmentSlug] = useState<
    string | null
  >(null);
  const [assignmentGroupMode, setAssignmentGroupMode] = useState<"flat" | "unit-type">("flat");

  const [brandListSettingsMatrix, setBrandListSettingsMatrix] =
    useState<WireListSettingsMatrix>({});
  const [savingBrandListSettings, setSavingBrandListSettings] = useState(false);
  const [savingBrandListSettingsBySheet, setSavingBrandListSettingsBySheet] =
    useState<Record<string, boolean>>({});
  const [regeneratingBrandBySheet, setRegeneratingBrandBySheet] = useState<
    Record<string, boolean>
  >({});
  const [brandListSettingsMessage, setBrandListSettingsMessage] = useState<
    string | null
  >(null);

  const [crossWireSettingsMatrix, setCrossWireSettingsMatrix] =
    useState<WireListSettingsMatrix>({});

  const [crossWireSchema, setCrossWireSchema] =
    useState<CrossWireSchemaSummary | null>(null);
  const [hasLoadedCrossWireSchema, setHasLoadedCrossWireSchema] =
    useState(false);
  const [loadingCrossWireSchema, setLoadingCrossWireSchema] = useState(false);
  const [regeneratingCrossWireSchema, setRegeneratingCrossWireSchema] =
    useState(false);
  const [savingCrossWireSettingsBySheet, setSavingCrossWireSettingsBySheet] =
    useState<Record<string, boolean>>({});
  const [crossWireSettingsMessage, setCrossWireSettingsMessage] = useState<
    string | null
  >(null);
  const brandImportInputRef = useRef<HTMLInputElement | null>(null);
  const [preparingBrandImport, setPreparingBrandImport] = useState(false);

  const [layoutWorkspaceOpen, setLayoutWorkspaceOpen] = useState(false);
  const [wireReviewOpen, setWireReviewOpen] = useState(false);
  const hasChildWorkflowOpen = layoutWorkspaceOpen || wireReviewOpen;
  const collectionModalOpen = open && !hasChildWorkflowOpen;

  useEffect(() => {
    if (refreshJobPollRef.current) {
      clearInterval(refreshJobPollRef.current);
      refreshJobPollRef.current = null;
    }

    if (!open) {
      if (project?.id) {
        void fetch(
          `/api/projects/${encodeURIComponent(project.id)}/multi-sheet-print/session`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entryMode: "cover",
              importSession: null,
            }),
          },
        ).catch(() => {
          // Best-effort cleanup; no user-facing failure needed.
        });
      }
      setProjectState(project);
      setEditDraft(null);
      setIsEditing(false);
      setSaveError(null);
      setActiveTab("details");
      setLegalDetail(null);
      setHasLoadedLegals(false);
      setBrandingExports(null);
      setHasLoadedBrandingExports(false);
      setWireExports(null);
      setHasLoadedWireExports(false);
      setSavingWireListSettingsBySheet({});
      setRegeneratingWireBySheet({});
      setSavingBrandListSettingsBySheet({});
      setRegeneratingBrandBySheet({});
      setSchemaExternalLocations({});
      setWorkbookFile(null);
      setGreenChangesFile(null);
      setLayoutFile(null);
      setRevisionNameDraft("");
      setRevisionNameTouched(false);
      setLegalsMessage(null);
      setResolvedVisibilityBySheet({});
      setRefreshJob(null);
      setExpandedAssignments(new Set());
      setExpandedBrandAssignments(new Set());
      setExpandedCrossAssignments(new Set());
      setLayoutWorkspaceOpen(false);
      setWireReviewOpen(false);
      setCrossWireSettingsMatrix({});
      setCrossWireSchema(null);
      setHasLoadedCrossWireSchema(false);
      setSavingCrossWireSettingsBySheet({});
      setCrossWireSettingsMessage(null);
      setSelectedAssignmentSlug(null);
      return;
    }

    setProjectState(project);
    setEditDraft(null);
    setIsEditing(false);
    setSaveError(null);
    setLegalDetail(null);
    setHasLoadedLegals(false);
    setBrandingExports(null);
    setHasLoadedBrandingExports(false);
    setWireExports(null);
    setHasLoadedWireExports(false);
    setSavingWireListSettingsBySheet({});
    setRegeneratingWireBySheet({});
    setSavingBrandListSettingsBySheet({});
    setRegeneratingBrandBySheet({});
    setSavingCrossWireSettingsBySheet({});
    setCrossWireSettingsMessage(null);
    setSchemaExternalLocations({});
    setResolvedVisibilityBySheet({});
    setRefreshJob(null);
    setWorkbookFile(null);
    setGreenChangesFile(null);
    setLayoutFile(null);
    setRevisionNameDraft("");
    setRevisionNameTouched(false);
    setLayoutWorkspaceOpen(false);
    setWireReviewOpen(false);
    setCrossWireSettingsMatrix({});
    setCrossWireSchema(null);
    setHasLoadedCrossWireSchema(false);
    setExpandedCrossAssignments(new Set());
  }, [open, project]);

  useEffect(
    () => () => {
      if (refreshJobPollRef.current) {
        clearInterval(refreshJobPollRef.current);
        refreshJobPollRef.current = null;
      }
    },
    [],
  );

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

  const latestLegalRevisionRecord = useMemo(() => {
    if (!legalDetail?.revisions?.length) {
      return null;
    }

    return (
      legalDetail.revisions.find(
        (revision) => revision.revision === legalDetail.latestRevision,
      )
      ?? [...legalDetail.revisions].sort((left, right) =>
        right.revision.localeCompare(left.revision),
      )[0]
    );
  }, [legalDetail]);

  // Stable project ID ref — avoids recreating updateAssignment on every state change.
  const projectIdRef = useRef<string | null>(null);
  if (projectState?.id) projectIdRef.current = projectState.id;

  const updateAssignment = useCallback(
    async (sheetSlug: string, patch: { stage?: string; status?: string }) => {
      const projectId = projectIdRef.current;
      if (!projectId) return;
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/assignments/${encodeURIComponent(sheetSlug)}`,
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
      if (!res.ok) return;
      const data = (await res.json()) as { assignment: typeof assignmentEntries[0] };
      setProjectState((prev) =>
        prev
          ? {
              ...prev,
              assignments: {
                ...prev.assignments,
                [sheetSlug]: data.assignment,
              },
            }
          : prev,
      );
    },
    [badgeNumber],
  );

  useEffect(() => {
    if (revisionNameTouched) {
      return;
    }

    const computedRevision = deriveRevisionLabelFromFiles([
      workbookFile,
      greenChangesFile,
      layoutFile,
    ]);

    setRevisionNameDraft(
      computedRevision || currentProject?.revision || legalDetail?.latestRevision || "",
    );
  }, [
    currentProject?.revision,
    greenChangesFile,
    layoutFile,
    legalDetail?.latestRevision,
    revisionNameTouched,
    workbookFile,
  ]);

  const handleBrandImportFileSelection = useCallback(async (file: File | null) => {
    if (!currentProject?.id || !file) {
      return;
    }

    const validation = validateWorkbookFile(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid workbook",
        description: validation.error,
        duration: 3500,
      });
      return;
    }

    setPreparingBrandImport(true);
    try {
      const importedSheets = await parseImportedBrandWorkbook(file);
      const prepareResponse = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/multi-sheet-print/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare",
            workbookFileName: file.name,
            importedSheets,
          }),
        },
      );

      const preparePayload = (await prepareResponse.json().catch(() => ({}))) as {
        importSession?: Record<string, unknown>;
        error?: string;
      };

      if (!prepareResponse.ok || !preparePayload.importSession) {
        throw new Error(
          preparePayload.error || "Failed to prepare brand list comparison.",
        );
      }

      const sessionResponse = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/multi-sheet-print/session`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryMode: "import-review",
            importSession: preparePayload.importSession,
          }),
        },
      );

      if (!sessionResponse.ok) {
        throw new Error("Failed to persist brand list import session.");
      }

      const returnTo = `/${badgeNumber}/projects?openProjectId=${encodeURIComponent(currentProject.id)}`;
      onOpenChange(false);
      router.push(
        `/${badgeNumber}/projects/${encodeURIComponent(currentProject.id)}/brand-list-import?returnTo=${encodeURIComponent(returnTo)}`,
      );
    } catch (error) {
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to prepare brand list comparison.",
        duration: 4000,
      });
    } finally {
      setPreparingBrandImport(false);
    }
  }, [badgeNumber, currentProject?.id, onOpenChange, router, toast]);

  const clearBrandImportSession = useCallback(async () => {
    if (!projectState?.id) return;
    try {
      await fetch(
        `/api/projects/${encodeURIComponent(projectState.id)}/multi-sheet-print/session`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryMode: "cover",
            importSession: null,
          }),
        },
      );
    } catch (error) {
      // Silently fail on cleanup; this is a best-effort operation
    }
  }, [projectState?.id]);

  const normalizeLocationKey = useCallback((value: string | null | undefined) => {
    return String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  }, []);

  const fetchResolvedVisibilitySettings = useCallback(async () => {
    if (!currentProject?.id) {
      setResolvedVisibilityBySheet({});
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/assignment-visibility-settings`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        resolvedBySheet?: ResolvedVisibilityBySheet;
      };
      setResolvedVisibilityBySheet(payload.resolvedBySheet ?? {});
    } catch {
      // Non-blocking: UI falls back to manifest values.
    }
  }, [currentProject?.id]);

  const buildVisibilitySettingsPayload = useCallback(() => {
    return assignmentEntries.map((assignment) => {
      const existingByKey = new Map(
        (assignment.externalLocations ?? []).map((item) => [
          normalizeLocationKey(item.location),
          item,
        ]),
      );

      const schemaLocations = schemaExternalLocations[assignment.sheetSlug] ?? [];
      const mergedLocations: Array<{
        location: string;
        wireListVisible: boolean;
        brandingVisible: boolean;
        crossWireVisible: boolean;
      }> = [];
      const seenKeys = new Set<string>();

      for (const location of schemaLocations) {
        const key = normalizeLocationKey(location);
        if (!key) {
          continue;
        }
        seenKeys.add(key);
        const existing = existingByKey.get(key);
        mergedLocations.push({
          location,
          wireListVisible:
            wireListSettingsMatrix[assignment.sheetSlug]?.[key]
            ?? existing?.wireListVisible
            ?? true,
          brandingVisible:
            brandListSettingsMatrix[assignment.sheetSlug]?.[key]
            ?? existing?.brandingVisible
            ?? true,
          crossWireVisible:
            crossWireSettingsMatrix[assignment.sheetSlug]?.[key]
            ?? existing?.wireListVisible
            ?? true,
        });
      }

      for (const [key, existing] of existingByKey) {
        if (seenKeys.has(key)) {
          continue;
        }
        mergedLocations.push({
          location: String(existing.location ?? ""),
          wireListVisible:
            wireListSettingsMatrix[assignment.sheetSlug]?.[key]
            ?? existing.wireListVisible
            ?? true,
          brandingVisible:
            brandListSettingsMatrix[assignment.sheetSlug]?.[key]
            ?? existing.brandingVisible
            ?? true,
          crossWireVisible:
            crossWireSettingsMatrix[assignment.sheetSlug]?.[key]
            ?? existing.wireListVisible
            ?? true,
        });
      }

      return {
        sheetSlug: assignment.sheetSlug,
        sheetName: assignment.sheetName,
        unitType: assignment.unitType ?? null,
        locations: mergedLocations,
      };
    });
  }, [
    assignmentEntries,
    brandListSettingsMatrix,
    crossWireSettingsMatrix,
    normalizeLocationKey,
    schemaExternalLocations,
    wireListSettingsMatrix,
  ]);

  const persistAssignmentVisibilitySettings = useCallback(async () => {
    if (!currentProject?.id) {
      return;
    }

    const assignments = buildVisibilitySettingsPayload();
    if (!assignments.length) {
      return;
    }

    await fetch(
      `/api/projects/${encodeURIComponent(currentProject.id)}/assignment-visibility-settings`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-badge-number": badgeNumber,
          "x-shift": "1st",
        },
        body: JSON.stringify({
          pdNumber: currentProject.pdNumber,
          assignments,
          persistToReference: true,
        }),
      },
    ).catch(() => null);
  }, [badgeNumber, buildVisibilitySettingsPayload, currentProject?.id, currentProject?.pdNumber]);

  const refreshProjectManifestAfterRevision = useCallback(async () => {
    if (!currentProject?.id) {
      return;
    }

    const response = await fetch(
      `/api/projects/${encodeURIComponent(currentProject.id)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { manifest?: ProjectManifest };
    if (!payload.manifest) {
      return;
    }

    setProjectState(normalizeManifestAfterLegalUpload(payload.manifest));
  }, [currentProject?.id]);

  const stopRefreshJobPolling = useCallback(() => {
    if (refreshJobPollRef.current) {
      clearInterval(refreshJobPollRef.current);
      refreshJobPollRef.current = null;
    }
  }, []);

  const startRefreshJobPolling = useCallback((projectId: string) => {
    stopRefreshJobPolling();

    refreshJobPollRef.current = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/projects/revisions/${encodeURIComponent(projectId)}/refresh-job`,
            { cache: "no-store" },
          );
          if (!response.ok) {
            return;
          }

          const payload = (await response.json()) as { job?: RevisionRefreshJob };
          if (!payload.job) {
            return;
          }

          setRefreshJob(payload.job);

          if (payload.job.status === "running") {
            return;
          }

          stopRefreshJobPolling();

          if (payload.job.status === "completed") {
            setLegalsMessage(
              payload.job.message ||
                "Revision refresh completed. All tabs now use the latest revision.",
            );
            await refreshProjectManifestAfterRevision();
            await fetchResolvedVisibilitySettings();
            setHasLoadedLegals(false);
            setHasLoadedBrandingExports(false);
            setHasLoadedWireExports(false);
            setHasLoadedCrossWireSchema(false);
            return;
          }

          setLegalsMessage(
            payload.job.error || "Revision refresh failed. Please try again.",
          );
        } catch {
          // Keep polling through transient failures.
        }
      })();
    }, 2000);
  }, [
    fetchResolvedVisibilitySettings,
    refreshProjectManifestAfterRevision,
    stopRefreshJobPolling,
  ]);

  useEffect(() => {
    if (!currentProject?.id || !open) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/projects/revisions/${encodeURIComponent(currentProject.id)}/refresh-job`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { job?: RevisionRefreshJob };
        if (!payload.job) {
          return;
        }

        setRefreshJob(payload.job);
        if (payload.job.status === "running") {
          startRefreshJobPolling(currentProject.id);
        }
      } catch {
        // Silent fallback; uploader still works without restored polling.
      }
    })();
  }, [currentProject?.id, open, startRefreshJobPolling]);

  const anyAssignmentHasLocations = useMemo(
    () =>
      assignmentEntries.some(
        (a) => (schemaExternalLocations[a.sheetSlug] ?? []).length > 0,
      ),
    [assignmentEntries, schemaExternalLocations],
  );

  const hasSchemaExternalLocations = useMemo(
    () => Object.keys(schemaExternalLocations).length > 0,
    [schemaExternalLocations],
  );

  const crossWireStats = useMemo(() => {
    let assignmentsWithExternal = 0;
    let totalLocations = 0;
    let visibleLocations = 0;

    for (const assignment of assignmentEntries) {
      const locations = (schemaExternalLocations[assignment.sheetSlug] ?? [])
        .map((loc) => loc.trim().toUpperCase())
        .filter(Boolean);
      if (locations.length === 0) {
        continue;
      }
      assignmentsWithExternal += 1;
      totalLocations += locations.length;
      for (const key of locations) {
        if (crossWireSettingsMatrix[assignment.sheetSlug]?.[key] ?? true) {
          visibleLocations += 1;
        }
      }
    }

    return {
      assignmentsWithExternal,
      totalLocations,
      visibleLocations,
      hiddenLocations: Math.max(0, totalLocations - visibleLocations),
    };
  }, [assignmentEntries, schemaExternalLocations, crossWireSettingsMatrix]);

  const assignmentGroups = useMemo(() => {
    if (assignmentGroupMode === "flat") return null;
    const groups = new Map<string, typeof assignmentEntries>();
    for (const a of assignmentEntries) {
      const key = a.unitType || "—";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [assignmentEntries, assignmentGroupMode]);

  useEffect(() => {
    if (!currentProject?.id) {
      setResolvedVisibilityBySheet({});
      return;
    }
    void fetchResolvedVisibilitySettings();
  }, [currentProject?.id, fetchResolvedVisibilitySettings]);

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
        if (!key) {
          continue;
        }
        row[key] =
          resolvedVisibilityBySheet[assignment.sheetSlug]?.[key]
            ?.wireListVisible
          ?? existingByKey.get(key)?.wireListVisible
          ?? true;
      }
      nextMatrix[assignment.sheetSlug] = row;
    }

    setWireListSettingsMatrix(nextMatrix);
  }, [
    assignmentEntries,
    currentProject,
    resolvedVisibilityBySheet,
    schemaExternalLocations,
  ]);

  useEffect(() => {
    if (!currentProject) {
      setBrandListSettingsMatrix({});
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
        if (!key) {
          continue;
        }
        row[key] =
          resolvedVisibilityBySheet[assignment.sheetSlug]?.[key]
            ?.brandingVisible
          ?? existingByKey.get(key)?.brandingVisible
          ?? true;
      }
      nextMatrix[assignment.sheetSlug] = row;
    }

    setBrandListSettingsMatrix(nextMatrix);
  }, [
    assignmentEntries,
    currentProject,
    resolvedVisibilityBySheet,
    schemaExternalLocations,
  ]);

  // Initialize cross-wire settings matrix from wireListVisible (separate copy, independent of wire list tab)
  useEffect(() => {
    if (!currentProject) {
      setCrossWireSettingsMatrix({});
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
        if (!key) {
          continue;
        }
        row[key] =
          resolvedVisibilityBySheet[assignment.sheetSlug]?.[key]
            ?.crossWireVisible
          ?? existingByKey.get(key)?.wireListVisible
          ?? true;
      }
      nextMatrix[assignment.sheetSlug] = row;
    }

    setCrossWireSettingsMatrix(nextMatrix);
  }, [
    assignmentEntries,
    currentProject,
    resolvedVisibilityBySheet,
    schemaExternalLocations,
  ]);

  const refreshLegalDetail = useCallback(async () => {
    if (!projectState?.pdNumber) {
      setLegalDetail(null);
      setHasLoadedLegals(false);
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
      setHasLoadedLegals(true);
    }
  }, [projectState?.pdNumber]);

  const refreshBrandingExports = useCallback(async () => {
    if (!projectState?.id) {
      setBrandingExports(null);
      setHasLoadedBrandingExports(false);
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
      setHasLoadedBrandingExports(true);
    }
  }, [projectState?.id]);

  const refreshWireExports = useCallback(async () => {
    if (!projectState?.id) {
      setWireExports(null);
      setHasLoadedWireExports(false);
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
      setHasLoadedWireExports(true);
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

  const refreshCrossWireSchema = useCallback(async () => {
    if (!projectState?.id) {
      setCrossWireSchema(null);
      setHasLoadedCrossWireSchema(false);
      return;
    }

    setLoadingCrossWireSchema(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectState.id)}/cross-wire-schema`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setCrossWireSchema(null);
        return;
      }

      const payload = (await response.json()) as CrossWireSchemaSummary;
      setCrossWireSchema(payload);
    } finally {
      setLoadingCrossWireSchema(false);
      setHasLoadedCrossWireSchema(true);
    }
  }, [projectState?.id]);

  useEffect(() => {
    if (!open || !projectState || activeTab !== "legals") {
      return;
    }
    if (!loadingLegals && !hasLoadedLegals) {
      void refreshLegalDetail();
    }
  }, [
    activeTab,
    hasLoadedLegals,
    loadingLegals,
    open,
    projectState,
    refreshLegalDetail,
  ]);

  useEffect(() => {
    if (!open || !projectState || activeTab !== "brand-lists") {
      return;
    }
    if (!loadingBrandingExports && !hasLoadedBrandingExports) {
      void refreshBrandingExports();
    }
  }, [
    activeTab,
    hasLoadedBrandingExports,
    loadingBrandingExports,
    open,
    projectState,
    refreshBrandingExports,
  ]);

  useEffect(() => {
    if (!open || !projectState || activeTab !== "wire-lists") {
      return;
    }
    if (!loadingWireExports && !hasLoadedWireExports) {
      void refreshWireExports();
    }
  }, [
    activeTab,
    hasLoadedWireExports,
    loadingWireExports,
    open,
    projectState,
    refreshWireExports,
  ]);

  useEffect(() => {
    if (!open || !projectState || activeTab !== "cross-wire") {
      return;
    }
    if (!loadingCrossWireSchema && !hasLoadedCrossWireSchema) {
      void refreshCrossWireSchema();
    }
  }, [
    activeTab,
    hasLoadedCrossWireSchema,
    loadingCrossWireSchema,
    open,
    projectState,
    refreshCrossWireSchema,
  ]);

  useEffect(() => {
    if (!open || !projectState) {
      return;
    }
    const needsSchemaForTab =
      activeTab === "brand-lists" ||
      activeTab === "wire-lists" ||
      activeTab === "cross-wire";
    if (!needsSchemaForTab) {
      return;
    }
    if (
      !loadingSchemaLocations &&
      assignmentEntries.length > 0 &&
      !hasSchemaExternalLocations
    ) {
      void refreshSchemaLocations();
    }
  }, [
    activeTab,
    assignmentEntries.length,
    hasSchemaExternalLocations,
    loadingSchemaLocations,
    open,
    projectState,
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

  const handleSaveWireListSettings = useCallback(async (sheetSlug: string) => {
    if (!currentProject) return;

    const assignment = assignmentEntries.find(
      (entry) => entry.sheetSlug === sheetSlug,
    );
    if (!assignment) {
      return;
    }

    setSavingWireListSettings(true);
    setSavingWireListSettingsBySheet((prev) => ({
      ...prev,
      [sheetSlug]: true,
    }));
    setWireListSettingsMessage(null);
    try {
      const existingByKey = new Map(
        (assignment.externalLocations ?? []).map((item) => [
          String(item.location ?? "")
            .trim()
            .toUpperCase(),
          item,
        ]),
      );

      const schemaLocations = schemaExternalLocations[assignment.sheetSlug] ?? [];
      const schemaKeys = new Set(schemaLocations.map((l) => l.trim().toUpperCase()));

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

      for (const [key, existing] of existingByKey) {
        if (!schemaKeys.has(key)) {
          externalLocations.push({
            location: String(existing.location ?? ""),
            wireListVisible: existing.wireListVisible ?? true,
            brandingVisible: existing.brandingVisible ?? true,
          });
        }
      }

      const nextAssignments = {
        ...currentProject.assignments,
        [assignment.sheetSlug]: {
          ...assignment,
          externalLocations,
        },
      };

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
          [assignment.sheetSlug]: nextAssignments[assignment.sheetSlug],
        },
      };
      setProjectState(mergedManifest);
      setWireListSettingsMessage(
        `Saved ${assignment.sheetName} settings — regenerating PDF…`,
      );
      setRegeneratingWireBySheet((prev) => ({
        ...prev,
        [sheetSlug]: true,
      }));

      const regenerateResponse = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/exports?kind=wire-lists&sheet=${encodeURIComponent(sheetSlug)}`,
        { method: "POST" },
      );
      if (!regenerateResponse.ok) {
        throw new Error("Settings saved but failed to regenerate sheet PDF.");
      }

      await refreshWireExports();
      await persistAssignmentVisibilitySettings();
      await fetchResolvedVisibilitySettings();
      setWireListSettingsMessage(
        `${assignment.sheetName} settings saved and PDF regenerated.`,
      );
    } catch (error) {
      setWireListSettingsMessage(
        error instanceof Error
          ? error.message
          : "Failed to save wire list settings.",
      );
    } finally {
      setSavingWireListSettingsBySheet((prev) => ({
        ...prev,
        [sheetSlug]: false,
      }));
      setRegeneratingWireBySheet((prev) => ({
        ...prev,
        [sheetSlug]: false,
      }));
      setSavingWireListSettings(false);
    }
  }, [
    assignmentEntries,
    currentProject,
    fetchResolvedVisibilitySettings,
    persistAssignmentVisibilitySettings,
    refreshWireExports,
    schemaExternalLocations,
    wireListSettingsMatrix,
  ]);

  const setBrandListLocationVisibility = useCallback(
    (sheetSlug: string, location: string, visible: boolean) => {
      setBrandListSettingsMatrix((prev) => ({
        ...prev,
        [sheetSlug]: {
          ...(prev[sheetSlug] ?? {}),
          [location]: visible,
        },
      }));
    },
    [],
  );

  const handleSaveBrandListSettings = useCallback(async (sheetSlug: string) => {
    if (!currentProject) return;

    const assignment = assignmentEntries.find(
      (entry) => entry.sheetSlug === sheetSlug,
    );
    if (!assignment) {
      return;
    }

    setSavingBrandListSettings(true);
    setSavingBrandListSettingsBySheet((prev) => ({
      ...prev,
      [sheetSlug]: true,
    }));
    setBrandListSettingsMessage(null);
    try {
      const existingByKey = new Map(
        (assignment.externalLocations ?? []).map((item) => [
          String(item.location ?? "")
            .trim()
            .toUpperCase(),
          item,
        ]),
      );

      const schemaLocations = schemaExternalLocations[assignment.sheetSlug] ?? [];
      const schemaKeys = new Set(schemaLocations.map((l) => l.trim().toUpperCase()));

      const externalLocations = schemaLocations.map((location) => {
        const key = location.trim().toUpperCase();
        const existing = existingByKey.get(key);
        return {
          location,
          wireListVisible: existing?.wireListVisible ?? true,
          brandingVisible:
            brandListSettingsMatrix[assignment.sheetSlug]?.[key] ??
            existing?.brandingVisible ??
            true,
        };
      });

      for (const [key, existing] of existingByKey) {
        if (!schemaKeys.has(key)) {
          externalLocations.push({
            location: String(existing.location ?? ""),
            wireListVisible: existing.wireListVisible ?? true,
            brandingVisible: existing.brandingVisible ?? true,
          });
        }
      }

      const nextAssignments = {
        ...currentProject.assignments,
        [assignment.sheetSlug]: {
          ...assignment,
          externalLocations,
        },
      };

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
        throw new Error(payload.error || "Failed to save brand list settings.");
      }

      const serverManifest = payload.manifest ?? nextManifest;
      const mergedManifest: ProjectManifest = {
        ...serverManifest,
        assignments: {
          ...serverManifest.assignments,
          [assignment.sheetSlug]: nextAssignments[assignment.sheetSlug],
        },
      };
      setProjectState(mergedManifest);
      setBrandListSettingsMessage(
        `Saved ${assignment.sheetName} settings — regenerating brand list…`,
      );
      setRegeneratingBrandBySheet((prev) => ({
        ...prev,
        [sheetSlug]: true,
      }));

      const regenerateResponse = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/exports?kind=branding&sheet=${encodeURIComponent(sheetSlug)}`,
        { method: "POST" },
      );
      if (!regenerateResponse.ok) {
        throw new Error("Settings saved but failed to regenerate brand list.");
      }

      await refreshBrandingExports();
      await persistAssignmentVisibilitySettings();
      await fetchResolvedVisibilitySettings();
      setBrandListSettingsMessage(
        `${assignment.sheetName} settings saved and brand list regenerated.`,
      );
    } catch (error) {
      setBrandListSettingsMessage(
        error instanceof Error
          ? error.message
          : "Failed to save brand list settings.",
      );
    } finally {
      setSavingBrandListSettingsBySheet((prev) => ({
        ...prev,
        [sheetSlug]: false,
      }));
      setRegeneratingBrandBySheet((prev) => ({
        ...prev,
        [sheetSlug]: false,
      }));
      setSavingBrandListSettings(false);
    }
  }, [
    assignmentEntries,
    brandListSettingsMatrix,
    currentProject,
    fetchResolvedVisibilitySettings,
    persistAssignmentVisibilitySettings,
    refreshBrandingExports,
    schemaExternalLocations,
  ]);

  const setCrossWireLocationVisibility = useCallback(
    (sheetSlug: string, location: string, visible: boolean) => {
      setCrossWireSettingsMatrix((prev) => ({
        ...prev,
        [sheetSlug]: {
          ...(prev[sheetSlug] ?? {}),
          [location]: visible,
        },
      }));
    },
    [],
  );

  const handleSaveCrossWireSettings = useCallback(async (sheetSlug: string) => {
    if (!currentProject) return;

    const assignment = assignmentEntries.find(
      (entry) => entry.sheetSlug === sheetSlug,
    );
    if (!assignment) {
      return;
    }

    setSavingCrossWireSettingsBySheet((prev) => ({
      ...prev,
      [sheetSlug]: true,
    }));
    setCrossWireSettingsMessage(null);

    try {
      const existingByKey = new Map(
        (assignment.externalLocations ?? []).map((item) => [
          String(item.location ?? "")
            .trim()
            .toUpperCase(),
          item,
        ]),
      );

      const schemaLocations = schemaExternalLocations[assignment.sheetSlug] ?? [];
      const schemaKeys = new Set(
        schemaLocations.map((location) => location.trim().toUpperCase()),
      );

      const externalLocations = schemaLocations.map((location) => {
        const key = location.trim().toUpperCase();
        const existing = existingByKey.get(key);
        return {
          location,
          wireListVisible:
            crossWireSettingsMatrix[assignment.sheetSlug]?.[key] ??
            existing?.wireListVisible ??
            true,
          brandingVisible: existing?.brandingVisible ?? true,
        };
      });

      for (const [key, existing] of existingByKey) {
        if (!schemaKeys.has(key)) {
          externalLocations.push({
            location: String(existing.location ?? ""),
            wireListVisible: existing.wireListVisible ?? true,
            brandingVisible: existing.brandingVisible ?? true,
          });
        }
      }

      const nextAssignments = {
        ...currentProject.assignments,
        [assignment.sheetSlug]: {
          ...assignment,
          externalLocations,
        },
      };

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
        throw new Error(payload.error || "Failed to save cross wire settings.");
      }

      const serverManifest = payload.manifest ?? nextManifest;
      const mergedManifest: ProjectManifest = {
        ...serverManifest,
        assignments: {
          ...serverManifest.assignments,
          [assignment.sheetSlug]: nextAssignments[assignment.sheetSlug],
        },
      };
      setProjectState(mergedManifest);
      setCrossWireSettingsMessage(
        `Saved ${assignment.sheetName} visibility settings for cross wire.`,
      );

      const regenerateResponse = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/cross-wire-schema`,
        { method: "POST" },
      );
      if (regenerateResponse.ok) {
        const regeneratePayload = (await regenerateResponse.json().catch(
          () => ({}),
        )) as { schema?: CrossWireSchemaSummary };
        if (regeneratePayload.schema) {
          setCrossWireSchema(regeneratePayload.schema);
          setHasLoadedCrossWireSchema(true);
        } else {
          await refreshCrossWireSchema();
        }
      }

      await persistAssignmentVisibilitySettings();
      await fetchResolvedVisibilitySettings();
    } catch (error) {
      setCrossWireSettingsMessage(
        error instanceof Error
          ? error.message
          : "Failed to save cross wire settings.",
      );
    } finally {
      setSavingCrossWireSettingsBySheet((prev) => ({
        ...prev,
        [sheetSlug]: false,
      }));
    }
  }, [
    assignmentEntries,
    currentProject,
    fetchResolvedVisibilitySettings,
    persistAssignmentVisibilitySettings,
    refreshCrossWireSchema,
    schemaExternalLocations,
    crossWireSettingsMatrix,
  ]);

  const handleRegenerateCrossWireSchema = useCallback(async () => {
    if (!currentProject?.id) {
      return;
    }

    setRegeneratingCrossWireSchema(true);
    setCrossWireSettingsMessage(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(currentProject.id)}/cross-wire-schema`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        schema?: CrossWireSchemaSummary;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to regenerate cross wire schema.");
      }

      if (payload.schema) {
        setCrossWireSchema(payload.schema);
        setHasLoadedCrossWireSchema(true);
      } else {
        await refreshCrossWireSchema();
      }
      setCrossWireSettingsMessage("Cross wire schema regenerated.");
    } catch (error) {
      setCrossWireSettingsMessage(
        error instanceof Error
          ? error.message
          : "Failed to regenerate cross wire schema.",
      );
    } finally {
      setRegeneratingCrossWireSchema(false);
    }
  }, [currentProject?.id, refreshCrossWireSchema]);

  if (!currentProject) return null;

  const openLayoutWorkspace = () => {
    setLayoutWorkspaceOpen(true);
    setWireReviewOpen(false);
  };

  const openWireReview = () => {
    setWireReviewOpen(true);
  };

  const openBrandImportReview = () => {
    brandImportInputRef.current?.click();
  };

  const openPrintWorkspace = () => {
    onOpenChange(false);
    router.push(
      `/${badgeNumber}/projects/${encodeURIComponent(currentProject.id)}`,
    );
  };

  const handleDownloadAllWireLists = () => {
    if (!wireExports?.sheetExports?.length) return;
    for (const entry of wireExports.sheetExports) {
      const link = document.createElement("a");
      link.href = buildExportFileHref(currentProject.id, entry.relativePath);
      link.download = entry.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAllBrandLists = () => {
    const sheets = assignmentEntries.filter((a) => a.sheetSlug);
    if (!sheets.length) return;
    for (const assignment of sheets) {
      const link = document.createElement("a");
      link.href = `/api/projects/${encodeURIComponent(currentProject.id)}/brand-list-pdf/${encodeURIComponent(assignment.sheetSlug)}`;
      link.download = `${assignment.sheetSlug}-branding.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleUploadLegals = async () => {
    if (!currentProject.id) {
      return;
    }

    if (!workbookFile && !greenChangesFile && !layoutFile) {
      setLegalsMessage("Select a UCP wire list, green changes workbook, or layout PDF first.");
      return;
    }

    setUploadingLegals(true);
    setLegalsMessage(null);
    try {
      const formData = new FormData();
      formData.set("pdNumber", currentProject.pdNumber);
      const computedRevision = deriveRevisionLabelFromFiles([
        workbookFile,
        greenChangesFile,
        layoutFile,
      ]);
      const effectiveRevisionName = revisionNameDraft.trim() || computedRevision || currentProject.revision;
      if (effectiveRevisionName) {
        formData.set("revisionName", effectiveRevisionName);
      }
      if (workbookFile) formData.set("workbook", workbookFile);
      if (greenChangesFile) formData.set("greenChanges", greenChangesFile);
      if (layoutFile) formData.set("layout", layoutFile);

      const response = await fetch(
        `/api/projects/revisions/${encodeURIComponent(currentProject.id)}/files?async=1`,
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
      setRevisionNameTouched(false);
      setRevisionNameDraft("");
      if (workbookInputRef.current) workbookInputRef.current.value = "";
      if (greenChangesInputRef.current) greenChangesInputRef.current.value = "";
      if (layoutInputRef.current) layoutInputRef.current.value = "";
      if (payload.refreshJob) {
        setRefreshJob(payload.refreshJob);
        startRefreshJobPolling(currentProject.id);
      }
      setLegalsMessage(
        "Legal files uploaded. Regeneration is running in the background. You will be notified here when it finishes.",
      );
      await fetchResolvedVisibilitySettings();
      void refreshLegalDetail();
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
                  <span className="font-mono text-xs text-card-foreground">
                    {currentProject.pdNumber}
                  </span>
                  <span className="text-card-foreground/30">·</span>
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
                    className="h-8 px-3 text-card-foreground"
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
            className="flex min-h-0 flex-1 bg-background"
          >
            <TabsList className="h-full w-52 shrink-0 flex-col justify-start gap-1 rounded-none border-r bg-muted/30 p-3">
              {PROJECT_TAB_META.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDisabled = isEditing && !tab.editable;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={isDisabled}
                    className={cn(
                      "w-full justify-start gap-2 rounded-lg px-3 py-2 text-sm max-h-max font-medium",
                      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                      "text-card-foreground hover:bg-muted/50 hover:text-foreground",
                      isDisabled &&
                        "cursor-not-allowed opacity-45 hover:bg-muted/10 hover:text-card-foreground",
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

            <div className="min-h-0 flex-1 overflow-y-scroll">
              <TabsContent value="details" className="m-0 h-full">
                <ProjectTabContentShell meta={getTabMeta("details")}>

                {isEditing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1.5 md:col-span-2">
                      <Label
                        htmlFor="project-name"
                        className="text-xs font-medium text-card-foreground"
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
                        className="text-xs font-medium text-card-foreground"
                      >
                        Status
                      </Label>
                      <Select
                        value={currentProject.status || ""}
                        onValueChange={(value) =>
                          setProjectField("status", value as typeof PROJECT_STATUS_OPTIONS[number]["value"])
                        }
                      >
                        <SelectTrigger id="project-status" className="h-9 text-sm">
                          <SelectValue placeholder="Select status">
                            {(() => {
                              const opt = PROJECT_STATUS_OPTIONS.find((o) => o.value === currentProject.status);
                              return opt ? (
                                <span className="flex items-center gap-2">
                                  <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dot)} />
                                  {opt.label}
                                </span>
                              ) : "Select status";
                            })()}
                          </SelectValue>
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

                    <div className="grid gap-1.5 md:col-span-2">
                      <Label className="text-xs font-medium text-card-foreground">
                        Color
                      </Label>
                      <ColorPicker
                        value={currentProject.color || "#ffcc61"}
                        onValueChange={(value) => setProjectField("color", value)}
                      >
                        <ColorPickerTrigger asChild>
                          <button className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent">
                            <ColorPickerSwatch className="h-5 w-5 rounded-sm border border-border shrink-0" />
                            <span className="font-mono text-xs">{currentProject.color || "#ffcc61"}</span>
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
                      {(() => {
                        const opt = PROJECT_STATUS_OPTIONS.find((o) => o.value === currentProject.status);
                        return (
                          <span className="flex items-center gap-2">
                            {opt && <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dot)} />}
                            {opt ? opt.label : formatTokenLabel(currentProject.status || "unknown")}
                          </span>
                        );
                      })()}
                    </DetailRow>
                    <DetailRow icon={Palette} label="Color">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-sm border border-border shrink-0"
                          style={{ backgroundColor: currentProject.color || "#ffcc61" }}
                        />
                        <span className="font-mono text-xs text-card-foreground">
                          {currentProject.color || "#ffcc61"}
                        </span>
                      </span>
                    </DetailRow>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-card-foreground">
                        Workspace Actions
                      </div>
                      <div className="grid gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={openWireReview}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Open Multi-Sheet Workspace
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={openLayoutWorkspace}
                        >
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={handleDownloadAllBrandLists}
                          disabled={!assignmentEntries.length}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download All Brand List PDFs
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                </ProjectTabContentShell>
              </TabsContent>

              <TabsContent value="assignments" className="m-0 h-full">
                <ProjectTabContentShell meta={getTabMeta("assignments")} selectedAssignment={selectedAssignment}>

                {assignmentEntries.length > 0 ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex flex-1 items-center divide-x divide-border">
                      <div className="flex flex-col items-center gap-0.5 py-1 pr-4">
                        <span className="text-lg font-semibold text-foreground">{assignmentEntries.length}</span>
                        <span className="text-[11px] text-card-foreground">Total</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 py-1 px-4">
                        <span className="text-lg font-semibold text-foreground">
                          {assignmentEntries.filter((a) => a.status === "completed").length}
                        </span>
                        <span className="text-[11px] text-card-foreground">Completed</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs shrink-0">
                      <button
                        onClick={() => setAssignmentGroupMode("flat")}
                        className={cn(
                          "rounded-md px-2.5 py-1 font-medium transition-colors",
                          assignmentGroupMode === "flat"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-card-foreground hover:text-foreground",
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
                            : "text-card-foreground hover:text-foreground",
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
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 px-3 py-2" />
                          <TableHead className="py-2">Project</TableHead>
                          <TableHead className="py-2">Stage</TableHead>
                          <TableHead className="py-2">Status</TableHead>
                          {assignmentGroupMode === "flat" ? (
                            <TableHead className="py-2">Unit Type</TableHead>
                          ) : null}
                          <TableHead className="py-2" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignmentGroups
                          ? assignmentGroups.map(([unitType, groupAssignments]) => (
                              <React.Fragment key={unitType}>
                                <tr className="bg-muted/40 border-b border-border/60">
                                  <td colSpan={6} className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-card-foreground">
                                        {unitType}
                                      </span>
                                      <span className="text-[11px] text-card-foreground/50">
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
                                          <ChevronRight className={cn("h-3.5 w-3.5 text-card-foreground transition-transform duration-150", isExpanded && "rotate-90")} />
                                        </TableCell>
                                        <TableCell className="py-2.5">
                                          <div className="text-sm font-medium text-foreground">{assignment.normalizedTitle ?? assignment.sheetName}</div>
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
                                            {assignment.files.wireListPDFPath ? (
                                              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                                <a href={buildExportFileHref(currentProject.id, assignment.files.wireListPDFPath)} target="_blank" rel="noopener noreferrer">
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
                                              {assignment.blueLabels?.length ? (
                                                <AssignmentLabelDownloadButton
                                                  projectId={currentProject.id}
                                                  assignmentSlug={assignment.sheetSlug}
                                                  labelType="blue"
                                                  className="w-full justify-center"
                                                />
                                              ) : null}
                                              {assignment.whiteLabels?.length ? (
                                                <AssignmentLabelDownloadButton
                                                  projectId={currentProject.id}
                                                  assignmentSlug={assignment.sheetSlug}
                                                  labelType="white"
                                                  className="w-full justify-center"
                                                />
                                              ) : null}
                                              {assignment.partNumbers?.length ? (
                                                <AssignmentLabelDownloadButton
                                                  projectId={currentProject.id}
                                                  assignmentSlug={assignment.sheetSlug}
                                                  labelType="cable"
                                                  className="w-full justify-center"
                                                />
                                              ) : null}
                                              {!assignment.blueLabels?.length && !assignment.whiteLabels?.length && !assignment.partNumbers?.length ? (
                                                <span className="col-span-3 text-xs text-muted-foreground">No label data for this assignment</span>
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
                                      <ChevronRight className={cn("h-3.5 w-3.5 text-card-foreground transition-transform duration-150", isExpanded && "rotate-90")} />
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <div className="text-sm font-medium text-foreground">{assignment.normalizedTitle ?? assignment.sheetName}</div>
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
                                    <TableCell className="py-2.5 text-sm">{assignment.unitType || "—"}</TableCell>
                                    <TableCell className="py-2.5">
                                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        {assignment.files.wireListPDFPath ? (
                                          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                            <a href={buildExportFileHref(currentProject.id, assignment.files.wireListPDFPath)} target="_blank" rel="noopener noreferrer">
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
                                          {assignment.blueLabels?.length ? (
                                            <AssignmentLabelDownloadButton
                                              projectId={currentProject.id}
                                              assignmentSlug={assignment.sheetSlug}
                                              labelType="blue"
                                              className="w-full justify-center"
                                            />
                                          ) : null}
                                          {assignment.whiteLabels?.length ? (
                                            <AssignmentLabelDownloadButton
                                              projectId={currentProject.id}
                                              assignmentSlug={assignment.sheetSlug}
                                              labelType="white"
                                              className="w-full justify-center"
                                            />
                                          ) : null}
                                          {assignment.partNumbers?.length ? (
                                            <AssignmentLabelDownloadButton
                                              projectId={currentProject.id}
                                              assignmentSlug={assignment.sheetSlug}
                                              labelType="cable"
                                              className="w-full justify-center"
                                            />
                                          ) : null}
                                          {!assignment.blueLabels?.length && !assignment.whiteLabels?.length && !assignment.partNumbers?.length ? (
                                            <span className="col-span-3 text-xs text-muted-foreground">No label data for this assignment</span>
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

                </ProjectTabContentShell>
              </TabsContent>

              <TabsContent value="legals" className="m-0 h-full">
                <ProjectTabContentShell meta={getTabMeta("legals")}>

                {legalDetail ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-5">
                    <div className="flex flex-col gap-0.5 py-1">
                      <span className="text-[11px] text-card-foreground">Latest Revision</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {legalDetail.latestRevision ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-card-foreground">Workbook</span>
                      <span className="text-sm font-medium">
                        {legalDetail.hasWorkbook ? (
                          <span className="text-green-600">Present</span>
                        ) : (
                          <span className="text-card-foreground">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-card-foreground">Layout</span>
                      <span className="text-sm font-medium">
                        {legalDetail.hasLayout ? (
                          <span className="text-green-600">Present</span>
                        ) : (
                          <span className="text-card-foreground">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-card-foreground">Compare</span>
                      <span className="text-sm font-medium">
                        {legalDetail.hasGreenChangesWorkbook ? (
                          <span className="text-green-600">Present</span>
                        ) : (
                          <span className="text-card-foreground">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 sm:border-l sm:border-border sm:pl-3">
                      <span className="text-[11px] text-card-foreground">Revisions</span>
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
                    <span className="text-xs font-medium text-card-foreground">
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
                    <p className="truncate text-xs text-card-foreground">
                      {workbookFile?.name || latestLegalRevisionRecord?.workbookFileName || "No workbook selected"}
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-card-foreground">
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
                    <p className="truncate text-xs text-card-foreground">
                      {layoutFile?.name || latestLegalRevisionRecord?.layoutFileName || "No layout selected"}
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-card-foreground">
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
                    <p className="truncate text-xs text-card-foreground">
                      {greenChangesFile?.name || latestLegalRevisionRecord?.greenChangesWorkbookFileName || "No compare workbook selected"}
                    </p>
                  </div>

                  <label className="space-y-1.5 rounded-lg border border-border/70 bg-card/20 p-3">
                    <span className="text-xs font-medium text-card-foreground">
                      Revision Name
                    </span>
                    <Input
                      value={revisionNameDraft}
                      onChange={(event) => {
                        setRevisionNameTouched(true);
                        setRevisionNameDraft(event.target.value);
                      }}
                      placeholder="Auto-detected from selected files"
                      className="h-9"
                    />
                    <p className="text-xs text-card-foreground">
                      Computed: {deriveRevisionLabelFromFiles([workbookFile, greenChangesFile, layoutFile]) || legalDetail?.latestRevision || "Not detected"}
                    </p>
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
                      Upload Revision
                    </Button>
                    {legalsMessage ? (
                      <span className="text-xs text-card-foreground">
                        {legalsMessage}
                      </span>
                    ) : null}
                  </div>
                  {refreshJob ? (
                    <div className="sm:col-span-2 rounded-md border border-border/70 bg-card/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {refreshJob.status === "running" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        <span className="font-medium text-foreground">
                          Revision Refresh: {refreshJob.status === "running"
                            ? "In progress"
                            : refreshJob.status === "completed"
                              ? "Completed"
                              : "Failed"}
                        </span>
                      </div>
                      <div className="mt-1 text-card-foreground">
                        {refreshJob.error ?? refreshJob.message}
                      </div>
                    </div>
                  ) : null}
                  <p className="sm:col-span-2 text-xs text-card-foreground">
                    Upload the UCP wire list, optional compare workbook, and layout PDF to refresh the legal revision in the background.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-card-foreground">
                    Revisions
                  </div>
                  {loadingLegals ? (
                    <div className="flex items-center gap-2 text-sm text-card-foreground">
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
                        const isLatest = revision.revision === legalDetail.latestRevision;
                        const artifactValues = Object.values(revision.files);
                        const presentCount = artifactValues.filter(Boolean).length;
                        const allBuilt = presentCount === artifactValues.length;
                        return (
                          <div
                            key={revision.revision}
                            className={cn(
                              "rounded-xl border bg-background/40 overflow-hidden",
                              isLatest ? "border-primary/30" : "border-border",
                            )}
                          >
                            {/* Revision header */}
                            <div className={cn(
                              "flex items-center gap-2 px-4 py-2.5 border-b",
                              isLatest ? "bg-primary/5 border-primary/20" : "bg-card/20 border-border/60",
                            )}>
                              <span className="font-mono text-sm font-semibold text-foreground">
                                {revision.revision}
                              </span>
                              {isLatest ? (
                                <Badge className="h-5 border-primary/20 bg-primary/10 text-[10px] text-primary">
                                  Latest
                                </Badge>
                              ) : null}
                              <div className="ml-auto flex items-center gap-2">
                                {revision.generatedAt ? (
                                  <span className="text-[11px] text-card-foreground">
                                    Built {formatDateValue(revision.generatedAt)}
                                  </span>
                                ) : null}
                                <Badge
                                  variant={allBuilt ? "secondary" : "outline"}
                                  className={cn(
                                    "h-5 text-[10px]",
                                    allBuilt && "border-green-200 bg-green-50 text-green-700",
                                  )}
                                >
                                  {presentCount}/{artifactValues.length} files
                                </Badge>
                              </div>
                            </div>

                            {/* Paired file rows */}
                            <div className="divide-y divide-border/40">
                              {/* Workbook row */}
                              <div className="flex items-center gap-3 px-4 py-2.5">
                                <FileSpreadsheet className={cn(
                                  "h-4 w-4 shrink-0",
                                  revision.files.workbookPresent ? "text-green-600" : "text-card-foreground/40",
                                )} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-card-foreground">Workbook</div>
                                  {revision.workbookFileName ? (
                                    <div className="truncate font-mono text-[11px] text-foreground/70">
                                      {revision.workbookFileName}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-card-foreground/50">Not uploaded</div>
                                  )}
                                </div>
                                {revision.workbookUpdatedAt ? (
                                  <span className="shrink-0 text-[11px] text-card-foreground">
                                    {formatDateValue(revision.workbookUpdatedAt)}
                                  </span>
                                ) : null}
                                {revision.files.greenChangesWorkbookPresent ? (
                                  <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                                    + GC
                                  </Badge>
                                ) : null}
                              </div>

                              {/* Layout row */}
                              <div className="flex items-center gap-3 px-4 py-2.5">
                                <FileText className={cn(
                                  "h-4 w-4 shrink-0",
                                  revision.files.layoutPresent ? "text-blue-600" : "text-card-foreground/40",
                                )} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-card-foreground">Layout PDF</div>
                                  {revision.layoutFileName ? (
                                    <div className="truncate font-mono text-[11px] text-foreground/70">
                                      {revision.layoutFileName}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-card-foreground/50">Not uploaded</div>
                                  )}
                                </div>
                                {revision.layoutUpdatedAt ? (
                                  <span className="shrink-0 text-[11px] text-card-foreground">
                                    {formatDateValue(revision.layoutUpdatedAt)}
                                  </span>
                                ) : null}
                                {isLatest && revision.files.layoutPresent ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                                    onClick={openLayoutWorkspace}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Open
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
                </ProjectTabContentShell>
              </TabsContent>

              <TabsContent value="brand-lists" className="m-0 h-full">
                <ProjectTabContentShell meta={getTabMeta("brand-lists")}>

                {brandingExports && brandingExports.sheetExports.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex flex-col gap-0.5 py-1">
                      <span className="text-[11px] text-card-foreground">Assignments</span>
                      <span className="text-lg font-semibold text-foreground">
                        {brandingExports.sheetExports.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 border-x border-border px-3">
                      <span className="text-[11px] text-card-foreground">Combined</span>
                      <span className="text-sm font-medium">
                        {brandingExports.combinedRelativePath ? (
                          <span className="text-green-600">Ready</span>
                        ) : (
                          <span className="text-card-foreground">—</span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1 border-r border-border pr-3">
                      <span className="text-[11px] text-card-foreground">Generated</span>
                      <span className="text-xs text-foreground">
                        {formatDateValue(brandingExports.generatedAt)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 py-1">
                      <span className="text-[11px] text-card-foreground">Legal Revision</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {headerRevision}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={openBrandImportReview}
                      disabled={preparingBrandImport}
                    >
                      {preparingBrandImport ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Import &amp; Merge Brand List
                    </Button>
                    <input
                      ref={brandImportInputRef}
                      type="file"
                      accept=".xlsx,.xls,.xlsm,.xlsb"
                      className="hidden"
                      onClick={(event) => {
                        (event.currentTarget as HTMLInputElement).value = "";
                      }}
                      onChange={(event) => {
                        void handleBrandImportFileSelection(
                          event.target.files?.[0] ?? null,
                        );
                      }}
                    />
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
                    <div className="absolute inset-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-background/80 p-4 backdrop-blur-sm">
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
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-card-foreground" />
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
                    <div className="flex items-center gap-2 text-sm text-card-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading brand list exports…
                    </div>
                  ) : !brandingExports ||
                    brandingExports.sheetExports.length === 0 ? (
                    <EmptyStateCard
                      title="No brand lists exported yet."
                      description="Click Generate to produce brand list outputs for all sheets."
                    />
                  ) : (
                    <div className="space-y-2">
                      {brandingExports.combinedRelativePath ? (
                        <a
                          href={buildExportFileHref(
                            currentProject.id,
                            brandingExports.combinedRelativePath,
                          )}
                          download
                          className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm hover:bg-primary/10"
                        >
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {brandingExports.combinedFileName ||
                                "Combined Brand Workbook"}
                            </span>
                          </div>
                          <Download className="h-3.5 w-3.5 text-card-foreground" />
                        </a>
                      ) : null}
                      <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5 text-xs text-card-foreground">
                        Use each sheet card below to save visibility settings and download/regenerate that sheet brand list.
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Brand List Visibility</h3>
                      <p className="mt-0.5 text-xs text-card-foreground">
                        Configure visibility and regenerate/download each sheet brand list
                      </p>
                    </div>
                  </div>

                  {brandListSettingsMessage ? (
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        brandListSettingsMessage.includes("saved")
                          ? "bg-green-500/10 text-green-700"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {brandListSettingsMessage}
                    </div>
                  ) : null}

                  {assignmentEntries.length === 0 || !anyAssignmentHasLocations ? (
                    <EmptyStateCard
                      title="No external locations found."
                      description="Generate brand lists to populate external location settings."
                    />
                  ) : loadingSchemaLocations ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-card-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading locations…
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignmentEntries.map((assignment) => {
                        const exportEntry = brandingExports?.sheetExports.find(
                          (entry) => entry.sheetSlug === assignment.sheetSlug,
                        );
                        const locations = (schemaExternalLocations[assignment.sheetSlug] ?? [])
                          .map((loc) => ({
                            label: loc,
                            key: loc.trim().toUpperCase(),
                          }))
                          .filter((loc) => loc.key);
                        const visibleCount = locations.filter(
                          (loc) =>
                            brandListSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true,
                        ).length;
                        const isSavingSheet =
                          savingBrandListSettingsBySheet[assignment.sheetSlug] ?? false;
                        const isRegeneratingSheet =
                          regeneratingBrandBySheet[assignment.sheetSlug] ?? false;
                        const isBusySheet = isSavingSheet || isRegeneratingSheet;
                        const allVisible = visibleCount === locations.length;

                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="overflow-hidden rounded-lg border border-border/60 bg-card/30 transition-colors hover:border-border/80"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const current = expandedBrandAssignments.has(assignment.sheetSlug);
                                setExpandedBrandAssignments(
                                  current ? new Set() : new Set([assignment.sheetSlug]),
                                );
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  const current = expandedBrandAssignments.has(assignment.sheetSlug);
                                  setExpandedBrandAssignments(
                                    current ? new Set() : new Set([assignment.sheetSlug]),
                                  );
                                }
                              }}
                              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-card/40"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 shrink-0 text-card-foreground transition-transform",
                                    expandedBrandAssignments.has(assignment.sheetSlug) && "rotate-90",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-foreground">
                                    {assignment.sheetName}
                                  </div>
                                 
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Badge
                                  variant={allVisible ? "secondary" : "outline"}
                                  className="h-5 text-[10px]"
                                >
                                  {visibleCount}/{locations.length}
                                </Badge>
                                <a
                                  href={`/api/projects/${encodeURIComponent(currentProject.id)}/brand-list-pdf/${encodeURIComponent(assignment.sheetSlug)}`}
                                  download
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-card-foreground transition-colors hover:bg-background hover:text-foreground"
                                  title="Download sheet brand list PDF"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span className="text-[11px]">PDF</span>
                                </a>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 px-2 text-[11px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleSaveBrandListSettings(assignment.sheetSlug);
                                  }}
                                  disabled={isBusySheet || locations.length === 0}
                                >
                                  {isBusySheet ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Save + Generate
                                </Button>
                                <a
                                  href={`/print/project-context/${encodeURIComponent(currentProject.id)}/wire-list/${encodeURIComponent(assignment.sheetSlug)}?mode=branding`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded text-card-foreground transition-colors hover:bg-background hover:text-foreground"
                                  title="View/Print this sheet"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>

                            {expandedBrandAssignments.has(assignment.sheetSlug) && locations.length > 0 ? (
                              <div className="space-y-2 border-t border-border/40 bg-background/40 p-3">
                                {locations.map((loc) => (
                                  <div
                                    key={loc.key}
                                    className="group flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-card/40"
                                    onClick={() =>
                                      setBrandListLocationVisibility(
                                        assignment.sheetSlug,
                                        loc.key,
                                        !(brandListSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true),
                                      )
                                    }
                                  >
                                    <Switch
                                      checked={brandListSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true}
                                      onCheckedChange={(checked) =>
                                        setBrandListLocationVisibility(
                                          assignment.sheetSlug,
                                          loc.key,
                                          checked,
                                        )
                                      }
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      aria-label={`Toggle brand list visibility of ${loc.label}`}
                                    />
                                    <span className="font-mono text-sm text-foreground group-hover:text-foreground/80">
                                      {loc.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </ProjectTabContentShell>
              </TabsContent>

              <TabsContent value="wire-lists" className="m-0 h-full">
                <ProjectTabContentShell meta={getTabMeta("wire-lists")}>

                {wireExports && wireExports.sheetExports.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex flex-col gap-0.5 py-1">
                      <span className="text-[11px] text-card-foreground">Sheets</span>
                      <span className="text-lg font-semibold text-foreground">
                        {wireExports.sheetExports.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 border-l border-border py-1 pl-3">
                      <span className="text-[11px] text-card-foreground">Generated</span>
                      <span className="text-xs text-foreground">
                        {formatDateValue(wireExports.generatedAt)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 border-l border-border py-1 pl-3">
                      <span className="text-[11px] text-card-foreground">Legal Revision</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {headerRevision}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-end gap-3">
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
                    <div className="absolute inset-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-background/80 p-4 backdrop-blur-sm">
                      <div className="mb-1 text-sm font-semibold">
                        Generating wire lists…
                      </div>
                      {assignmentEntries.map((assignment) => {
                        const state =
                          wireGeneratingSheets[assignment.sheetSlug] ?? "generating";
                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="flex items-center gap-2 text-sm"
                          >
                            {state === "generating" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-card-foreground" />
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
                    <div className="flex items-center gap-2 text-sm text-card-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading wire list exports…
                    </div>
                  ) : !wireExports || wireExports.sheetExports.length === 0 ? (
                    <EmptyStateCard
                      title="No wire lists exported yet."
                      description="Click Generate to produce wire list PDFs for all sheets."
                      action={
                        <Button size="sm" onClick={openWireReview}>
                          Open Wire List Workspace
                        </Button>
                      }
                    />
                  ) : (
                    <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5 text-xs text-card-foreground">
                      Use each sheet card below to save visibility settings and download/regenerate that sheet PDF.
                    </div>
                  )}
                </div>
            
                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Wire List Visibility</h3>
                      <p className="mt-0.5 text-xs text-card-foreground">
                        Configure visibility and regenerate/download each sheet PDF
                      </p>
                    </div>
                  </div>

                  {wireListSettingsMessage ? (
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        wireListSettingsMessage.includes("saved")
                          ? "bg-green-500/10 text-green-700"
                          : "bg-blue-500/10 text-blue-700",
                      )}
                    >
                      {wireListSettingsMessage}
                    </div>
                  ) : null}

                  {assignmentEntries.length === 0 || !anyAssignmentHasLocations ? (
                    <EmptyStateCard
                      title="No external locations found."
                      description="Generate wire lists to populate external location settings."
                    />
                  ) : loadingSchemaLocations ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-card-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading locations…
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignmentEntries.map((assignment) => {
                        const exportEntry = wireExports?.sheetExports.find(
                          (entry) => entry.sheetSlug === assignment.sheetSlug,
                        );
                        const locations = (schemaExternalLocations[assignment.sheetSlug] ?? [])
                          .map((loc) => ({
                            label: loc,
                            key: loc.trim().toUpperCase(),
                          }))
                          .filter((loc) => loc.key);
                        const visibleCount = locations.filter(
                          (loc) =>
                            wireListSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true,
                        ).length;
                        const isSavingSheet =
                          savingWireListSettingsBySheet[assignment.sheetSlug] ?? false;
                        const isRegeneratingSheet =
                          regeneratingWireBySheet[assignment.sheetSlug] ?? false;
                        const isBusySheet = isSavingSheet || isRegeneratingSheet;
                        const allVisible = visibleCount === locations.length;

                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="overflow-hidden rounded-lg border border-border/60 bg-card/30 transition-colors hover:border-border/80"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const current = expandedAssignments.has(assignment.sheetSlug);
                                setExpandedAssignments(
                                  current ? new Set() : new Set([assignment.sheetSlug]),
                                );
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  const current = expandedAssignments.has(assignment.sheetSlug);
                                  setExpandedAssignments(
                                    current ? new Set() : new Set([assignment.sheetSlug]),
                                  );
                                }
                              }}
                              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-card/40"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 shrink-0 text-card-foreground transition-transform",
                                    expandedAssignments.has(assignment.sheetSlug) && "rotate-90",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-foreground">
                                    {assignment.sheetName}
                                  </div>
                                 
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Badge
                                  variant={allVisible ? "secondary" : "outline"}
                                  className="h-5 text-[10px]"
                                >
                                  {visibleCount}/{locations.length}
                                </Badge>
                                {exportEntry ? (
                                  <a
                                    href={buildExportFileHref(
                                      currentProject.id,
                                      exportEntry.relativePath,
                                    )}
                                    download
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex h-7 items-center gap-1 rounded px-2 text-card-foreground transition-colors hover:bg-background hover:text-foreground"
                                    title="Download sheet PDF"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    <span className="text-[11px]">PDF</span>
                                  </a>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 px-2 text-[11px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleSaveWireListSettings(assignment.sheetSlug);
                                  }}
                                  disabled={isBusySheet || locations.length === 0}
                                >
                                  {isBusySheet ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Save + Generate
                                </Button>
                                <a
                                  href={buildWireListPrintHref(currentProject.id, assignment.sheetSlug, true)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded text-card-foreground transition-colors hover:bg-background hover:text-foreground"
                                  title="View/Print this sheet"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>

                            {expandedAssignments.has(assignment.sheetSlug) && locations.length > 0 ? (
                              <div className="space-y-2 border-t border-border/40 bg-background/40 p-3">
                                {locations.map((loc) => (
                                  <div
                                    key={loc.key}
                                    className="group flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-card/40"
                                    onClick={() =>
                                      setWireListLocationVisibility(
                                        assignment.sheetSlug,
                                        loc.key,
                                        !(wireListSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true),
                                      )
                                    }
                                  >
                                    <Switch
                                      checked={wireListSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true}
                                      onCheckedChange={(checked) =>
                                        setWireListLocationVisibility(
                                          assignment.sheetSlug,
                                          loc.key,
                                          checked,
                                        )
                                      }
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      aria-label={`Toggle visibility of ${loc.label}`}
                                    />
                                    <span className="font-mono text-sm text-foreground group-hover:text-foreground/80">
                                      {loc.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </ProjectTabContentShell>
              </TabsContent>

              <TabsContent value="cross-wire" className="m-0 h-full">
                <ProjectTabContentShell meta={getTabMeta("cross-wire")}>
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex flex-col gap-0.5 py-1">
                      <span className="text-[11px] text-card-foreground">Assignments</span>
                      <span className="text-lg font-semibold text-foreground">
                        {crossWireStats.assignmentsWithExternal}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 border-l border-border py-1 pl-3">
                      <span className="text-[11px] text-card-foreground">Legal Revision</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {headerRevision}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 border-l  border-border py-1 pl-3">
                      <span className="text-[11px] text-card-foreground">Generated</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatDateValue(crossWireSchema?.generatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Cross Wire Actions</div>
                      <p className="text-xs text-card-foreground">
                        Regenerate schema, download PDF, or open external cross wire view.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => void handleRegenerateCrossWireSchema()}
                        disabled={regeneratingCrossWireSchema}
                      >
                        {regeneratingCrossWireSchema ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <GitBranch className="h-3.5 w-3.5" />
                        )}
                        Generate
                      </Button>
                      <a
                        href={`/api/projects/${encodeURIComponent(currentProject.id)}/cross-wire-pdf`}
                        download
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                      <a
                        href={`/print/project-context/${encodeURIComponent(currentProject.id)}/cross-wire`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open External URL
                      </a>
                    </div>
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
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-card-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading cross wire settings…
                    </div>
                  ) : assignmentEntries.length === 0 || !anyAssignmentHasLocations ? (
                    <EmptyStateCard
                      title="No external locations found."
                      description="Generate wire list schemas to populate cross wire visibility settings."
                    />
                  ) : (
                    <div className="space-y-2">
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
                          (loc) =>
                            crossWireSettingsMatrix[assignment.sheetSlug]?.[loc.key] ?? true,
                        ).length;
                        const isSavingSheet =
                          savingCrossWireSettingsBySheet[assignment.sheetSlug] ?? false;
                        const allVisible = visibleCount === locations.length;

                        return (
                          <div
                            key={assignment.sheetSlug}
                            className="overflow-hidden rounded-lg border border-border/60 bg-card/30 transition-colors hover:border-border/80"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const current = expandedCrossAssignments.has(
                                  assignment.sheetSlug,
                                );
                                setExpandedCrossAssignments(
                                  current ? new Set() : new Set([assignment.sheetSlug]),
                                );
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  const current = expandedCrossAssignments.has(
                                    assignment.sheetSlug,
                                  );
                                  setExpandedCrossAssignments(
                                    current ? new Set() : new Set([assignment.sheetSlug]),
                                  );
                                }
                              }}
                              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-card/40"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 shrink-0 text-card-foreground transition-transform",
                                    expandedCrossAssignments.has(assignment.sheetSlug) &&
                                      "rotate-90",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-foreground">
                                    {assignment.sheetName}
                                  </div>
                                 
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Badge
                                  variant={allVisible ? "secondary" : "outline"}
                                  className="h-5 text-[10px]"
                                >
                                  {visibleCount}/{locations.length}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 px-2 text-[11px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleSaveCrossWireSettings(assignment.sheetSlug);
                                  }}
                                  disabled={isSavingSheet}
                                >
                                  {isSavingSheet ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Save + Generate
                                </Button>
                              </div>
                            </div>

                            {expandedCrossAssignments.has(assignment.sheetSlug) ? (
                              <div className="space-y-2 border-t border-border/40 bg-background/40 p-3">
                                {locations.map((loc) => (
                                  <div
                                    key={loc.key}
                                    className="group flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-card/40"
                                    onClick={() =>
                                      setCrossWireLocationVisibility(
                                        assignment.sheetSlug,
                                        loc.key,
                                        !(
                                          crossWireSettingsMatrix[assignment.sheetSlug]?.[
                                            loc.key
                                          ] ?? true
                                        ),
                                      )
                                    }
                                  >
                                    <Switch
                                      checked={
                                        crossWireSettingsMatrix[assignment.sheetSlug]?.[
                                          loc.key
                                        ] ?? true
                                      }
                                      onCheckedChange={(checked) =>
                                        setCrossWireLocationVisibility(
                                          assignment.sheetSlug,
                                          loc.key,
                                          checked,
                                        )
                                      }
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      aria-label={`Toggle cross wire visibility of ${loc.label}`}
                                    />
                                    <span className="font-mono text-sm text-foreground group-hover:text-foreground/80">
                                      {loc.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ProjectTabContentShell>
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

      <MultiWireListPrintWorkspaceDialog
        projectId={currentProject.id}
        projectName={currentProject.name}
        projectColor={currentProject.color}
        sheets={operationalSheets.map((s) => ({ slug: s.slug, name: s.name, rowCount: s.rowCount }))}
        open={wireReviewOpen}
        onOpenChange={(nextOpen) => {
          setWireReviewOpen(nextOpen);
          if (!nextOpen) {
            void refreshWireExports();
          }
        }}
      />

      <LayoutPdfWorkspaceDialog
        open={layoutWorkspaceOpen}
        onOpenChange={setLayoutWorkspaceOpen}
        endpoint={`/api/projects/${encodeURIComponent(currentProject.id)}/layout-pdf`}
        quickBackLabel="Back to Project Collection"
        onQuickBack={() => setLayoutWorkspaceOpen(false)}
      />
    </> 
  );
}
