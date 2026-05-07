"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  MinusCircle,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProjectRevisionTreeRow, RevisionFilesystemNode } from "@/lib/revision/types";
import type { ProjectRowSettings } from "@/components/revision/revision-scan-workflow";

interface RevisionFilesystemTreeTableProps {
  rows: ProjectRevisionTreeRow[];
  isLoading?: boolean;
  expandedProjectKeys: Set<string>;
  selectedProjectKeys: Set<string>;
  selectedFileIds?: Set<string>;
  projectSettings?: Record<string, ProjectRowSettings>;
  onToggleExpand: (projectKey: string) => void;
  onToggleProjectSelection: (projectKey: string, nextSelected: boolean) => void;
  onToggleSelectAll: (nextSelected: boolean) => void;
  onToggleFileSelection?: (fileId: string, nextSelected: boolean) => void;
  onUpdateProjectSettings?: (projectKey: string, settings: Partial<ProjectRowSettings>) => void;
  onDeleteProject?: (projectKey: string) => void;
}

const TABLE_GRID_CLASS = "grid min-w-[1320px] grid-cols-[32px_minmax(180px,1.6fr)_minmax(260px,2.2fr)_minmax(160px,1.2fr)_minmax(130px,1fr)_minmax(150px,1.1fr)_minmax(150px,1.1fr)_minmax(150px,1fr)_minmax(120px,0.9fr)_32px] items-center gap-2";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function DateTimeCell({ value }: { value: string | null | undefined }) {
  const date = parseDate(value);
  if (!date) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate text-xs font-medium">
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="truncate text-[10px] text-muted-foreground">{formatDistanceToNow(date, { addSuffix: true })}</div>
    </div>
  );
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileTypeIcon({ node }: { node: RevisionFilesystemNode }) {
  if (node.fileTypeIndicator === "wire-list" || node.fileTypeIndicator === "compare-wire-list" || node.fileTypeIndicator === "brand-list") {
    return <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-sky-600" />;
  }

  if (node.fileTypeIndicator === "layout-pdf") {
    return <FileText className="h-3.5 w-3.5 shrink-0 text-rose-600" />;
  }

  return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

function NodeTypeBadge({ node }: { node: RevisionFilesystemNode }) {
  const label = node.fileTypeIndicator ?? node.type;
  const variant = label === "layout-pdf"
    ? "default"
    : label === "wire-list" || label === "compare-wire-list"
      ? "secondary"
      : "outline";

  return (
    <Badge variant={variant} className="inline-flex items-center gap-1">
      <FileTypeIcon node={node} />
      {label}
    </Badge>
  );
}

function ValidationBadge({ project }: { project: ProjectRevisionTreeRow }) {
  if (project.validation.missingRequiredLegalAssets) {
    return (
      <Badge variant="destructive" className="inline-flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        Missing Legal Assets
      </Badge>
    );
  }
  if (project.validation.brandListRevisionsIncomplete) {
    return (
      <Badge variant="secondary" className="inline-flex items-center gap-1">
        <ShieldAlert className="h-3.5 w-3.5" />
        Brand Incomplete
      </Badge>
    );
  }
  if (project.validation.revisionMetadataStale) {
    return (
      <Badge variant="outline" className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5" />
        Metadata Stale
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="inline-flex items-center gap-1">
      <ShieldCheck className="h-3.5 w-3.5" />
      Valid
    </Badge>
  );
}

function ReadinessBadge({ readiness }: { readiness: ProjectRevisionTreeRow["readiness"] }) {
  if (readiness === "ready") {
    return (
      <Badge variant="default" className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ready
      </Badge>
    );
  }

  if (readiness === "partial") {
    return (
      <Badge variant="secondary" className="inline-flex items-center gap-1">
        <MinusCircle className="h-3.5 w-3.5" />
        Partial
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="inline-flex items-center gap-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      Blocked
    </Badge>
  );
}

function PairingBadge({ label }: { label: "Matched" | "Partial" | "Missing" }) {
  if (label === "Matched") {
    return (
      <Badge variant="default" className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Matched
      </Badge>
    );
  }

  if (label === "Partial") {
    return (
      <Badge variant="secondary" className="inline-flex items-center gap-1">
        <MinusCircle className="h-3.5 w-3.5" />
        Partial
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="inline-flex items-center gap-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      Missing
    </Badge>
  );
}

const COLOR_PRESETS = [
  "#ffcc61", "#3B82F6", "#10B981", "#8B5CF6",
  "#F59E0B", "#EF4444", "#06B6D4", "#F97316",
  "#EC4899", "#6366F1", "#14B8A6", "#84CC16",
];

function ProjectSettingsPopover({
  projectKey,
  settings,
  onUpdate,
  onDelete,
}: {
  projectKey: string;
  settings: ProjectRowSettings;
  onUpdate?: (projectKey: string, settings: Partial<ProjectRowSettings>) => void;
  onDelete?: (projectKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localName, setLocalName] = useState(settings.name ?? "");
  const [localUnit, setLocalUnit] = useState(settings.unitNumber ?? "");
  const [localDue, setLocalDue] = useState(settings.dueDate ?? "");
  const [localColor, setLocalColor] = useState(settings.color ?? "");

  function handleSave() {
    onUpdate?.(projectKey, {
      name: localName || undefined,
      unitNumber: localUnit || undefined,
      dueDate: localDue || undefined,
      color: localColor || undefined,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label={`Settings for ${projectKey}`}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Metadata</p>

          <div className="space-y-1.5">
            <Label htmlFor={`name-${projectKey}`} className="text-xs">Display Name</Label>
            <Input
              id={`name-${projectKey}`}
              value={localName}
              placeholder={projectKey}
              onChange={(e) => setLocalName(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`unit-${projectKey}`} className="text-xs">Unit Number</Label>
            <Input
              id={`unit-${projectKey}`}
              value={localUnit}
              placeholder="e.g. 1"
              onChange={(e) => setLocalUnit(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`due-${projectKey}`} className="text-xs">Due Date</Label>
            <Input
              id={`due-${projectKey}`}
              type="date"
              value={localDue}
              onChange={(e) => setLocalDue(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full border-2 p-0 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: localColor === c ? "white" : "transparent",
                    outline: localColor === c ? `2px solid ${c}` : "none",
                  }}
                  onClick={() => setLocalColor(c)}
                  aria-label={c}
                />
              ))}
              {localColor && !COLOR_PRESETS.includes(localColor) && (
                <div className="h-5 w-5 rounded-full border-2 border-white" style={{ backgroundColor: localColor }} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={handleSave}>
              Save
            </Button>
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => { onDelete(projectKey); setOpen(false); }}
                aria-label="Remove project from scan"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RevisionFilesystemTreeTable({
  rows,
  isLoading = false,
  expandedProjectKeys,
  selectedProjectKeys,
  selectedFileIds,
  onToggleExpand,
  onToggleProjectSelection,
  onToggleSelectAll,
  onToggleFileSelection,
  projectSettings = {},
  onUpdateProjectSettings,
  onDeleteProject,
}: RevisionFilesystemTreeTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedProjectKeys.has(row.rootLabel));

  return (
    <div className="rounded-lg border border-border">
      <div className="overflow-x-auto">
        <div className={`${TABLE_GRID_CLASS} border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
            aria-label="Select all projects"
          />
          <span>Project / Node</span>
          <span>Absolute Path</span>
          <span>Last Modified</span>
          <span>File Type</span>
          <span>Revision Pairing</span>
          <span>Prev vs Current</span>
          <span>Validation</span>
          <span>Readiness</span>
          <span />
        </div>

        <div className="max-h-104 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 px-3 py-3">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={TABLE_GRID_CLASS}
              >
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-6" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">No projects found for this scan.</div>
        ) : null}

        {!isLoading && rows.map((project) => {
          const isExpanded = expandedProjectKeys.has(project.rootLabel);
          const isSelected = selectedProjectKeys.has(project.rootLabel);
          const settings = projectSettings[project.rootLabel] ?? {};
          const pairingLabel = project.validation.hasMatchingRevisionPairs
            ? "Matched"
            : project.revisionPairState.comparisonState === "partial"
              ? "Partial"
              : "Missing";
          const displayName = settings.name || project.rootLabel;

          return (
            <div key={project.rootLabel} className="border-b last:border-b-0">
              <div className={`${TABLE_GRID_CLASS} px-3 py-2 text-sm`}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onToggleProjectSelection(project.rootLabel, Boolean(checked))}
                  aria-label={`Select ${project.rootLabel}`}
                />

                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onToggleExpand(project.rootLabel)}
                    aria-label={isExpanded ? `Collapse ${project.rootLabel}` : `Expand ${project.rootLabel}`}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  {isExpanded ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                  <span className="truncate font-medium" style={settings.color ? { color: settings.color } : undefined}>
                    {displayName}
                  </span>
                </div>

                <span className="truncate text-xs text-muted-foreground">
                  {project.legalFolderName || project.brandFolderName || "-"}
                </span>
                <DateTimeCell value={project.latestModifiedAt} />
                <Badge variant="outline">project</Badge>
                <PairingBadge label={pairingLabel as "Matched" | "Partial" | "Missing"} />
                <span className="truncate text-xs text-muted-foreground">
                  {project.revisionPairState.previousWireListRevision || "-"} → {project.revisionPairState.latestWireListRevision || "-"}
                </span>
                <ValidationBadge project={project} />
                <ReadinessBadge readiness={project.readiness} />

                <ProjectSettingsPopover
                  projectKey={project.rootLabel}
                  settings={settings}
                  onUpdate={onUpdateProjectSettings}
                  onDelete={onDeleteProject}
                />
              </div>

              {isExpanded ? (
                <div className="space-y-0.5 bg-muted/15 px-3 pb-2">
                  {project.filesNewestFirst.map((node) => (
                    <div
                      key={node.id}
                      className={cn(
                        `${TABLE_GRID_CLASS} rounded-md px-1 py-1 text-xs`,
                        "hover:bg-muted/40",
                        selectedFileIds?.has(node.id) && "bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={selectedFileIds?.has(node.id) ?? false}
                        onCheckedChange={(checked) => onToggleFileSelection?.(node.id, Boolean(checked))}
                        aria-label={`Select file ${node.name}`}
                        className="ml-1"
                      />
                      <div className="flex min-w-0 items-center gap-2 pl-6">
                        <FileTypeIcon node={node} />
                        <span className="truncate">{node.name}</span>
                        <span className="text-[10px] text-muted-foreground">{formatSize(node.sizeBytes)}</span>
                      </div>
                      <span className="truncate text-muted-foreground">{node.absolutePath}</span>
                      <DateTimeCell value={node.modifiedAt} />
                      <NodeTypeBadge node={node} />
                      <span>{node.revisionInfo?.displayVersion || "-"}</span>
                      <span>{node.revisionInfo?.revision || "-"}</span>
                      <Badge variant={node.validationStatus === "valid" ? "default" : "secondary"}>
                        {node.validationStatus || "-"}
                      </Badge>
                      <Badge variant={node.readinessStatus === "ready" ? "default" : "secondary"}>
                        {node.readinessStatus || "-"}
                      </Badge>
                      <span />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
