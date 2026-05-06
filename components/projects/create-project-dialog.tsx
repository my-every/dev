"use client";

/**
 * CreateProjectDialog
 *
 * Dialog for creating a new project without requiring legals upload.
 * Collects: project name, PD number, unit number, revision, LWC type,
 *           due date, plan ConLay date, plan ConAssy date, color.
 *
 * Optionally allows uploading UCP or layout PDF later.
 */

import { useState, useCallback, useEffect } from "react";
import {
    Plus,
    Loader2,
    FolderPlus,
    Calendar,
    FileSpreadsheet,
    Palette,
} from "lucide-react";
import { DateField } from "@/components/projects/fields";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type LwcType, LWC_TYPE_REGISTRY, type ProjectModel } from "@/lib/workbook/types";
import { useProjectContext } from "@/contexts/project-context";
import { useSession } from "@/hooks/use-session";
import type { LegalProjectRecord } from "@/types/legal-drawings";
import type { ProjectManifest } from "@/types/project-manifest";

// ============================================================================
// Types
// ============================================================================

export interface CreateProjectDialogProps {
    /** Trigger element — if omitted, renders default button */
    trigger?: React.ReactNode;
    /** Called after project is created */
    onCreated?: (projectId: string) => void;
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    dialogTitle?: string;
    dialogDescription?: string;
    requireUnitNumber?: boolean;
    initialValues?: Partial<Pick<CreateProjectForm, "name" | "unitNumber" | "sourceMode">>;
    initialLegalSource?: {
        pdNumber: string;
        revision?: string | null;
    };
}

interface CreateProjectForm {
    sourceMode: "legal-library" | "manual";
    name: string;
    pdNumber: string;
    legalRevision: string;
    unitNumber: string;
    revision: string;
    lwcType: LwcType | "";
    dueDate: string;
    planConlayDate: string;
    planConassyDate: string;
    shipDate: string;
    color: string;
}

const DEFAULT_FORM: CreateProjectForm = {
    sourceMode: "legal-library",
    name: "",
    pdNumber: "",
    legalRevision: "",
    unitNumber: "",
    revision: "",
    lwcType: "",
    dueDate: "",
    planConlayDate: "",
    planConassyDate: "",
    shipDate: "",
    color: "#ffcc61",
};

function parseDateString(value: string): Date | undefined {
    if (!value) return undefined;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatDateToString(date: Date | undefined): string {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const COLOR_PRESETS = [
    "#ffcc61", "#3B82F6", "#10B981", "#8B5CF6",
    "#F59E0B", "#EF4444", "#06B6D4", "#F97316",
    "#EC4899", "#6366F1", "#14B8A6", "#84CC16",
];

function getManifestReadyRevisions(project: LegalProjectRecord | null): string[] {
    if (!project) return [];
    const ready = (project.revisions ?? [])
        .filter(revision => Boolean(revision?.artifacts?.manifestBuilt))
        .map(revision => revision.revision)
        .filter(Boolean);
    return ready.length > 0
        ? ready
        : (project.revisions ?? []).map(revision => revision.revision).filter(Boolean);
}

function getPreferredRevision(project: LegalProjectRecord | null): string {
    if (!project) return "";
    const manifestReady = getManifestReadyRevisions(project);
    if (manifestReady.length > 0) {
        return manifestReady[manifestReady.length - 1] ?? "";
    }
    return project.latestRevision ?? project.revisions[project.revisions.length - 1]?.revision ?? "";
}

function getLegalProjectOptionLabel(project: LegalProjectRecord): string {
    const pd = (project.pdNumber ?? "").trim();
    const hint = (project.projectNameHint ?? "").trim();
    if (!hint || hint.toUpperCase() === pd.toUpperCase()) {
        return pd;
    }
    return `${pd} - ${hint}`;
}

// ============================================================================
// Component
// ============================================================================

export function CreateProjectDialog({
    trigger,
    onCreated,
    className,
    open: controlledOpen,
    onOpenChange,
    dialogTitle = "Create Project",
    dialogDescription = "Create a project placeholder for scheduling and planning. Legals can be uploaded later when ready.",
    requireUnitNumber = false,
    initialValues,
    initialLegalSource,
}: CreateProjectDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [form, setForm] = useState<CreateProjectForm>({ ...DEFAULT_FORM });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [legalProjects, setLegalProjects] = useState<LegalProjectRecord[]>([]);
    const [loadingLegalProjects, setLoadingLegalProjects] = useState(false);
    const [workbookFile, setWorkbookFile] = useState<File | null>(null);
    const [layoutPdfFile, setLayoutPdfFile] = useState<File | null>(null);
    const { saveProject } = useProjectContext();
    const { user } = useSession();
    const isControlled = typeof controlledOpen === "boolean";
    const open = isControlled ? controlledOpen : internalOpen;

    const updateField = useCallback(<K extends keyof CreateProjectForm>(
        key: K,
        value: CreateProjectForm[K],
    ) => {
        setForm(prev => ({ ...prev, [key]: value }));
    }, []);

    const isValid = form.name.trim().length > 0 && (!requireUnitNumber || form.unitNumber.trim().length > 0);

    const buildDefaultForm = useCallback((): CreateProjectForm => ({
        ...DEFAULT_FORM,
        sourceMode: initialValues?.sourceMode ?? DEFAULT_FORM.sourceMode,
        name: initialValues?.name ?? DEFAULT_FORM.name,
        unitNumber: initialValues?.unitNumber ?? DEFAULT_FORM.unitNumber,
    }), [initialValues?.name, initialValues?.sourceMode, initialValues?.unitNumber]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoadingLegalProjects(true);

        void fetch("/api/legal-drawings", { cache: "no-store" })
            .then(response => response.ok ? response.json() as Promise<{ projects?: LegalProjectRecord[] }> : { projects: [] })
            .then(payload => {
                if (cancelled) return;
                const projects = payload.projects ?? [];
                setLegalProjects(projects);

                const seededPdNumber = initialLegalSource?.pdNumber?.trim().toUpperCase();
                if (seededPdNumber) {
                    const seededProject = projects.find(project => project.pdNumber === seededPdNumber) ?? null;
                    setForm(prev => ({
                        ...prev,
                        sourceMode: "legal-library",
                        pdNumber: seededPdNumber,
                        legalRevision: initialLegalSource?.revision ?? getPreferredRevision(seededProject),
                    }));
                } else if (!form.pdNumber && projects.length > 0) {
                    const firstProject = projects[0];
                    setForm(prev => ({
                        ...prev,
                        pdNumber: firstProject?.pdNumber ?? "",
                        legalRevision: getPreferredRevision(firstProject),
                    }));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingLegalProjects(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, form.pdNumber, initialLegalSource?.pdNumber, initialLegalSource?.revision]);

    const selectedLegalProject = legalProjects.find(project => project.pdNumber === form.pdNumber) ?? null;

    const uploadLegalFilesForProject = useCallback(async ({
        projectId,
        pdNumber,
        revision,
    }: {
        projectId: string;
        pdNumber: string;
        revision: string;
    }) => {
        if (!workbookFile && !layoutPdfFile) {
            return;
        }

        const formData = new FormData();
        if (workbookFile) formData.append("workbook", workbookFile);
        if (layoutPdfFile) formData.append("layout", layoutPdfFile);
        formData.append("baseRevision", revision || "UPLOADED");
        formData.append("pdNumber", pdNumber || "");

        const uploadResponse = await fetch(`/api/projects/revisions/${encodeURIComponent(projectId)}/files`, {
            method: "POST",
            body: formData,
        });

        if (!uploadResponse.ok) {
            const payload = await uploadResponse.json().catch(() => ({})) as { error?: string };
            throw new Error(payload.error || "Project created, but uploading workbook/PDF failed.");
        }

        const refreshedManifestResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
            cache: "no-store",
        });
        if (refreshedManifestResponse.ok) {
            const refreshedPayload = await refreshedManifestResponse.json() as { manifest?: ProjectManifest };
            if (refreshedPayload.manifest) {
                saveProject(refreshedPayload.manifest);
            }
        }
    }, [layoutPdfFile, saveProject, workbookFile]);

    const handleCreate = useCallback(async () => {
        if (!isValid) return;
        setCreating(true);
        setCreateError(null);

        try {
            if (form.sourceMode === "legal-library" && form.pdNumber.trim() && form.legalRevision.trim()) {
                const response = await fetch("/api/legal-drawings/instantiate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pdNumber: form.pdNumber.trim(),
                        revision: form.legalRevision.trim(),
                        name: form.name.trim(),
                        unitNumber: form.unitNumber.trim() || null,
                        lwcType: form.lwcType || null,
                        dueDate: form.dueDate || null,
                        planConlayDate: form.planConlayDate || null,
                        planConassyDate: form.planConassyDate || null,
                        shipDate: form.shipDate || null,
                        color: form.color,
                        actorBadge: user?.badge || null,
                        actorShift: user?.currentShift || null,
                    }),
                });

                if (!response.ok) {
                    throw new Error("Failed to create project from legal package.");
                }

                const payload = await response.json() as { manifest?: ProjectManifest };
                if (!payload.manifest) {
                    throw new Error("Project was created but response did not include a manifest.");
                }

                saveProject(payload.manifest);
                await uploadLegalFilesForProject({
                    projectId: payload.manifest.id,
                    pdNumber: form.pdNumber.trim() || payload.manifest.pdNumber || "",
                    revision: form.legalRevision.trim() || payload.manifest.revision || "UPLOADED",
                });
                onCreated?.(payload.manifest.id);

                setForm({ ...DEFAULT_FORM });
                setWorkbookFile(null);
                setLayoutPdfFile(null);
                setOpen(false);
                return;
            }

            // Build a minimal ProjectModel for a pre-legals project
            const now = new Date();
            const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            const model: ProjectModel = {
                id: projectId,
                filename: `${form.name.trim()}.xlsx`,
                name: form.name.trim(),
                pdNumber: form.pdNumber.trim() || undefined,
                unitNumber: form.unitNumber.trim() || undefined,
                revision: form.revision.trim() || undefined,
                lwcType: (form.lwcType as LwcType) || undefined,
                dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
                planConlayDate: form.planConlayDate ? new Date(form.planConlayDate) : undefined,
                planConassyDate: form.planConassyDate ? new Date(form.planConassyDate) : undefined,
                shipDate: form.shipDate ? new Date(form.shipDate) : undefined,
                color: form.color,
                sheets: [],
                sheetData: {},
                createdAt: now,
                warnings: [],
                status: "legals_pending",
                lifecycleGates: [
                    { gateId: "LEGALS_READY", status: "LOCKED" },
                    { gateId: "BRANDLIST_COMPLETE", status: "LOCKED" },
                    { gateId: "BRANDING_READY", status: "LOCKED" },
                    { gateId: "KITTING_READY", status: "LOCKED" },
                ],
            };

            // Simulate slight delay for UX
            await new Promise(r => setTimeout(r, 400));

            const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectModel: model }),
            });
            if (!response.ok) {
                throw new Error("Failed to create manual placeholder project.");
            }

            const payload = await response.json() as { manifest?: ProjectManifest };
            if (!payload.manifest) {
                throw new Error("Project was created but response did not include a manifest.");
            }

            saveProject(payload.manifest);
            await uploadLegalFilesForProject({
                projectId: payload.manifest.id,
                pdNumber: form.pdNumber.trim() || payload.manifest.pdNumber || "",
                revision: form.revision.trim() || payload.manifest.revision || "UPLOADED",
            });
            onCreated?.(payload.manifest.id);

            setForm({ ...DEFAULT_FORM });
            setWorkbookFile(null);
            setLayoutPdfFile(null);
            setOpen(false);
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : "Unable to create project.");
        } finally {
            setCreating(false);
        }
    }, [form, isValid, onCreated, saveProject, uploadLegalFilesForProject, user?.badge, user?.currentShift]);

    const handleOpenChange = useCallback((next: boolean) => {
        if (!isControlled) {
            setInternalOpen(next);
        }
        onOpenChange?.(next);
        if (!next) {
            setForm(buildDefaultForm());
            setWorkbookFile(null);
            setLayoutPdfFile(null);
            setCreateError(null);
        }
    }, [buildDefaultForm, isControlled, onOpenChange]);

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(prev => ({
            ...prev,
            sourceMode: initialValues?.sourceMode ?? prev.sourceMode,
            name: initialValues?.name ?? prev.name,
            unitNumber: initialValues?.unitNumber ?? prev.unitNumber,
        }));
    }, [initialValues?.name, initialValues?.sourceMode, initialValues?.unitNumber, open]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {trigger !== null ? (
                <DialogTrigger asChild>
                    {trigger ?? (
                        <Button size="sm" className={cn("gap-1.5", className)}>
                            <Plus className="h-4 w-4" />
                            New Project
                        </Button>
                    )}
                </DialogTrigger>
            ) : null}

            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden p-0 sm:max-h-[92vh]">
                <DialogHeader className="border-b border-border px-4 py-4 sm:px-6">
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="h-5 w-5 text-muted-foreground" />
                        {dialogTitle}
                    </DialogTitle>
                    <DialogDescription>
                        {dialogDescription}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[calc(92vh-13rem)] overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
                <div className="grid gap-4">
                    {/* Project Name */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-medium">Source</Label>
                        <Select
                            value={form.sourceMode}
                            onValueChange={value => updateField("sourceMode", value as CreateProjectForm["sourceMode"])}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="legal-library">Create From Legal Package</SelectItem>
                                <SelectItem value="manual">Create Manual Placeholder</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {form.sourceMode === "legal-library" ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-medium">PD Number</Label>
                                <Select
                                    value={form.pdNumber}
                                    onValueChange={value => {
                                        const nextProject = legalProjects.find(project => project.pdNumber === value) ?? null;
                                        setForm(prev => ({
                                            ...prev,
                                            pdNumber: value,
                                            legalRevision: getPreferredRevision(nextProject),
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder={loadingLegalProjects ? "Loading legal packages..." : "Select PD#"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {legalProjects.map(project => (
                                            <SelectItem key={project.pdNumber} value={project.pdNumber}>
                                                {getLegalProjectOptionLabel(project)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-medium">Revision</Label>
                                <Select
                                    value={form.legalRevision}
                                    onValueChange={value => updateField("legalRevision", value)}
                                    disabled={!selectedLegalProject}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select revision..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getManifestReadyRevisions(selectedLegalProject).map(revision => (
                                            <SelectItem key={revision} value={revision}>
                                                {revision}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : null}

                    <div className="grid gap-1.5">
                        <Label htmlFor="project-name" className="text-xs font-medium">
                            Project Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="project-name"
                            placeholder="e.g. MER-SOL, TRP-NAU"
                            value={form.name}
                            onChange={e => updateField("name", e.target.value)}
                            className="h-9"
                            autoFocus
                        />
                    </div>

                    {/* PD Number + Unit + Revision (row) */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="pd-number" className="text-xs font-medium">PD Number</Label>
                            <Input
                                id="pd-number"
                                placeholder="4M371"
                                value={form.pdNumber}
                                onChange={e => updateField("pdNumber", e.target.value.toUpperCase().slice(0, 5))}
                                className="h-9 font-mono"
                                maxLength={5}
                                disabled={form.sourceMode === "legal-library"}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="unit-number" className="text-xs font-medium">Unit</Label>
                            <Input
                                id="unit-number"
                                placeholder="1"
                                value={form.unitNumber}
                                onChange={e => updateField("unitNumber", e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="revision" className="text-xs font-medium">Revision</Label>
                            <Input
                                id="revision"
                                placeholder="B.1"
                                value={form.sourceMode === "legal-library" ? form.legalRevision : form.revision}
                                onChange={e => updateField("revision", e.target.value)}
                                className="h-9 font-mono"
                                disabled={form.sourceMode === "legal-library"}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="grid gap-3">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                            Upload Sheet / Wire List (Optional)
                        </Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="workbook-upload" className="text-xs font-medium">Workbook (.xlsx/.xls)</Label>
                                <Input
                                    id="workbook-upload"
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="h-9"
                                    onChange={e => setWorkbookFile(e.target.files?.[0] ?? null)}
                                />
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {workbookFile ? workbookFile.name : "No workbook selected"}
                                </p>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="layout-upload" className="text-xs font-medium">Wire List / Layout PDF (.pdf)</Label>
                                <Input
                                    id="layout-upload"
                                    type="file"
                                    accept=".pdf"
                                    className="h-9"
                                    onChange={e => setLayoutPdfFile(e.target.files?.[0] ?? null)}
                                />
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {layoutPdfFile ? layoutPdfFile.name : "No PDF selected"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* LWC Type */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-medium">LWC Type</Label>
                        <Select
                            value={form.lwcType}
                            onValueChange={v => updateField("lwcType", v as LwcType)}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select LWC type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(LWC_TYPE_REGISTRY).map(lwc => (
                                    <SelectItem key={lwc.id} value={lwc.id}>
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

                    <Separator />

                    {/* Dates */}
                    <div className="grid gap-3">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            Planning Dates
                        </Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <DateField
                                mode="create"
                                label="Due Date"
                                value={parseDateString(form.dueDate)}
                                onChange={date => updateField("dueDate", formatDateToString(date))}
                            />
                            <DateField
                                mode="create"
                                label="Plan ConLay"
                                value={parseDateString(form.planConlayDate)}
                                onChange={date => updateField("planConlayDate", formatDateToString(date))}
                            />
                            <DateField
                                mode="create"
                                label="Plan ConAssy"
                                value={parseDateString(form.planConassyDate)}
                                onChange={date => updateField("planConassyDate", formatDateToString(date))}
                            />
                            <DateField
                                mode="create"
                                label="Ship Date"
                                value={parseDateString(form.shipDate)}
                                onChange={date => updateField("shipDate", formatDateToString(date))}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Color */}
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                            Project Color
                        </Label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {COLOR_PRESETS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    className={cn(
                                        "h-6 w-6 rounded-full border-2 transition-all",
                                        form.color === color
                                            ? "border-foreground scale-110 shadow-sm"
                                            : "border-transparent hover:border-muted-foreground/30",
                                    )}
                                    style={{ backgroundColor: color }}
                                    onClick={() => updateField("color", color)}
                                />
                            ))}
                        </div>
                    </div>
                    {createError ? (
                        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {createError}
                        </div>
                    ) : null}
                </div>
                    </div>

                    <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                        <Badge variant="outline" className="text-[10px] text-muted-foreground mr-auto">
                            Legals not required
                        </Badge>
                            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={creating} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                            <Button onClick={handleCreate} disabled={!isValid || creating} className="w-full gap-1.5 sm:w-auto">
                            {creating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FolderPlus className="h-4 w-4" />
                            )}
                            {creating ? "Creating..." : "Create Project"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
