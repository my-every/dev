"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  FolderPlus,
  Layout,
  PackagePlus,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LwcTypeField, RevisionField } from "@/components/projects/fields";
import { SubmissionLoader } from "@/components/loaders/submission-loader";
import { LWC_TYPE_REGISTRY, type LwcType } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";

import { ProjectIcon } from "../../projects/_components/project-icon";
import {
  ProjectConfigCollapsible,
  type ProjectConfig,
} from "./project-config-collapsible";
import type { ScheduleProjectItem } from "./schedule-types";

type ViewMode = "skeleton" | "default" | "dynamic";

type ScheduleContentProps = {
  badgeNumber: string;
  projects: ScheduleProjectItem[];
  selectedProject: ScheduleProjectItem | null;
  onSelectProject: (project: ScheduleProjectItem) => void;
  onProjectCreated: (projectId: string) => void;
  mode: ViewMode;
};

export function ScheduleContent({
  badgeNumber,
  projects,
  selectedProject,
  onSelectProject,
  onProjectCreated,
  mode,
}: ScheduleContentProps) {
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Per-project configuration
  const [projectConfigs, setProjectConfigs] = useState<Map<string, ProjectConfig>>(new Map());
  
  // Creation state
  const [creatingId, setCreatingId] = useState<string | null>(null);
  
  // Filter state for legal packages
  const [searchQuery, setSearchQuery] = useState("");
  const [lwcFilter, setLwcFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Full-screen loader state for batch operations
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("Processing...");

  // Filter available legal projects
  const availableLegalProjects = useMemo(() => {
    return projects.filter((p) => {
      if (p.hasProjectInstance) return false;
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = [
          p.name,
          p.pdNumber,
          p.revision,
          p.lwcType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
        if (!matchesSearch) return false;
      }
      
      // LWC type filter
      if (lwcFilter !== "all") {
        const projectLwc = String(p.lwcType || "").toUpperCase();
        if (projectLwc !== lwcFilter) return false;
      }
      
      return true;
    });
  }, [projects, searchQuery, lwcFilter]);
  
  // Total available (unfiltered) for count display
  const totalAvailable = projects.filter((p) => !p.hasProjectInstance).length;

  // Calculate instantiated projects this month
  const instantiatedProjects = projects.filter((p) => p.hasProjectInstance);
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const instantiatedThisMonth = instantiatedProjects.filter((p) => {
    if (!p.createdAt) return false;
    return p.createdAt.slice(0, 7) === currentMonth;
  }).length;

  // Clear filters - must be before any early returns
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setLwcFilter("all");
  }, []);

  const hasActiveFilters = searchQuery.trim() || lwcFilter !== "all";

  const toggleSelection = useCallback((project: ScheduleProjectItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(project.id)) {
        next.delete(project.id);
        // Also remove config
        setProjectConfigs((configs) => {
          const newConfigs = new Map(configs);
          newConfigs.delete(project.id);
          return newConfigs;
        });
      } else {
        next.add(project.id);
        // Initialize config for this project
        setProjectConfigs((configs) => {
          const newConfigs = new Map(configs);
          newConfigs.set(project.id, {
            projectName: project.name,
            unitNumber: "",
            lwcType: "",
            selectedRevision: getPreferredRevision(project),
            color: project.color || "#ffcc61",
            createMode: null,
            isOpen: true,
            dueDate: project.dueDate?.split("T")[0] || "",
            planConlayDate: project.planConlayDate?.split("T")[0] || "",
            planConassyDate: project.planConassyDate?.split("T")[0] || "",
          });
          return newConfigs;
        });
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = new Set(availableLegalProjects.map((p) => p.id));
    setSelectedIds(allIds);
    
    // Initialize configs for all
    const newConfigs = new Map<string, ProjectConfig>();
    availableLegalProjects.forEach((project) => {
      newConfigs.set(project.id, {
        projectName: project.name,
        unitNumber: "",
        lwcType: "",
        selectedRevision: getPreferredRevision(project),
        color: project.color || "#ffcc61",
        createMode: null,
        isOpen: false,
        dueDate: project.dueDate?.split("T")[0] || "",
        planConlayDate: project.planConlayDate?.split("T")[0] || "",
        planConassyDate: project.planConassyDate?.split("T")[0] || "",
      });
    });
    setProjectConfigs(newConfigs);
  }, [availableLegalProjects]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setProjectConfigs(new Map());
  }, []);

  const updateConfig = useCallback((projectId: string, updates: Partial<ProjectConfig>) => {
    setProjectConfigs((configs) => {
      const newConfigs = new Map(configs);
      const current = newConfigs.get(projectId);
      if (current) {
        newConfigs.set(projectId, { ...current, ...updates });
      }
      return newConfigs;
    });
  }, []);

  const handleCreateProject = useCallback(async (project: ScheduleProjectItem) => {
    const config = projectConfigs.get(project.id);
    if (!config || !config.projectName.trim()) return;
    if (config.createMode === "unit" && !config.unitNumber.trim()) return;

    // Show full-screen loader and individual creating state
    setCreatingId(project.id);
    setIsSubmitting(true);
    setSubmissionMessage(`Creating ${config.projectName.trim()}...`);

    try {
      const response = await fetch("/api/legal-drawings/instantiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdNumber: project.pdNumber,
          revision: config.selectedRevision || getPreferredRevision(project),
          name: config.projectName.trim(),
          unitNumber: config.unitNumber.trim() || null,
          lwcType: config.lwcType || null,
          dueDate: config.dueDate || null,
          planConlayDate: config.planConlayDate || null,
          planConassyDate: config.planConassyDate || null,
          color: config.color,
        }),
      });

      if (!response.ok) {
        setCreatingId(null);
        setIsSubmitting(false);
        return;
      }

      const payload = await response.json() as { manifest?: ProjectManifest };
      if (payload.manifest) {
        onProjectCreated(payload.manifest.id);
        // Remove from selection
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(project.id);
          return next;
        });
        setProjectConfigs((configs) => {
          const newConfigs = new Map(configs);
          newConfigs.delete(project.id);
          return newConfigs;
        });
      }
    } finally {
      setCreatingId(null);
      setIsSubmitting(false);
    }
  }, [projectConfigs, onProjectCreated]);

  if (mode === "skeleton") {
    return (
      <div className="flex-1 p-4 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedProjects = availableLegalProjects.filter((p) => selectedIds.has(p.id));

  return (
    <>
      {/* Full-screen submission loader */}
      <SubmissionLoader isVisible={isSubmitting} message={submissionMessage} />
      
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {/* Monthly Summary Card and Already Instantiated Section - at the top */}
        {instantiatedProjects.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Compact inline stat strip — stacks vertically on mobile */}
            <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-card sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-7 sm:w-7">
                  <Calendar className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="text-sm font-semibold tabular-nums leading-none sm:text-base">{instantiatedThisMonth}</span>
                  <span className="text-[11px] text-muted-foreground sm:text-xs">this month</span>
                </div>
              </div>
              <div className="h-px w-full bg-border sm:h-auto sm:w-px sm:self-stretch" />
              <div className="flex flex-1 items-center gap-2 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-green-500/10 sm:h-7 sm:w-7">
                  <CheckCircle2 className="h-3 w-3 text-green-600 sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="text-sm font-semibold tabular-nums leading-none sm:text-base">{instantiatedProjects.length}</span>
                  <span className="text-[11px] text-muted-foreground sm:text-xs">instantiated</span>
                </div>
              </div>
              <div className="h-px w-full bg-border sm:h-auto sm:w-px sm:self-stretch" />
              <div className="flex flex-1 items-center gap-2 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-7 sm:w-7">
                  <PackagePlus className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="text-sm font-semibold tabular-nums leading-none sm:text-base">{totalAvailable}</span>
                  <span className="text-[11px] text-muted-foreground sm:text-xs">available</span>
                </div>
              </div>
            </div>

            {/* Already Instantiated Projects */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Already Instantiated</span>
                <Badge variant="secondary" className="text-xs">
                  {instantiatedProjects.length}
                </Badge>
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
                {instantiatedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={project.href || `/${badgeNumber}/projects/${encodeURIComponent(project.projectId || project.pdNumber)}`}
                    className="flex min-w-[200px] shrink-0 items-center gap-3 rounded-xl border border-border bg-background/50 p-3 transition-colors hover:bg-accent sm:min-w-0"
                  >
                    <ProjectIcon
                      name={project.name}
                      color={project.color ?? undefined}
                      interactive={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {project.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {project.pdNumber}
                        {project.unitNumber && ` • Unit ${project.unitNumber}`}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Legal Projects List with Multi-Select */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                {/* Title row - responsive layout */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <CardTitle className="text-base truncate">
                      Available Legal Packages
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {availableLegalProjects.length}{hasActiveFilters && ` / ${totalAvailable}`}
                    </Badge>
                  </div>
                  {/* Action buttons - wrap on small screens */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={showFilters ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="h-7 text-xs"
                    >
                      <Filter className="mr-1 h-3 w-3" />
                      <span className="hidden xs:inline">Filters</span>
                      {hasActiveFilters && (
                        <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                          {(searchQuery.trim() ? 1 : 0) + (lwcFilter !== "all" ? 1 : 0)}
                        </span>
                      )}
                    </Button>
                    {totalAvailable > 0 && (
                      <>
                        {selectedIds.size > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            className="h-7 text-xs"
                          >
                            <span className="hidden xs:inline">Clear</span> ({selectedIds.size})
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={selectAll}
                            className="h-7 text-xs whitespace-nowrap"
                          >
                            Select All
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Select one or more legal packages to create project instances
                </CardDescription>
              </div>

              {/* Responsive Filter Panel */}
              {showFilters && (
                <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-[1fr_auto_auto]">
                    {/* Search - full width on mobile, flexible on larger */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search by name, PD number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 w-full pl-9 text-sm"
                      />
                    </div>
                    
                    {/* LWC Type Filter - full width on mobile */}
                    <Select value={lwcFilter} onValueChange={setLwcFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]">
                        <SelectValue placeholder="LWC Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" index={0}>All LWC Types</SelectItem>
                        {Object.entries(LWC_TYPE_REGISTRY).map(([key, config], index) => (
                          <SelectItem key={key} value={key} index={index + 1}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: config.dotColor }}
                              />
                              <span className="truncate">{config.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Clear filters - inline on desktop, full width on mobile */}
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-9 w-full sm:w-auto text-xs justify-center"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Clear
                      </Button>
                    )}
                  </div>
                  
                  {/* Active filter summary - scrollable on small screens */}
                  {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground overflow-x-auto">
                      <span className="shrink-0">Showing</span>
                      {searchQuery.trim() && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Search: {searchQuery.length > 15 ? `${searchQuery.slice(0, 15)}...` : searchQuery}
                        </Badge>
                      )}
                      {lwcFilter !== "all" && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          LWC: {LWC_TYPE_REGISTRY[lwcFilter as keyof typeof LWC_TYPE_REGISTRY]?.label || lwcFilter}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px] sm:h-[400px] pr-3">
              <div className="space-y-2">
                {availableLegalProjects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    {hasActiveFilters ? (
                      <>
                        <Filter className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          No legal packages match your filters
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="mt-1 text-xs"
                        >
                          Clear filters
                        </Button>
                      </>
                    ) : totalAvailable === 0 ? (
                      <>
                        <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          All legal packages have been instantiated
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          No legal packages available
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  availableLegalProjects.map((project) => {
                    const isSelected = selectedIds.has(project.id);
                    const lwcTypeValue = toLwcType(project.lwcType);

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => toggleSelection(project)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border bg-background/70 hover:bg-accent"
                        )}
                      >
                        <div className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <ProjectIcon
                          name={project.name}
                          color={project.color ?? undefined}
                          interactive={false}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {project.name}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="h-5 text-[10px] font-mono">
                              {project.pdNumber}
                            </Badge>
                            {lwcTypeValue ? (
                              <LwcTypeField
                                mode="status"
                                value={lwcTypeValue}
                                className="h-5 text-[10px]"
                              />
                            ) : null}
                            {project.revision ? (
                              <RevisionField
                                mode="status"
                                value={project.revision}
                                className="h-5 text-[10px]"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                          {project.hasWorkbook && (
                            <FileSpreadsheet className="h-4 w-4" title="Has workbook" />
                          )}
                          {project.hasLayout && (
                            <Layout className="h-4 w-4" title="Has layout" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Project Creation Panel with Collapsible Sections */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
              Create Project Instances
            </CardTitle>
            <CardDescription>
              {selectedIds.size === 0
                ? "Select legal packages to configure and create"
                : `${selectedIds.size} package${selectedIds.size !== 1 ? "s" : ""} selected`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedIds.size === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Select one or more legal packages from the list to create project instances
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-3">
                <div className="space-y-3">
                  {selectedProjects.map((project) => {
                    const config = projectConfigs.get(project.id);
                    if (!config) return null;

                    return (
                      <ProjectConfigCollapsible
                        key={project.id}
                        project={project}
                        config={config}
                        onUpdateConfig={(updates) => updateConfig(project.id, updates)}
                        onRemove={() => toggleSelection(project)}
                        onCreate={() => handleCreateProject(project)}
                        isCreating={creatingId === project.id}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      </div>
    </>
  );
}

function toLwcType(value?: string | null): LwcType | undefined {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return normalized in LWC_TYPE_REGISTRY ? (normalized as LwcType) : undefined;
}

/** Pick the best default revision: prefer the latest manifest-built one, else the latest overall, else project.revision. */
function getPreferredRevision(project: ScheduleProjectItem): string {
  const revisions = project.revisions ?? [];
  const built = revisions.filter((r) => Boolean(r?.artifacts?.manifestBuilt));
  const preferred = built.length > 0 ? built : revisions;
  return preferred[0]?.revision ?? project.revision ?? "";
}
