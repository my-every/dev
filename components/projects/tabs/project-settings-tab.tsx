"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Clock, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useProjectContext } from "@/contexts/project-context";
import type { ProjectManifest } from "@/types/project-manifest";
import { type LwcType, type ProjectStatus } from "@/lib/workbook/types";
import { hasUploadedLegals } from "@/lib/projects/dashboard-status";
import { cn } from "@/lib/utils";
import {
  DateField,
  LwcTypeField,
  PdNumberField,
  RevisionField,
  UnitNumberField,
} from "@/components/projects/fields";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "legals_pending", label: "Legals Pending" },
  { value: "brandlist", label: "Brand List" },
  { value: "branding", label: "Branding" },
  { value: "kitting", label: "Kitting" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "shipped", label: "Shipped" },
];

export function ProjectSettingsTab({ project, onProjectRefresh }: ProjectTabProps) {
  const { saveProject, deleteProject } = useProjectContext();
  const router = useRouter();
  const pathname = usePathname();
  const model = project;
  const projectHasLegals = hasUploadedLegals(model);

  const [name, setName] = useState(model.name);
  const [pdNumber, setPdNumber] = useState(model.pdNumber || "");
  const [unitNumber, setUnitNumber] = useState(model.unitNumber || "");
  const [revision, setRevision] = useState(model.revision || "");
  const [lwcType, setLwcType] = useState<LwcType | undefined>(model.lwcType);
  const [status, setStatus] = useState<ProjectStatus>(model.status);
  const [dueDate, setDueDate] = useState<Date | undefined>(model.dueDate ? new Date(model.dueDate) : undefined);
  const [planConlayDate, setPlanConlayDate] = useState<Date | undefined>(
    model.planConlayDate ? new Date(model.planConlayDate) : undefined,
  );
  const [planConassyDate, setPlanConassyDate] = useState<Date | undefined>(
    model.planConassyDate ? new Date(model.planConassyDate) : undefined,
  );
  const [shipDate, setShipDate] = useState<Date | undefined>(model.shipDate ? new Date(model.shipDate) : undefined);
  const [color, setColor] = useState(model.color || "#ffcc61");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);

  const handleSave = useCallback(() => {
    setSaving(true);

    const updatedManifest: ProjectManifest = {
      ...model,
      name: name.trim() || model.name,
      pdNumber: pdNumber.trim() || undefined,
      unitNumber: unitNumber.trim() || undefined,
      revision: revision.trim() || undefined,
      status,
      lwcType,
      dueDate,
      planConlayDate,
      planConassyDate,
      shipDate,
      color,
    };

    void Promise.resolve(saveProject(updatedManifest)).finally(() => {
      setTimeout(() => {
        setSaving(false);
        setDirty(false);
      }, 300);
    });
  }, [color, dueDate, lwcType, model, name, pdNumber, planConassyDate, planConlayDate, revision, saveProject, shipDate, status, unitNumber]);

  const handleDeleteProject = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteProject(model.id);
      const segments = pathname.split("/").filter(Boolean);
      const badgeNumber = segments[0] ?? "";
      router.push(`/${badgeNumber}/projects`);
      router.refresh();
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [deleteProject, model.id, pathname, router]);

  return (
    <div className="flex flex-col gap-4">

      <div className="rounded-lg border border-border/50 bg-card/60 p-3">
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project Details</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="min-w-0">
            <PdNumberField mode="create" value={pdNumber} onChange={(v) => { setPdNumber(v); markDirty(); }} label="PD Number" />
          </div>
          <div className="min-w-0">
            <UnitNumberField mode="create" value={unitNumber} onChange={(v) => { setUnitNumber(v); markDirty(); }} label="Unit Number" />
          </div>
          {projectHasLegals ? (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Revision</label>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                {revision || "Not set"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Revision is managed from the Legals tab after a legal package has been uploaded.
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <RevisionField mode="create" value={revision} onChange={(v) => { setRevision(v); markDirty(); }} label="Revision" />
            </div>
          )}
          <div className="min-w-0">
            <LwcTypeField mode="create" value={lwcType} onChange={(v) => { setLwcType(v); markDirty(); }} label="LWC Type" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <label className="text-xs font-medium text-muted-foreground">Project Status</label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as ProjectStatus);
                markDirty();
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select project status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/60 p-6">
        <h4 className="mb-3 text-[14px] font-medium uppercase tracking-wider text-muted-foreground">Planning Dates</h4>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:gap-8">
          <div className="space-y-4">
          <DateField mode="create" value={planConlayDate} onChange={(v) => { setPlanConlayDate(v); markDirty(); }} label="Plan ConLay Date" />
          <DateField mode="create" value={planConassyDate} onChange={(v) => { setPlanConassyDate(v); markDirty(); }} label="Plan ConAssy Date" />
          </div>

          <div className="space-y-4">
          <DateField mode="create" value={dueDate} onChange={(v) => { setDueDate(v); markDirty(); }} label="Due Date" />
          <DateField mode="create" value={shipDate} onChange={(v) => { setShipDate(v); markDirty(); }} label="Ship Date" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/60 p-3">
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Display</h4>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Project Color</label>
          <div className="flex flex-wrap gap-1.5">
            {["#ffcc61", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#F97316", "#EC4899", "#6366F1", "#14B8A6", "#84CC16"].map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  setColor(swatch);
                  markDirty();
                }}
                className={cn(
                  "h-7 w-7 rounded-md border-2 transition-all",
                  color === swatch ? "scale-110 border-foreground shadow-sm" : "border-transparent hover:border-border",
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      </div>

      <Separator className="my-1" />

      <div className="rounded-lg border border-red-200/80 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600" />
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">Danger Zone</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Deleting a project removes its stored project state and workspace files from the active project library.
            </p>
          </div>
          <Button type="button" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:shrink-0" onClick={() => setShowDeleteDialog(true)}>
            Delete Project
          </Button>
        </div>
      </div>

      <Button size="sm" className="mt-2 w-full gap-1.5" disabled={!dirty || saving} onClick={handleSave}>
        {saving ? (
          <>
            <Clock className="h-3.5 w-3.5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" />
            Save Changes
          </>
        )}
      </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-medium text-foreground">{model.name}</span> from the stored projects workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteProject();
              }}
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
