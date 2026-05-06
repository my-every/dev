"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { FileStack, FileSpreadsheet, FileImage, RefreshCw, Layers, Clock3, ChevronDown, WandSparkles, Printer, FileOutput } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { LegalProjectRecord } from "@/types/legal-drawings";
import { LegalCreateSplitActionButton } from "@/components/projects/legal-create-split-action-button";
import { LayoutSplitActionButton } from "@/components/projects/layout-split-action-button";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

export function LegalDrawingsLibraryPanel() {
    const { toast } = useToast();
    const [query, setQuery] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [rebuildingPd, setRebuildingPd] = useState<string | null>(null);
    const [bulkRunning, setBulkRunning] = useState<string | null>(null);
    const { data, isLoading, mutate } = useSWR<{ projects?: LegalProjectRecord[] }>("/api/legal-drawings", fetcher);

    const projects = data?.projects ?? [];
    const filteredProjects = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return projects;
        return projects.filter(project =>
            project.pdNumber.toLowerCase().includes(normalized)
            || (project.projectNameHint ?? "").toLowerCase().includes(normalized),
        );
    }, [projects, query]);

    const handleSync = useCallback(async () => {
        setSyncing(true);
        try {
            const response = await fetch("/api/legal-drawings/sync", { method: "POST" });
            const payload = await response.json() as { projectCount?: number; error?: string };
            if (!response.ok) {
                throw new Error(payload.error || "Failed to sync legal drawings library");
            }
            await mutate();
            toast({
                title: "Legal library synced",
                description: `Processed ${payload.projectCount ?? 0} PD packages.`,
                duration: 3000,
            });
        } catch (error) {
            toast({
                title: "Legal sync failed",
                description: error instanceof Error ? error.message : "Unable to sync legal library",
                duration: 4000,
            });
        } finally {
            setSyncing(false);
        }
    }, [mutate, toast]);

    const ensureWorkspaceProject = useCallback(async (pdNumber: string, revision: string) => {
        const response = await fetch("/api/legal-drawings/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdNumber, revision }),
        });
        const payload = await response.json().catch(() => ({})) as {
            error?: string;
            projectId?: string;
            operationalSheets?: Array<{ slug: string; name: string }>;
        };

        if (!response.ok || !payload.projectId) {
            throw new Error(payload.error || `Failed to prepare workspace for ${pdNumber}.`);
        }

        return payload;
    }, []);

    const handleRebuild = useCallback(async (project: LegalProjectRecord) => {
        const revision = project.latestRevision;
        if (!revision || rebuildingPd) {
            return;
        }

        setRebuildingPd(project.pdNumber);
        try {
            const response = await fetch(`/api/legal-drawings/${encodeURIComponent(project.pdNumber)}/rebuild`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ revision }),
            });
            const payload = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) {
                throw new Error(payload.error || `Could not rebuild ${project.pdNumber} ${revision}.`);
            }
            await mutate();
            toast({
                title: "Revision rebuilt",
                description: `${project.pdNumber} ${revision} was refreshed.`,
                duration: 3000,
            });
        } catch (error) {
            toast({
                title: "Rebuild failed",
                description: error instanceof Error ? error.message : `Could not rebuild ${project.pdNumber}.`,
                duration: 4000,
            });
        } finally {
            setRebuildingPd(null);
        }
    }, [mutate, rebuildingPd, toast]);

    const runBulkAction = useCallback(async (
        action: "rebuild" | "wire-list-pdfs" | "brand-list-workbooks",
    ) => {
        const candidates = filteredProjects.filter(project => project.latestRevision);
        if (candidates.length === 0) {
            toast({
                title: "No legal packages ready",
                description: "No visible packages have a latest revision yet.",
                duration: 3000,
            });
            return;
        }

        setBulkRunning(action);
        let successCount = 0;
        let failureCount = 0;

        for (const project of candidates) {
            try {
                if (action === "rebuild") {
                    const response = await fetch(`/api/legal-drawings/${encodeURIComponent(project.pdNumber)}/rebuild`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ revision: project.latestRevision }),
                    });
                    if (!response.ok) {
                        const payload = await response.json().catch(() => ({})) as { error?: string };
                        throw new Error(payload.error || `Failed to rebuild ${project.pdNumber}.`);
                    }
                } else {
                    const workspace = await ensureWorkspaceProject(project.pdNumber, project.latestRevision!);
                    const projectId = workspace.projectId!;

                    if (action === "wire-list-pdfs") {
                        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=wire-lists`, {
                            method: "POST",
                        });
                        if (!response.ok) {
                            const payload = await response.json().catch(() => ({})) as { error?: string };
                            throw new Error(payload.error || `Failed to generate wire list PDFs for ${project.pdNumber}.`);
                        }
                    } else {
                        const approvedSheetSlugs = (workspace.operationalSheets ?? []).map(sheet => sheet.slug);
                        if (approvedSheetSlugs.length === 0) {
                            throw new Error(`No operational sheets found for ${project.pdNumber}.`);
                        }

                        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/export`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ approvedSheetSlugs }),
                        });
                        if (!response.ok) {
                            const payload = await response.json().catch(() => ({})) as { error?: string };
                            throw new Error(payload.error || `Failed to generate brand workbook for ${project.pdNumber}.`);
                        }
                    }
                }

                successCount += 1;
            } catch (error) {
                failureCount += 1;
                console.error("[legal-library] bulk action failed", {
                    action,
                    pdNumber: project.pdNumber,
                    error,
                });
            }
        }

        await mutate();
        toast({
            title:
                action === "rebuild"
                    ? "Bulk rebuild complete"
                    : action === "wire-list-pdfs"
                        ? "Wire list printouts generated"
                        : "Brand workbooks generated",
            description: `${successCount} succeeded${failureCount ? `, ${failureCount} failed` : ""}.`,
            duration: 4000,
        });
        setBulkRunning(null);
    }, [ensureWorkspaceProject, filteredProjects, mutate, toast]);

    const readyCount = projects.filter(project => project.hasWorkbook || project.hasLayout).length;

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid gap-3 sm:grid-cols-3">
                    <LibrarySummaryCard label="PD Packages" value={projects.length} icon={FileStack} />
                    <LibrarySummaryCard label="Ready Sources" value={readyCount} icon={Layers} />
                    <LibrarySummaryCard
                        label="Latest Revisions"
                        value={projects.filter(project => project.latestRevision).length}
                        icon={Clock3}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search PD# or package name..."
                        className="sm:w-72"
                    />
                    <Popover>
                        <div className="inline-flex items-center rounded-lg border border-border/60 bg-background shadow-sm">
                            <Button variant="ghost" onClick={handleSync} disabled={syncing} className="rounded-r-none border-r border-border/50">
                                <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                                Sync Library
                            </Button>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="rounded-l-none px-2.5">
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                        </div>
                        <PopoverContent align="end" className="w-88 overflow-hidden rounded-2xl border-border/60 p-0">
                            <div className="border-b border-border/50 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Maintenance</p>
                                <p className="mt-1 text-sm font-medium">Run library maintenance tasks</p>
                            </div>
                            <div className="space-y-2 p-3">
                                <ActionCard
                                    title="Sync library"
                                    description="Refresh legal packages from the source legal drawings directory."
                                    icon={<RefreshCw className="h-4 w-4" />}
                                    onClick={() => void handleSync()}
                                    disabled={syncing}
                                />
                                <ActionCard
                                    title="Rebuild visible packages"
                                    description="Regenerate manifests, layout metadata, and schema artifacts for the currently visible packages."
                                    icon={<WandSparkles className="h-4 w-4" />}
                                    onClick={() => void runBulkAction("rebuild")}
                                    disabled={bulkRunning !== null}
                                />
                                <ActionCard
                                    title="Generate all wire list printouts"
                                    description="Create wire list PDF printouts for every visible legal package."
                                    icon={<Printer className="h-4 w-4" />}
                                    onClick={() => void runBulkAction("wire-list-pdfs")}
                                    disabled={bulkRunning !== null}
                                />
                                <ActionCard
                                    title="Generate multi-sheet brand lists"
                                    description="Bypass approval and export the combined brand list workbook for every visible package."
                                    icon={<FileOutput className="h-4 w-4" />}
                                    onClick={() => void runBulkAction("brand-list-workbooks")}
                                    disabled={bulkRunning !== null}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Card key={index} className="rounded-3xl border-border/60">
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-5 w-28" />
                                <Skeleton className="h-4 w-40" />
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-9 w-40" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredProjects.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-border/60 bg-card/40">
                    <CardContent className="py-12 text-center">
                        <p className="text-base font-semibold">No legal packages found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Sync the Legal Drawings library or adjust your search to browse PD packages before creating projects.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredProjects.map(project => (
                        (() => {
                            const latestRevisionRecord =
                                project.revisions.find(revision => revision.revision === project.latestRevision)
                                ?? project.revisions[project.revisions.length - 1];
                            const artifactStatus = latestRevisionRecord?.artifacts;
                            const createReady = Boolean(artifactStatus?.manifestBuilt);
                            const sheetReady = Boolean(artifactStatus?.sheetSchemasBuilt);
                            const layoutWorkspaceReady = Boolean(artifactStatus?.layoutPagesBuilt);
                            const layoutDownloadReady = Boolean(artifactStatus?.layoutPresent);
                            const wirePrintReady = Boolean(artifactStatus?.wireListPrintSchemaPrepared);
                            const brandReady = Boolean(artifactStatus?.brandListSchemaPrepared);
                            const isRebuilding = rebuildingPd === project.pdNumber;

                            return (
                        <Card key={project.pdNumber} className="rounded-none border-border/60 gap-0 bg-card/70">
                            <CardHeader className="pb-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-2xl">{project.pdNumber}</CardTitle>
                                        <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handleRebuild(project)}
                                        disabled={!project.latestRevision || isRebuilding}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${isRebuilding ? "animate-spin" : ""}`} />
                                    </Button>
                                    </div>
                                    <Badge variant="outline">{project.latestRevision || "Imported"}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <StatusCell label="UCP" active={sheetReady} icon={FileSpreadsheet} />
                                    <StatusCell label="LAY" active={layoutWorkspaceReady} icon={FileImage} />
                                    <div className="rounded-2xl border border-border/60 p-3">
                                        <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Revisions</p>
                                        <p className="mt-1 text-md font-semibold tabular-nums">{project.revisions.length}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 p-3">
                                        <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Latest</p>
                                        <p className="mt-1 text-md font-semibold">{project.latestRevision || "-"}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center min-w-max gap-2">
                                    <LegalCreateSplitActionButton
                                        pdNumber={project.pdNumber}
                                        revision={project.latestRevision}
                                        disabled={!project.latestRevision || !createReady}
                                    />
                                    <LayoutSplitActionButton
                                        endpoint={
                                            project.latestRevision
                                                ? `/api/legal-drawings/${encodeURIComponent(project.pdNumber)}/layout-pdf?revision=${encodeURIComponent(project.latestRevision)}`
                                                : null
                                        }
                                        pdNumber={project.pdNumber}
                                        revision={project.latestRevision}
                                        canOpenLayout={layoutWorkspaceReady}
                                        canDownloadLayout={layoutDownloadReady}
                                        canOpenWireList={sheetReady}
                                        canOpenWirePrint={wirePrintReady}
                                        canOpenBrandList={brandReady}
                                        disabled={
                                            !project.latestRevision
                                            || (!layoutWorkspaceReady && !sheetReady && !wirePrintReady && !brandReady)
                                        }
                                        label="Open"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                            );
                        })()
                    ))}
                </div>
            )}
        </div>
    );
}

function ActionCard({
    title,
    description,
    icon,
    onClick,
    disabled,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            className={cn(
                "w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50",
            )}
            onClick={onClick}
            disabled={disabled}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full border border-border/50 p-2 text-muted-foreground">{icon}</div>
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
        </button>
    );
}

function LibrarySummaryCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number;
    icon: typeof FileStack;
}) {
    return (
        <Card className="rounded-3xl border-border/60 py-0 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-background/60">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function StatusCell({
    label,
    active,
    icon: Icon,
}: {
    label: string;
    active: boolean;
    icon: typeof FileStack;
}) {
    return (
        <div className="rounded-2xl border border-border/60 p-3">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            </div>
            <p className="mt-2 text-sm font-medium">{active ? "Present" : "Missing"}</p>
        </div>
    );
}
