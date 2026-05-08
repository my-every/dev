"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
    Plus,
    Loader2,
    FolderPlus,
    Calendar,
    FileSpreadsheet,
    Palette,
    Upload,
    File,
    X,
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
    trigger?: React.ReactNode;
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
        .filter(revision => Boolean(revision?.files?.manifestBuilt))
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
    if (!hint || hint.toUpperCase() === pd.toUpperCase()) return pd;
    return `${pd} - ${hint}`;
}

// ============================================================================
// FileUploadInput
// ============================================================================

function FileUploadInput({
    id,
    label,
    accept,
    file,
    onChange,
}: {
    id: string;
    label: string;
    accept: string;
    file: File | null;
    onChange: (file: File | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
            <div
                className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors hover:bg-muted/40",
                    file ? "border-border bg-muted/20" : "border-border text-muted-foreground",
                )}
                onClick={() => inputRef.current?.click()}
            >
                {file ? (
                    <>
                        <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                            {file.name}
                        </span>
                        <button
                            type="button"
                            className="ml-auto shrink-0 rounded p-0.5 hover:bg-muted"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(null);
                                if (inputRef.current) inputRef.current.value = "";
                            }}
                        >
                            <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                    </>
                ) : (
                    <>
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">Choose file…</span>
                    </>
                )}
            </div>
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept={accept}
                className="sr-only"
                onChange={e => onChange(e.target.files?.[0] ?? null)}
            />
        </div>
    );
}

// ============================================================================
// FormSection
// ============================================================================

function FormSection({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-3">
            <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {title}
                </span>
            </div>
            {children}
        </div>
    );
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
    dialogTitle = "Create Project Instance",
    dialogDescription = "Create a new project instance from legal drawings or manual input.",
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
                if (!cancelled) setLoadingLegalProjects(false);
            });

        return () => { cancelled = true; };
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
        if (!workbookFile && !layoutPdfFile) return;

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
            if (refreshedPayload.manifest) saveProject(refreshedPayload.manifest);
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

                if (!response.ok) throw new Error("Failed to create project from legal package.");

                const payload = await response.json() as { manifest?: ProjectManifest };
                if (!payload.manifest) throw new Error("Project was created but response did not include a manifest.");

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
                handleOpenChange(false);
                return;
            }

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

            await new Promise(r => setTimeout(r, 400));

            const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectModel: model }),
            });
            if (!response.ok) throw new Error("Failed to create manual placeholder project.");

            const payload = await response.json() as { manifest?: ProjectManifest };
            if (!payload.manifest) throw new Error("Project was created but response did not include a manifest.");

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
            handleOpenChange(false);
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : "Unable to create project.");
        } finally {
            setCreating(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, isValid, onCreated, saveProject, uploadLegalFilesForProject, user?.badge, user?.currentShift]);

    const handleOpenChange = useCallback((next: boolean) => {
        if (!isControlled) setInternalOpen(next);
        onOpenChange?.(next);
        if (!next) {
            setForm(buildDefaultForm());
            setWorkbookFile(null);
            setLayoutPdfFile(null);
            setCreateError(null);
        }
    }, [buildDefaultForm, isControlled, onOpenChange]);

    useEffect(() => {
        if (!open) return;
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

            <DialogContent className="flex h-[90dvh] max-h-[720px] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
                {/* Header */}
                <DialogHeader className="shrink-0 border-b px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-muted p-1.5">
                            <FolderPlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-sm font-semibold leading-tight">
                                {dialogTitle}
                            </DialogTitle>
                            <DialogDescription className="mt-0.5 text-xs leading-snug">
                                {dialogDescription}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Scrollable body */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="grid gap-5">

                        {/* Source + Legal selectors */}
                        <div className="grid gap-3">
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
                                        <SelectItem value="legal-library">Create Project Unit</SelectItem>
                                        <SelectItem value="manual">Create Upcoming Project</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {form.sourceMode === "legal-library" ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-medium">PD Number</Label>
                                        <Select
                                            value={form.pdNumber}
                                            onValueChange={value => {
                                                const nextProject = legalProjects.find(p => p.pdNumber === value) ?? null;
                                                setForm(prev => ({
                                                    ...prev,
                                                    pdNumber: value,
                                                    legalRevision: getPreferredRevision(nextProject),
                                                }));
                                            }}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder={loadingLegalProjects ? "Loading…" : "Select PD#"} />
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
                                                <SelectValue placeholder="Select revision…" />
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
                        </div>

                        <Separator />

                        {/* Project identity */}
                        <div className="grid gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="project-name" className="text-xs font-medium">
                                    Project Name <span className="text-destructive">*</span>
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

                            <div className="grid grid-cols-3 gap-3">
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
                        </div>

                        <Separator />

                        {/* Upload */}
                        <FormSection icon={FileSpreadsheet} title="Upload Sheet / Wire List (Optional)">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FileUploadInput
                                    id="workbook-upload"
                                    label="Workbook (.xlsx / .xls)"
                                    accept=".xlsx,.xls"
                                    file={workbookFile}
                                    onChange={setWorkbookFile}
                                />
                                <FileUploadInput
                                    id="layout-upload"
                                    label="Wire List / Layout PDF (.pdf)"
                                    accept=".pdf"
                                    file={layoutPdfFile}
                                    onChange={setLayoutPdfFile}
                                />
                            </div>
                        </FormSection>

                        <Separator />

                        {/* LWC Type */}
                        <div className="grid gap-1.5">
                            <Label className="text-xs font-medium">LWC Type</Label>
                            <Select
                                value={form.lwcType}
                                onValueChange={v => updateField("lwcType", v as LwcType)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select LWC type…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.values(LWC_TYPE_REGISTRY).map(lwc => (
                                        <SelectItem key={lwc.id} value={lwc.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: lwc.dotColor }} />
                                                {lwc.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator />

                        {/* Planning Dates */}
                        <FormSection icon={Calendar} title="Planning Dates">
                            <div className="grid grid-cols-2 gap-3">
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
                        </FormSection>

                        <Separator />

                        {/* Color */}
                        <FormSection icon={Palette} title="Project Color">
                            <div className="flex flex-wrap items-center gap-2">
                                {COLOR_PRESETS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn(
                                            "h-6 w-6 rounded-full border-2 transition-all",
                                            form.color === color
                                                ? "scale-110 border-foreground shadow-sm"
                                                : "border-transparent hover:border-muted-foreground/30",
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => updateField("color", color)}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={form.color}
                                    onChange={e => updateField("color", e.target.value)}
                                    className="h-6 w-6 cursor-pointer rounded-full border-2 border-transparent bg-transparent p-0"
                                    title="Custom color"
                                />
                            </div>
                        </FormSection>

                        {createError ? (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                {createError}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="shrink-0 border-t px-8 py-3 pb-8">
                    <div className="flex w-full items-center gap-2">
                        <Badge variant="outline" className="mr-auto text-[10px] text-muted-foreground">
                            Legals not required
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenChange(false)}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            disabled={!isValid || creating}
                            className="gap-1.5"
                        >
                            {creating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FolderPlus className="h-3.5 w-3.5" />
                            )}
                            {creating ? "Creating…" : "Create Project"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
