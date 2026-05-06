"use client";

import { ChevronDown, FileX2, FolderPlus, Loader2, PackagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LWC_TYPE_REGISTRY, type LwcType } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";
import {
  DateField,
  LwcTypeField,
  RevisionField,
  UnitNumberField,
} from "@/components/projects/fields";

import { ProjectIcon } from "./project-icon";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Minimal project shape required by the config collapsible. Callers can pass
 * a richer object (e.g. `DueProjectNavItem` or `ScheduleProjectItem`) as long
 * as these fields are present.
 */
export type ProjectInstanceItem = {
  id: string;
  pdNumber: string;
  name: string;
  revision?: string | null;
  color?: string | null;
  lwcType?: string | null;
  revisions?: Array<{
    revision: string;
    artifacts: { manifestBuilt: boolean };
  }>;
};

export type CreateMode = "project" | "unit" | null;

/** Per-project configuration state shared with the parent component. */
export type ProjectConfig = {
  projectName: string;
  unitNumber: string;
  lwcType: LwcType | "";
  selectedRevision: string;
  color: string;
  createMode: CreateMode;
  isOpen: boolean;
  dueDate: string;
  planConlayDate: string;
  planConassyDate: string;
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  projectName: "",
  unitNumber: "",
  lwcType: "",
  selectedRevision: "",
  color: "#ffcc61",
  createMode: null,
  isOpen: true,
  dueDate: "",
  planConlayDate: "",
  planConassyDate: "",
};

export const COLOR_PRESETS = [
  "#ffcc61", "#3B82F6", "#10B981", "#8B5CF6",
  "#F59E0B", "#EF4444", "#06B6D4", "#F97316",
];

type ProjectConfigCollapsibleProps = {
  project: ProjectInstanceItem;
  config: ProjectConfig;
  onUpdateConfig: (updates: Partial<ProjectConfig>) => void;
  onRemove?: () => void;
  onCreate: () => void;
  isCreating: boolean;
  /** Hide the remove button. Defaults to true (shown). */
  showRemove?: boolean;
};

/**
 * Collapsible card for configuring a single project instance.
 *
 * The header is structured so the Radix CollapsibleTrigger button is a
 * sibling of the remove (X) button rather than its parent. This avoids the
 * "<button> cannot be a descendant of <button>" hydration error.
 */
export function ProjectConfigCollapsible({
  project,
  config,
  onUpdateConfig,
  onRemove,
  onCreate,
  isCreating,
  showRemove = true,
}: ProjectConfigCollapsibleProps) {
  const canCreate =
    Boolean(config.projectName.trim()) &&
    Boolean(config.selectedRevision) &&
    (config.createMode !== "unit" || Boolean(config.unitNumber.trim()));

  return (
    <Collapsible
      open={config.isOpen}
      onOpenChange={(open) => onUpdateConfig({ isOpen: open })}
      className="rounded-xl border border-border bg-background/70"
    >
      <ProjectConfigHeader
        project={project}
        config={config}
        onRemove={showRemove ? onRemove : undefined}
      />

      <CollapsibleContent>
        <div className="space-y-4 border-t border-border px-3 pb-3 pt-3">
          {config.createMode === null ? (
            <ProjectModeSelector
              onSelect={(mode) => onUpdateConfig({ createMode: mode })}
            />
          ) : (
            <ProjectConfigBody
              project={project}
              config={config}
              canCreate={canCreate}
              isCreating={isCreating}
              onUpdateConfig={onUpdateConfig}
              onCreate={onCreate}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(value?: Date): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Header ──────────────────────────────────────────────────────────────────

type ProjectConfigHeaderProps = {
  project: ProjectInstanceItem;
  config: ProjectConfig;
  onRemove?: () => void;
};

function ProjectConfigHeader({ project, config, onRemove }: ProjectConfigHeaderProps) {
  return (
    <div className="flex items-stretch gap-1 rounded-t-xl pr-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex flex-1 items-center gap-3 rounded-tl-xl p-3 text-left transition-colors hover:bg-accent/50"
        >
          <ProjectIcon
            name={project.name}
            color={config.color || project.color || "#ffcc61"}
            interactive={false}
            className="h-9 w-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {config.projectName || project.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {project.pdNumber}
              {config.unitNumber && ` • Unit ${config.unitNumber}`}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              config.isOpen && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      {onRemove && (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
            aria-label={`Remove ${project.name}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Mode selector ───────────────────────────────────────────────────────────

type ProjectModeSelectorProps = {
  onSelect: (mode: CreateMode) => void;
};

function ProjectModeSelector({ onSelect }: ProjectModeSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">What would you like to create?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose a type to configure and launch this legal drawing.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelect("project")}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-3 text-center transition-colors hover:bg-accent hover:border-primary/40"
        >
          <FolderPlus className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Project</span>
          <span className="text-[10px] text-muted-foreground">Single unit</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("unit")}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-3 text-center transition-colors hover:bg-accent hover:border-primary/40"
        >
          <PackagePlus className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Unit</span>
          <span className="text-[10px] text-muted-foreground">Multi-unit run</span>
        </button>
      </div>
    </div>
  );
}

// ─── Config body ─────────────────────────────────────────────────────────────

type ProjectConfigBodyProps = {
  project: ProjectInstanceItem;
  config: ProjectConfig;
  canCreate: boolean;
  isCreating: boolean;
  onUpdateConfig: (updates: Partial<ProjectConfig>) => void;
  onCreate: () => void;
};

function ProjectConfigBody({
  project,
  config,
  canCreate,
  isCreating,
  onUpdateConfig,
  onCreate,
}: ProjectConfigBodyProps) {
  return (
    <>
      <ProjectConfigForm project={project} config={config} onUpdateConfig={onUpdateConfig} />

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdateConfig({ createMode: null })}
          className="h-7 text-xs"
        >
          Back
        </Button>
        <Button
          size="sm"
          disabled={isCreating || !canCreate}
          onClick={onCreate}
          className="h-7"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <FolderPlus className="mr-1.5 h-3 w-3" />
              Create
            </>
          )}
        </Button>
      </div>
    </>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

type ProjectConfigFormProps = {
  project: ProjectInstanceItem;
  config: ProjectConfig;
  onUpdateConfig: (updates: Partial<ProjectConfig>) => void;
};

function ProjectConfigForm({ project, config, onUpdateConfig }: ProjectConfigFormProps) {
  const availableRevisions = (() => {
    const ready = (project.revisions ?? []).filter((rev) => Boolean(rev?.artifacts?.manifestBuilt));
    return ready.length > 0 ? ready : project.revisions ?? [];
  })();

  if (availableRevisions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <FileX2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No revisions available</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload a workbook or layout to unlock project creation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`name-${project.id}`} className="text-xs font-medium">
          Project Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`name-${project.id}`}
          value={config.projectName}
          onChange={(e) => onUpdateConfig({ projectName: e.target.value })}
          placeholder="e.g. MER-SOL, TRP-NAU"
          className="h-8 text-sm"
        />
      </div>

      {config.createMode === "unit" && (
        <UnitNumberField
          mode="create"
          value={config.unitNumber}
          onChange={(value) => onUpdateConfig({ unitNumber: value })}
          className="space-y-1.5"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <RevisionField
          mode="create"
          value={config.selectedRevision}
          onChange={(value) => onUpdateConfig({ selectedRevision: value })}
          className="space-y-1.5"
          placeholder="Select or type revision"
          wireListRevisions={[]}
          layoutRevisions={[]}
        />

        <LwcTypeField
          mode="create"
          value={(config.lwcType || undefined) as LwcType | undefined}
          onChange={(value) => onUpdateConfig({ lwcType: value })}
          className="space-y-1.5"
          showRegistryDescription={false}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <DateField
          mode="create"
          label="Due Date"
          value={parseDate(config.dueDate)}
          onChange={(value) => onUpdateConfig({ dueDate: formatDate(value) })}
        />
        <DateField
          mode="create"
          label="LWC Conlay"
          value={parseDate(config.planConlayDate)}
          onChange={(value) => onUpdateConfig({ planConlayDate: formatDate(value) })}
        />
        <DateField
          mode="create"
          label="Conassy"
          value={parseDate(config.planConassyDate)}
          onChange={(value) => onUpdateConfig({ planConassyDate: formatDate(value) })}
        />
      </div>

      <ProjectColorPicker value={config.color} onChange={(color) => onUpdateConfig({ color })} />
    </div>
  );
}

// ─── Color picker ────────────────────────────────────────────────────────────

type ProjectColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

function ProjectColorPicker({ value, onChange }: ProjectColorPickerProps) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium">Color</Label>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-label={`Choose color ${preset}`}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
              value === preset
                ? "border-foreground ring-1 ring-foreground/20"
                : "border-transparent",
            )}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    </div>
  );
}
