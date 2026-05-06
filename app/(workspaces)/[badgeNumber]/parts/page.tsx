"use client";

import { use, useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, LibraryBig } from "lucide-react";

import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import { PageContent } from "@/components/layout/page-content";
import {
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    PartDetailModal,
    PartsCollection,
    PartsMetricGrid,
    PartsWorkspaceSidePanelNav,
    type WorkspacePartRecord,
    buildWorkspacePartRecord,
    normalizePartLabel,
} from "@/app/(workspaces)/[badgeNumber]/parts/_components";
import type { PartCatalogRecord } from "@/types/d380-catalog";
import type { PartRecord } from "@/types/parts-library";

type PartsWorkspacePageProps = {
    params: Promise<{
        badgeNumber: string;
    }>;
};

type LoadState = "loading" | "ready" | "error";

type PartsResponse = {
    parts?: PartRecord[];
    total?: number;
};

type CatalogLibraryResponse = {
    entries?: Record<string, PartCatalogRecord>;
};

type PartStacksManifestResponse = {
    totalStacks?: number;
};

export default function PartsWorkspacePage({ params: paramsPromise }: PartsWorkspacePageProps) {
    const params = use(paramsPromise);
    const [parts, setParts] = useState<WorkspacePartRecord[]>([]);
    const [selectedPart, setSelectedPart] = useState<WorkspacePartRecord | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [stackCount, setStackCount] = useState(0);
    const [state, setState] = useState<LoadState>("loading");
    const [error, setError] = useState<string | null>(null);
    const [section, setSection] = useState<"summary" | "library">("summary");

    useEffect(() => {
        let mounted = true;

        async function loadPartsWorkspace() {
            setState("loading");
            setError(null);

            try {
                const [partsResponse, catalogResponse, stacksResponse] = await Promise.all([
                    fetch("/api/parts?limit=2000", { cache: "no-store" }),
                    fetch("/api/parts/catalog?full=true", { cache: "no-store" }),
                    fetch("/api/parts/stacks?manifest=true", { cache: "no-store" }),
                ]);

                if (!partsResponse.ok) {
                    throw new Error("Failed to load parts library");
                }

                const [partsPayload, catalogPayload, stacksPayload] = await Promise.all([
                    partsResponse.json(),
                    catalogResponse.ok ? catalogResponse.json() : Promise.resolve({ entries: {} }),
                    stacksResponse.ok ? stacksResponse.json() : Promise.resolve({ totalStacks: 0 }),
                ]);

                if (!mounted) {
                    return;
                }

                // Deduplicate by partNumber — the API can return the same partNumber
                // across multiple records (e.g., different lifecycle stages). Keep the
                // first occurrence so keys stay stable across refreshes.
                const seenPartNumbers = new Set<string>();
                const rawParts = ((partsPayload as PartsResponse).parts ?? [])
                    .sort((left, right) => left.partNumber.localeCompare(right.partNumber))
                    .filter((part) => {
                        if (seenPartNumbers.has(part.partNumber)) return false;
                        seenPartNumbers.add(part.partNumber);
                        return true;
                    });

                const catalogEntries = (catalogPayload as CatalogLibraryResponse).entries ?? {};
                const mergedParts = rawParts.map((part) =>
                    buildWorkspacePartRecord(part, catalogEntries[part.partNumber] ?? null),
                );

                setParts(mergedParts);
                setSelectedPart((current) => mergedParts.find((entry) => entry.part.partNumber === current?.part.partNumber) ?? current ?? null);
                setStackCount((stacksPayload as PartStacksManifestResponse).totalStacks ?? 0);
                setState("ready");
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : "Failed to load parts library");
                setState("error");
            }
        }

        void loadPartsWorkspace();

        return () => {
            mounted = false;
        };
    }, []);

    const mode: ViewMode = state === "loading" ? "skeleton" : "dynamic";
    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Workspace",
                items: [
                    {
                        id: "workspace-home",
                        label: "Workspace Home",
                        href: `/${params.badgeNumber}`,
                        keywords: ["workspace", "home"],
                    },
                    {
                        id: "parts-root",
                        label: "Parts",
                        href: `/${params.badgeNumber}/parts`,
                        keywords: ["parts", "catalog", "library"],
                    },
                ],
            },
            {
                heading: "Parts",
                items: parts.slice(0, 20).map((entry) => ({
                    id: `part-${entry.part.partNumber}`,
                    label: entry.title,
                    description: `${entry.part.partNumber} • ${normalizePartLabel(entry.part.type)}`,
                    href: `/${params.badgeNumber}/parts/${encodeURIComponent(entry.part.partNumber)}`,
                    keywords: [
                        entry.part.partNumber,
                        entry.title,
                        entry.part.description,
                        entry.part.manufacturer ?? "",
                        entry.part.type,
                        entry.part.category,
                    ],
                })),
            },
        ],
        [params.badgeNumber, parts],
    );

    const metrics = useMemo(() => {
        const uniqueCategories = new Set(parts.map((entry) => entry.part.category)).size;
        const catalogEnriched = parts.filter((entry) => entry.catalog).length;
        const photoCoverage = parts.filter((entry) => entry.hasPhotos).length;

        return {
            totalParts: parts.length,
            totalCategories: uniqueCategories,
            catalogEnriched,
            photoCoverage,
        };
    }, [parts]);
    const topTypes = useMemo(() => {
        const counts = new Map<string, number>();
        for (const entry of parts) {
            const key = normalizePartLabel(entry.part.type);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
    }, [parts]);

    async function handleSaveCatalog(partNumber: string, catalog: PartCatalogRecord) {
        const response = await fetch(`/api/parts/catalog/${encodeURIComponent(partNumber)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(catalog),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { record?: PartCatalogRecord };
        const nextRecord = payload.record ?? catalog;
        setParts((prev) =>
            prev.map((entry) =>
                entry.part.partNumber === partNumber
                    ? buildWorkspacePartRecord(entry.part, nextRecord)
                    : entry,
            ),
        );
        setSelectedPart((prev) => (prev && prev.part.partNumber === partNumber ? buildWorkspacePartRecord(prev.part, nextRecord) : prev));
    }

    async function handleDeleteCatalog(partNumber: string) {
        await fetch(`/api/parts/catalog/${encodeURIComponent(partNumber)}`, { method: "DELETE" });
        setParts((prev) =>
            prev.map((entry) =>
                entry.part.partNumber === partNumber
                    ? buildWorkspacePartRecord(entry.part, null)
                    : entry,
            ),
        );
        setSelectedPart((prev) => (prev && prev.part.partNumber === partNumber ? buildWorkspacePartRecord(prev.part, null) : prev));
    }

    return (
        <PageContent
            title="Parts"
            subtitle="Parts workspace"
            variant="wide"
            showPanel={true}
            showAside={false}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search parts, manufacturers, categories, or part numbers"
            sidePanel={
                <PartsWorkspaceSidePanelNav
                    mode={mode}
                    data={{
                        parts,
                        selectedPartNumber: selectedPart?.part.partNumber ?? null,
                        onSelectPart: (part) => {
                            setSelectedPart(part);
                            setDetailsOpen(true);
                        },
                    }}
                />
            }
            subHeader={
                <div className="flex flex-col gap-2 border border-border bg-card/60 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground sm:text-sm">Parts Browser</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                            Structured part records + catalog enrichment + reference photos.
                        </div>
                    </div>
                    <div className="w-fit rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground sm:px-3 sm:py-1 sm:text-xs">
                        {state === "loading" ? "Stacks loading" : `${stackCount} reusable stacks`}
                    </div>
                </div>
            }
        >
            <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 lg:p-6">
                {state === "error" ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive sm:rounded-2xl sm:p-4 sm:text-sm">
                        {error ?? "The parts library could not be loaded."}
                    </div>
                ) : null}

                <Tabs value={section} onValueChange={(value) => setSection(value as "summary" | "library")}>
                    <TabsList className="h-9 w-fit rounded-xl bg-muted/35 p-1 sm:h-10">
                        <TabsTrigger value="summary" className="h-7 rounded-lg px-2 text-xs sm:h-8 sm:px-3">
                            <BarChart3 className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
                            Summary
                        </TabsTrigger>
                        <TabsTrigger value="library" className="h-7 rounded-lg px-2 text-xs sm:h-8 sm:px-3">
                            <LibraryBig className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
                            Library
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {section === "summary" ? (
                    <div className="space-y-4">
                        <PartsMetricGrid mode={mode} data={metrics} />
                        <div className="grid gap-3 md:grid-cols-[1.25fr_1fr]">
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3 sm:p-4">
                                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">Type Distribution</div>
                                <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
                                    {mode === "skeleton" ? (
                                        Array.from({ length: 6 }).map((_, index) => (
                                            <div key={index} className="h-7 rounded-lg bg-muted/50 sm:h-8" />
                                        ))
                                    ) : (
                                        topTypes.map(([label, count]) => (
                                            <div key={label} className="flex items-center justify-between rounded-lg border border-border/60 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
                                                <span className="truncate">{label}</span>
                                                <span className="ml-2 shrink-0 font-medium">{count}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3 sm:p-4">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
                                    <Boxes className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    Quick Actions
                                </div>
                                <div className="mt-2 grid gap-1.5 sm:mt-3 sm:gap-2">
                                    <button
                                        type="button"
                                        className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-left text-xs hover:bg-accent/40 sm:px-3 sm:py-2 sm:text-sm"
                                        onClick={() => setSection("library")}
                                    >
                                        Open Parts Library
                                    </button>
                               
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {section === "library" ? (
                    <PartsCollection
                        parts={parts}
                        mode={mode}
                        selectedPartNumber={selectedPart?.part.partNumber ?? null}
                        onSelectPart={(part) => {
                            setSelectedPart(part);
                            setDetailsOpen(true);
                        }}
                    />
                ) : null}
            </div>
            <PartDetailModal
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                part={selectedPart}
                onSave={handleSaveCatalog}
                onDelete={handleDeleteCatalog}
            />
        </PageContent>
    );
}
