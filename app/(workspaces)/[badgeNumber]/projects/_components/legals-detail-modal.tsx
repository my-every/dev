"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  FolderOpen,
  GitBranch,
  Layers,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  ShieldCheck,
  TriangleAlert,
  FileText,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import type {
  CreateProjectFromLegalSourceInput,
  LegalProjectRecord,
  LegalRevisionRecord,
} from "@/types/legal-drawings";
import type { DueProjectNavItem } from "./projects-side-panel-nav";
import {
  ProjectConfigCollapsible,
  DEFAULT_PROJECT_CONFIG,
  type ProjectConfig,
  type ProjectInstanceItem,
} from "./project-config-collapsible";
import { ProjectIcon } from "./project-icon";

// ============================================================================
// Types
// ============================================================================

export interface LegalsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: DueProjectNavItem | null;
}

type SectionId = "overview" | "schedule" | "revisions" | "units";

interface Section {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface FormValues {
  projectName: string;
  lwcType: string;
  dueDate: string;
  planConlayDate: string;
  planConassyDate: string;
  shipDate: string;
  deptTargetDate: string;
}

type CreatedInstance = {
  name: string;
  unitNumber?: string | null;
  revision: string;
  lwcType?: string | null;
  color: string;
  dueDate?: string | null;
  planConlayDate?: string | null;
  planConassyDate?: string | null;
  createMode: "project" | "unit";
  createdAt: Date;
};

const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", icon: FolderOpen },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "revisions", label: "Revisions", icon: GitBranch },
  { id: "units", label: "Units", icon: PackagePlus },
];

function recordToFormValues(record: LegalProjectRecord | null, project: DueProjectNavItem): FormValues {
  return {
    projectName: record?.projectName || project.name || "",
    lwcType: record?.lwcType || project.lwcType || "",
    dueDate: record?.dueDate || project.dueDate || "",
    planConlayDate: record?.planConlayDate || "",
    planConassyDate: record?.planConassyDate || "",
    shipDate: record?.shipDate || "",
    deptTargetDate: record?.deptTargetDate || "",
  };
}

// ============================================================================
// Component
// ============================================================================

export function LegalsDetailModal({
  open,
  onOpenChange,
  project,
}: LegalsDetailModalProps) {
  const { user } = useSession();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [detail, setDetail] = useState<LegalProjectRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    overview: null,
    schedule: null,
    revisions: null,
    units: null,
  });

  // Units tab state
  const [unitsConfig, setUnitsConfig] = useState<ProjectConfig>(DEFAULT_PROJECT_CONFIG);
  const [isCreatingUnit, setIsCreatingUnit] = useState(false);
  const [unitCreateError, setUnitCreateError] = useState<string | null>(null);
  const [unitCreateSuccess, setUnitCreateSuccess] = useState(false);
  const [createdInstances, setCreatedInstances] = useState<CreatedInstance[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch full detail when modal opens
  useEffect(() => {
    if (!open || !project?.pdNumber) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Pre-fill units config from the current project, defaulting to project creation mode
    setUnitsConfig({
      ...DEFAULT_PROJECT_CONFIG,
      projectName: project.name || "",
      selectedRevision: project.revision || "",
      lwcType: (project.lwcType as ProjectConfig["lwcType"]) || "",
      color: project.color || "#ffcc61",
      dueDate: project.dueDate || "",
      createMode: "project",
    });
    setUnitCreateError(null);
    setUnitCreateSuccess(false);
    setCreatedInstances([]);

    fetch(`/api/legal-drawings/${encodeURIComponent(project.pdNumber)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not found"))))
      .then((data: LegalProjectRecord) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load legal drawings detail.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, project?.pdNumber]);

  // Scrollspy
  useEffect(() => {
    if (!open) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let current: SectionId = "overview";
      for (const section of SECTIONS) {
        const el = sectionRefs.current[section.id];
        if (el) {
          const elTop = el.getBoundingClientRect().top - containerTop;
          if (elTop <= 100) current = section.id;
        }
      }
      setActiveSection(current);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [open, detail]);

  const scrollToSection = useCallback((sectionId: SectionId) => {
    const el = sectionRefs.current[sectionId];
    const container = scrollContainerRef.current;
    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollTo({
        top: container.scrollTop + elTop - containerTop - 20,
        behavior: "smooth",
      });
    }
  }, []);

  const startEditing = useCallback(() => {
    if (!project) return;
    setFormValues(recordToFormValues(detail, project));
    setSaveError(null);
    setIsEditing(true);
  }, [detail, project]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setFormValues(null);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!project || !formValues) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/legal-drawings/${encodeURIComponent(project.pdNumber)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save");
      }
      const updated: LegalProjectRecord = await res.json();
      setDetail(updated);
      setIsEditing(false);
      setFormValues(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [project, formValues]);

  const setField = useCallback(<K extends keyof FormValues>(key: K, value: string) => {
    setFormValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setActiveSection("overview");
        setDetail(null);
        setError(null);
        setIsEditing(false);
        setFormValues(null);
        setSaveError(null);
        setUnitsConfig(DEFAULT_PROJECT_CONFIG);
        setUnitCreateError(null);
        setUnitCreateSuccess(false);
        setCreatedInstances([]);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  if (!project) return null;

  const record = detail;

  const projectInstanceItem: ProjectInstanceItem = {
    id: project.pdNumber,
    pdNumber: project.pdNumber,
    name: record?.projectName || project.name,
    revision: record?.latestRevision || project.revision,
    color: project.color,
    lwcType: record?.lwcType || project.lwcType,
    revisions: record?.revisions ?? [],
  };

  const handleCreateUnit = async () => {
    if (!project) return;
    setIsCreatingUnit(true);
    setUnitCreateError(null);
    setUnitCreateSuccess(false);
    try {
      const body: CreateProjectFromLegalSourceInput = {
        pdNumber: project.pdNumber,
        revision: unitsConfig.selectedRevision,
        name: unitsConfig.projectName,
        unitNumber: unitsConfig.unitNumber || null,
        lwcType: unitsConfig.lwcType || null,
        dueDate: unitsConfig.dueDate || null,
        planConlayDate: unitsConfig.planConlayDate || null,
        planConassyDate: unitsConfig.planConassyDate || null,
        color: unitsConfig.color || null,
        actorBadge: user?.badge || null,
        actorShift: user?.currentShift || null,
      };
      const res = await fetch("/api/legal-drawings/instantiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create instance");
      }
      setUnitCreateSuccess(true);
      setCreatedInstances((prev) => [
        ...prev,
        {
          name: unitsConfig.projectName,
          unitNumber: unitsConfig.unitNumber || null,
          revision: unitsConfig.selectedRevision,
          lwcType: unitsConfig.lwcType || null,
          color: unitsConfig.color,
          dueDate: unitsConfig.dueDate || null,
          planConlayDate: unitsConfig.planConlayDate || null,
          planConassyDate: unitsConfig.planConassyDate || null,
          createMode: unitsConfig.createMode ?? "project",
          createdAt: new Date(),
        },
      ]);
      // Reset form for next creation, keeping revision/lwcType/color
      setUnitsConfig((prev) => ({
        ...DEFAULT_PROJECT_CONFIG,
        selectedRevision: prev.selectedRevision,
        lwcType: prev.lwcType,
        color: prev.color,
        createMode: "project",
      }));
    } catch (err) {
      setUnitCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsCreatingUnit(false);
    }
  };


  const displayName =
    (isEditing ? formValues?.projectName : null) ||
    record?.projectName ||
    project.name ||
    project.pdNumber;
  const lwcLabel = (isEditing ? formValues?.lwcType : null) || record?.lwcType || project.lwcType;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-215! w-full max-h-[85vh] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-215!">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b shrink-0">
          <ProjectIcon
            name={displayName}
            color={project.color ?? record?.color ?? undefined}
            interactive={false}
            className="h-12 w-14 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold truncate">
              {displayName}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{project.pdNumber}</span>
              {lwcLabel && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <Badge variant="secondary" className="text-[10px] h-5">{lwcLabel}</Badge>
                </>
              )}
              {project.revision && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <Badge variant="outline" className="text-[10px] h-5 font-mono">Rev {project.revision}</Badge>
                </>
              )}
              {project.daysLate != null && project.daysLate > 0 && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <Badge variant="destructive" className="text-[10px] h-5">
                    {project.daysLate}d late
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Edit toggle */}
          {!loading && !error && (
            <div className="shrink-0">
              {isEditing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEditing}
                  className="h-8 px-3 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startEditing}
                  className="h-8 px-3"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Scrollspy nav */}
          <nav className="w-44 shrink-0 border-r bg-muted/30 p-3 space-y-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{section.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* Main content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto"
          >
            <div className="p-6 space-y-8">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <TriangleAlert className="h-8 w-8 text-destructive/60" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : (
                <>
                  {/* Overview */}
                  <section
                    ref={(el) => { sectionRefs.current.overview = el; }}
                    id="section-overview"
                  >
                    <SectionHeader
                      icon={FolderOpen}
                      title="Overview"
                      description="Legal drawings folder and artifact status"
                    />
                    <div className="mt-4 space-y-3">
                      <DetailRow label="PD Number" icon={Package}>
                        <span className="font-mono text-sm">{project.pdNumber}</span>
                      </DetailRow>
                      <DetailRow label="Project Name" icon={FileText}>
                        {isEditing && formValues ? (
                          <Input
                            value={formValues.projectName}
                            onChange={(e) => setField("projectName", e.target.value)}
                            placeholder="Project name"
                            className="h-8 text-sm"
                          />
                        ) : (
                          <DisplayValue value={record?.projectName || project.name} />
                        )}
                      </DetailRow>
                      <DetailRow label="LWC Type" icon={Layers}>
                        {isEditing && formValues ? (
                          <Input
                            value={formValues.lwcType}
                            onChange={(e) => setField("lwcType", e.target.value)}
                            placeholder="e.g. Offskid"
                            className="h-8 text-sm"
                          />
                        ) : (
                          <DisplayValue value={lwcLabel} />
                        )}
                      </DetailRow>
                      <DetailRow label="Latest Revision" icon={GitBranch}>
                        <DisplayValue value={record?.latestRevision || project.revision} />
                      </DetailRow>
                      <DetailRow label="Workbook" icon={ShieldCheck}>
                        <ArtifactPill present={record?.hasWorkbook ?? false} label="Workbook" />
                      </DetailRow>
                      <DetailRow label="Layout" icon={ShieldCheck}>
                        <ArtifactPill present={record?.hasLayout ?? false} label="Layout" />
                      </DetailRow>
                      {record?.latestWorkbookUpdatedAt && (
                        <DetailRow label="Workbook Updated" icon={Clock}>
                          <DisplayValue value={new Date(record.latestWorkbookUpdatedAt).toLocaleString()} />
                        </DetailRow>
                      )}
                      {record?.latestLayoutUpdatedAt && (
                        <DetailRow label="Layout Updated" icon={Clock}>
                          <DisplayValue value={new Date(record.latestLayoutUpdatedAt).toLocaleString()} />
                        </DetailRow>
                      )}
                    </div>
                  </section>

                  {/* Schedule */}
                  <section
                    ref={(el) => { sectionRefs.current.schedule = el; }}
                    id="section-schedule"
                  >
                    <SectionHeader
                      icon={Calendar}
                      title="Schedule"
                      description="Instances created from this legal drawing"
                    />
                    <div className="mt-4 space-y-3">
                      {/* Compact date summary */}
                      {(record?.dueDate || project.dueDate || record?.planConlayDate || record?.planConassyDate || record?.shipDate) && (
                        <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                          {(record?.dueDate || project.dueDate) && (
                            <DateChip label="Due" value={record?.dueDate || project.dueDate} highlight={!!record?.daysLate && record.daysLate > 0} />
                          )}
                          {record?.planConlayDate && (
                            <DateChip label="Conlay" value={record.planConlayDate} />
                          )}
                          {record?.planConassyDate && (
                            <DateChip label="Conassy" value={record.planConassyDate} />
                          )}
                          {record?.shipDate && (
                            <DateChip label="Ship" value={record.shipDate} />
                          )}
                          {record?.daysLate != null && record.daysLate > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              <TriangleAlert className="h-3 w-3" />
                              {record.daysLate}d late
                            </span>
                          )}
                        </div>
                      )}

                      {/* Instances list */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Project Instances
                          </span>
                          {createdInstances.length > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                              {createdInstances.length}
                            </span>
                          )}
                        </div>
                        {createdInstances.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                            <PackagePlus className="h-6 w-6 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No instances created yet.</p>
                            <p className="text-xs text-muted-foreground/60">
                              Create a project or unit from the Units section below.
                            </p>
                          </div>
                        ) : (
                          createdInstances.map((inst, i) => (
                            <InstanceCard key={i} instance={inst} />
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Revisions */}
                  <section
                    ref={(el) => { sectionRefs.current.revisions = el; }}
                    id="section-revisions"
                  >
                    <SectionHeader
                      icon={GitBranch}
                      title="Revisions"
                      description="All discovered revisions and their generated artifact status"
                    />
                    <div className="mt-4 space-y-3">
                      {!record?.revisions?.length ? (
                        <p className="text-sm text-muted-foreground italic">No revisions found.</p>
                      ) : (
                        [...record.revisions]
                          .sort((a, b) => b.revision.localeCompare(a.revision))
                          .map((rev) => (
                            <RevisionRow
                              key={rev.revision}
                              revision={rev}
                              isLatest={rev.revision === record.latestRevision}
                            />
                          ))
                      )}
                    </div>
                  </section>

                  {/* Spacer so Revisions section can scroll to top */}

                  {/* Units */}
                  <section
                    ref={(el) => { sectionRefs.current.units = el; }}
                    id="section-units"
                  >
                    <SectionHeader
                      icon={PackagePlus}
                      title="Units"
                      description="Create a project or unit instance from this legal drawing"
                    />
                    <div className="mt-4 space-y-3">
                      {unitCreateSuccess && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                          <Check className="h-4 w-4 shrink-0" />
                          <span>Instance created — visible in the <button type="button" onClick={() => scrollToSection("schedule")} className="underline underline-offset-2 hover:no-underline">Schedule</button> tab.</span>
                        </div>
                      )}
                      {unitCreateError && (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                          <TriangleAlert className="h-4 w-4 shrink-0" />
                          {unitCreateError}
                        </div>
                      )}
                      <ProjectConfigCollapsible
                        project={projectInstanceItem}
                        config={unitsConfig}
                        onUpdateConfig={(updates) =>
                          setUnitsConfig((prev) => ({ ...prev, ...updates }))
                        }
                        onCreate={handleCreateUnit}
                        isCreating={isCreatingUnit}
                        showRemove={false}
                      />

                      {/* Worklog widget temporarily hidden */}
                    </div>
                  </section>

                  {/* Spacer so Units section can scroll to top */}
                  <div className="h-48 shrink-0" aria-hidden />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Save footer — visible only when editing */}
        {isEditing && (
          <div className="shrink-0 border-t bg-background px-6 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              {saveError && (
                <p className="text-sm text-destructive truncate">{saveError}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

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
    <div className="flex items-start gap-3 pb-3 border-b">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
      <div className="flex items-center gap-2 py-1.5">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="min-w-0 py-1">{children}</div>
    </div>
  );
}

function DisplayValue({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-sm text-muted-foreground/50 italic">Not set</span>;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

function DateValue({
  value,
  highlight,
}: {
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value) return <span className="text-sm text-muted-foreground/50 italic">Not set</span>;
  const formatted = new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <span className={cn("text-sm", highlight ? "text-foreground font-medium" : "text-foreground")}>
      {formatted}
    </span>
  );
}

function ArtifactPill({ present, label }: { present: boolean; label: string }) {
  return (
    <Badge
      variant={present ? "secondary" : "outline"}
      className={cn(
        "text-[10px] h-5",
        present
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          : "text-muted-foreground",
      )}
    >
      {present ? `${label} present` : `No ${label.toLowerCase()}`}
    </Badge>
  );
}

function DateChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value) return null;
  const formatted = new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
      highlight
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground",
    )}>
      <Calendar className="h-3 w-3 shrink-0" />
      <span className="text-muted-foreground/70">{label}:</span>
      {formatted}
    </span>
  );
}

function InstanceCard({ instance }: { instance: CreatedInstance }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2.5">
      <ProjectIcon
        name={instance.name}
        color={instance.color}
        interactive={false}
        className="h-9 w-11 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {instance.name}
            {instance.unitNumber && (
              <span className="text-muted-foreground"> · Unit {instance.unitNumber}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
            {instance.revision}
          </Badge>
          {instance.lwcType && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1">
              {instance.lwcType}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] h-4 px-1",
              instance.createMode === "unit"
                ? "text-violet-600 border-violet-500/30 bg-violet-500/8"
                : "text-blue-600 border-blue-500/30 bg-blue-500/8",
            )}
          >
            {instance.createMode === "unit" ? "Unit" : "Project"}
          </Badge>
          {instance.dueDate && (
            <span className="text-[10px] text-muted-foreground">
              Due {new Date(instance.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums">
        {instance.createdAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

function RevisionRow({
  revision,
  isLatest,
}: {
  revision: LegalRevisionRecord;
  isLatest: boolean;
}) {
  const artifacts = revision.artifacts;
  const artifactEntries: Array<{ key: keyof typeof artifacts; label: string }> = [
    { key: "workbookPresent", label: "Workbook" },
    { key: "layoutPresent", label: "Layout" },
    { key: "manifestBuilt", label: "Manifest" },
    { key: "sheetSchemasBuilt", label: "Sheets" },
    { key: "wireListPrintSchemaPrepared", label: "Wire List" },
    { key: "brandListSchemaPrepared", label: "Brand List" },
    { key: "greenChangesWorkbookPresent", label: "Green Changes" },
    { key: "layoutPagesBuilt", label: "Layout Pages" },
    { key: "devicePartNumbersBuilt", label: "Part Numbers" },
  ];

  const presentCount = artifactEntries.filter((e) => artifacts[e.key]).length;

  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-mono text-sm font-semibold text-foreground">{revision.revision}</span>
        {isLatest && (
          <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
            Latest
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {presentCount}/{artifactEntries.length} artifacts
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {artifactEntries.map(({ key, label }) => (
          <span
            key={key}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
              artifacts[key]
                ? "bg-emerald-500/8 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                : "bg-muted text-muted-foreground/60 border-border",
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {revision.workbookFileName && (
        <p className="mt-2 text-[11px] text-muted-foreground truncate">
          {revision.workbookFileName}
        </p>
      )}
    </div>
  );
}

