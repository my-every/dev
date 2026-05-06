"use client";

import { ChevronDown, FolderPlus, Loader2, PackagePlus, X } from "lucide-react";

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

import { ProjectIcon } from "../../projects/_components/project-icon";
import type { ScheduleProjectItem } from "./schedule-types";

export type CreateMode = "project" | "unit" | null;

// Per-project configuration state shared with the parent component.
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

export const COLOR_PRESETS = [
  "#ffcc61", "#3B82F6", "#10B981", "#8B5CF6",
  "#F59E0B", "#EF4444", "#06B6D4", "#F97316",
];

type ProjectConfigCollapsibleProps = {
  project: ScheduleProjectItem;
  config: ProjectConfig;
  onUpdateConfig: (updates: Partial<ProjectConfig>) => void;
  onRemove: () => void;
  onCreate: () => void;
  isCreating: boolean;
};

/**
 * Collapsible card for configuring a single project instance.
 *
 * The header is structured so the Radix CollapsibleTrigger button is a
 * sibling of the remove (X) button rather than its parent. This avoids the
 * "<button> cannot be a descendant of <button>" hydration error caused by
 * nesting an interactive Button inside the trigger.
 */
export function ProjectConfigCollapsible({
  project,
  config,
  onUpdateConfig,
  onRemove,
  onCreate,
  isCreating,
}: ProjectConfigCollapsibleProps) {
  const canCreate =
    Boolean(config.projectName.trim()) &&
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
        onRemove={onRemove}
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

type ProjectConfigHeaderProps = {
  project: ScheduleProjectItem;
  config: ProjectConfig;
  onRemove: () => void;
};

/**
 * Header row containing the collapsible trigger and a sibling remove button.
 *
 * The CollapsibleTrigger only wraps the icon/title/chevron region. The remove
 * button lives next to it (not inside it) so we never end up with one
 * <button> nested inside another.
 */
function ProjectConfigHeader({
  project,
  config,
  onRemove,
}: ProjectConfigHeaderProps) {
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
            className="h-8 w-8"
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
              config.isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
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
    </div>
  );
}

type ProjectModeSelectorProps = {
  onSelect: (mode: CreateMode) => void;
};

/** Two-card chooser between creating a Project or a Unit. */
function ProjectModeSelector({ onSelect }: ProjectModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onSelect("project")}
        className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-3 text-center transition-colors hover:bg-accent"
      >
        <FolderPlus className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium">Project</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("unit")}
        className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-3 text-center transition-colors hover:bg-accent"
      >
        <PackagePlus className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium">Unit</span>
      </button>
    </div>
  );
}

type ProjectConfigBodyProps = {
  project: ScheduleProjectItem;
  config: ProjectConfig;
  canCreate: boolean;
  isCreating: boolean;
  onUpdateConfig: (updates: Partial<ProjectConfig>) => void;
  onCreate: () => void;
};

/** Form body shown after the user picks a creation mode. */
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
      <ProjectConfigForm
        project={project}
        config={config}
        onUpdateConfig={onUpdateConfig}
      />

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

type ProjectConfigFormProps = {
  project: ScheduleProjectItem;
  config: ProjectConfig;
  onUpdateConfig: (updates: Partial<ProjectConfig>) => void;
};

/** All form fields for a single project configuration. */
function ProjectConfigForm({
  project,
  config,
  onUpdateConfig,
}: ProjectConfigFormProps) {
  const availableRevisions = (() => {
    const ready = (project.revisions ?? [])
      .filter((rev) => Boolean(rev?.artifacts?.manifestBuilt));
    if (ready.length > 0) return ready;
    return project.revisions ?? [];
  })();

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
        <div className="grid gap-1.5">
          <Label htmlFor={`unit-${project.id}`} className="text-xs font-medium">
            Unit Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`unit-${project.id}`}
            value={config.unitNumber}
            onChange={(e) => onUpdateConfig({ unitNumber: e.target.value })}
            placeholder="e.g. 1, 2, 3"
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">Revision</Label>
          <Select
            value={config.selectedRevision}
            onValueChange={(v) => onUpdateConfig({ selectedRevision: v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {availableRevisions.map((rev, index) => (
                <SelectItem key={rev.revision} value={rev.revision} index={index}>
                  {rev.revision}
                </SelectItem>
              ))}
              {availableRevisions.length === 0 && project.revision && (
                <SelectItem value={project.revision} index={0}>
                  {project.revision}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">LWC Type</Label>
          <Select
            value={config.lwcType}
            onValueChange={(v) => onUpdateConfig({ lwcType: v as LwcType })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {Object.values(LWC_TYPE_REGISTRY).map((lwc, index) => (
                <SelectItem key={lwc.id} value={lwc.id} index={index}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: lwc.dotColor }}
                    />
                    {lwc.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ProjectDateField
          id={`due-${project.id}`}
          label="Due Date"
          value={config.dueDate}
          onChange={(value) => onUpdateConfig({ dueDate: value })}
        />
        <ProjectDateField
          id={`conlay-${project.id}`}
          label="LWC Conlay"
          value={config.planConlayDate}
          onChange={(value) => onUpdateConfig({ planConlayDate: value })}
        />
        <ProjectDateField
          id={`conassy-${project.id}`}
          label="Conassy"
          value={config.planConassyDate}
          onChange={(value) => onUpdateConfig({ planConassyDate: value })}
        />
      </div>

      <ProjectColorPicker
        value={config.color}
        onChange={(color) => onUpdateConfig({ color })}
      />
    </div>
  );
}

type ProjectDateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

/** Single labeled date input. */
function ProjectDateField({ id, label, value, onChange }: ProjectDateFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  );
}

type ProjectColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

/** Color preset swatches for the project icon. */
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
                : "border-transparent"
            )}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    </div>
  );
}
