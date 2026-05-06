"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus, RefreshCw } from "lucide-react";

import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import { PageContent } from "@/components/layout/page-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DetailSectionCard,
    WorkspaceCollectionView,
    WorkspaceSidePanelHeader,
    type WorkspaceCollectionFilterDefinition,
    type WorkspaceCollectionItem,
    type WorkspaceCollectionTab,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import type { SwsLibraryManifest, SwsOperationRecord, SwsTemplateRecord, SwsUsageRecord } from "@/types/sws-library";

import { SWSWorkspaceSidePanelNav } from "./_components/sws-workspace-side-panel-nav";
import {
    buildWorkspaceSwsTemplateRecords,
    normalizeStageLabel,
    SWS_STAGE_OPTIONS,
    type WorkspaceSwsTemplateRecord,
} from "./_components/sws-types";

type Props = {
    params: Promise<{ badgeNumber: string }>;
};

type LoadState = "loading" | "ready" | "error";

type SwsDataBundle = {
    manifest: SwsLibraryManifest["templates"];
    templates: SwsTemplateRecord[];
    operations: SwsOperationRecord[];
    usage: SwsUsageRecord[];
};

function createEmptyTemplate(): SwsTemplateRecord {
    const now = new Date().toISOString();
    return {
        id: `sws-${Date.now()}`,
        name: "New SWS Template",
        description: "",
        kind: "custom",
        status: "draft",
        version: 1,
        versionLabel: "v1",
        tags: [],
        memberBadge: "",
        memberName: "",
        reviewCadenceDays: 30,
        groups: [
            {
                id: `group-${Date.now()}`,
                title: "Main Checklist",
                description: "Core standard work steps",
                order: 0,
                tasks: [],
            },
        ],
        createdAt: now,
        updatedAt: now,
    };
}

export default function SWSPage({ params: paramsPromise }: Props) {
    const params = use(paramsPromise);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [state, setState] = useState<LoadState>("loading");
    const [error, setError] = useState<string | null>(null);
    const [records, setRecords] = useState<WorkspaceSwsTemplateRecord[]>([]);

    const loadWorkspace = async () => {
        setState("loading");
        setError(null);
        try {
            const [manifestResponse, templatesResponse, operationsResponse, usageResponse] = await Promise.all([
                fetch("/api/sws/templates?manifest=true", { cache: "no-store" }),
                fetch("/api/sws/templates", { cache: "no-store" }),
                fetch("/api/sws/operations", { cache: "no-store" }),
                fetch("/api/sws/usage", { cache: "no-store" }),
            ]);

            if (!manifestResponse.ok || !templatesResponse.ok || !operationsResponse.ok || !usageResponse.ok) {
                throw new Error("Failed to load the SWS template library.");
            }

            const [manifestPayload, templatesPayload, operationsPayload, usagePayload] = (await Promise.all([
                manifestResponse.json(),
                templatesResponse.json(),
                operationsResponse.json(),
                usageResponse.json(),
            ])) as [
                SwsLibraryManifest,
                { templates?: SwsTemplateRecord[] },
                { operations?: SwsOperationRecord[] },
                { usage?: SwsUsageRecord[] },
            ];

            const nextRecords = buildWorkspaceSwsTemplateRecords({
                manifest: manifestPayload.templates ?? [],
                templates: templatesPayload.templates ?? [],
                operations: operationsPayload.operations ?? [],
                usage: usagePayload.usage ?? [],
            });

            setRecords(nextRecords);
            setState("ready");
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load SWS.");
            setState("error");
        }
    };

    useEffect(() => {
        void loadWorkspace();
    }, []);

    const contextProjectId = searchParams.get("projectId") ?? "";
    const contextSheetSlug = searchParams.get("sheetSlug") ?? "";
    const hasAssignmentContext = contextProjectId.length > 0 && contextSheetSlug.length > 0;

    const openAssignmentSws = (mode: "PRINT_MANUAL" | "TABLET_INTERACTIVE") => {
        if (!hasAssignmentContext) return;
        const next = new URLSearchParams();
        next.set("section", "summary");
        next.set("action", "sws");
        next.set("swsSheetSlug", contextSheetSlug);
        next.set("swsMode", mode);
        router.push(`/${params.badgeNumber}/projects/${encodeURIComponent(contextProjectId)}?${next.toString()}`);
    };

    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Workspace",
                items: [
                    {
                        id: "workspace-home",
                        label: "Workspace",
                        href: `/${params.badgeNumber}`,
                        keywords: ["workspace", "home"],
                    },
                    {
                        id: "sws-root",
                        label: "SWS Workspace",
                        href: `/${params.badgeNumber}/sws`,
                        keywords: ["sws", "templates", "operations"],
                    },
                ],
            },
            {
                heading: "Templates",
                items: records.slice(0, 20).map((record) => ({
                    id: `sws-${record.id}`,
                    label: record.template.name,
                    description: `${record.stageLabels.join(", ") || "No stage link"} • ${record.template.status}`,
                    href: `/${params.badgeNumber}/sws/${encodeURIComponent(record.id)}`,
                    keywords: [
                        record.id,
                        record.template.name,
                        record.template.description ?? "",
                        ...record.stageLabels,
                        ...record.template.tags,
                    ],
                })),
            },
        ],
        [params.badgeNumber, records],
    );

    const collectionTabs = useMemo<WorkspaceCollectionTab[]>(() => {
        const counts = new Map<string, number>();
        records.forEach((record) => {
            const stageIds = record.stageIds.length > 0 ? record.stageIds : ["unlinked"];
            stageIds.forEach((stageId) => counts.set(stageId, (counts.get(stageId) ?? 0) + 1));
        });

        return [
            { id: "all", label: "All", count: records.length },
            ...Array.from(counts.entries())
                .sort((left, right) => left[0].localeCompare(right[0]))
                .map(([stageId, count]) => ({
                    id: stageId,
                    label: stageId === "unlinked" ? "Unlinked" : normalizeStageLabel(stageId),
                    count,
                })),
        ];
    }, [records]);

    const collectionFilters = useMemo<WorkspaceCollectionFilterDefinition[]>(
        () => [
            {
                id: "status",
                label: "Status",
                options: [
                    { value: "active", label: "Active" },
                    { value: "draft", label: "Draft" },
                    { value: "archived", label: "Archived" },
                    { value: "deprecated", label: "Deprecated" },
                ],
            },
            {
                id: "kind",
                label: "Kind",
                options: [
                    { value: "standard", label: "Standard" },
                    { value: "custom", label: "Custom" },
                ],
            },
        ],
        [],
    );

    const collectionItems = useMemo<WorkspaceCollectionItem[]>(
        () =>
            records.map((record) => {
                // Normalize the template ID: replace underscores/hyphens with spaces, capitalize words
                const normalizedId = record.template.id
                    .replace(/[_-]+/g, " ")
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                return {
                    id: record.id,
                    title: record.template.name,
                    subtitle: `${normalizedId} • ${record.template.kind}`,
                    description: record.template.description || "Stage-attached checklist template",
                    badge: record.template.status,
                    href: `/${params.badgeNumber}/sws/${encodeURIComponent(record.id)}`,
                    icon: <FileText className="h-4 w-4 text-destructive sm:h-5 sm:w-5" />,
                    metadata: [
                        { label: "Stages", value: record.stageLabels.join(", ") || "Unlinked" },
                        { label: "Groups", value: `${record.summary.groupCount}` },
                        { label: "Tasks", value: `${record.summary.taskCount}` },
                        { label: "Operations", value: `${record.summary.operationCount}` },
                    ],
                    searchText: [
                        record.id,
                        record.template.name,
                        record.template.description,
                        record.template.kind,
                        record.template.status,
                        record.stageLabels.join(" "),
                        record.template.tags.join(" "),
                    ]
                        .filter(Boolean)
                        .join(" "),
                    filterValues: {
                        tab: record.stageIds.length > 0 ? record.stageIds : ["unlinked"],
                        status: record.template.status,
                        kind: record.template.kind,
                    },
                };
            }),
        [records, params.badgeNumber],
    );

    const metrics = useMemo(
        () => ({
            active: records.filter((record) => record.template.status === "active").length,
            drafts: records.filter((record) => record.template.status === "draft").length,
            linked: records.filter((record) => record.summary.operationCount > 0).length,
            stageLinked: records.filter((record) => record.stageIds.length > 0).length,
        }),
        [records],
    );

    const handleCreateTemplate = async () => {
        const template = createEmptyTemplate();
        await fetch("/api/sws/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(template),
        });
        await loadWorkspace();
        router.push(`/${params.badgeNumber}/sws/${encodeURIComponent(template.id)}`);
    };

    return (
        <PageContent
            title="SWS"
            subtitle="Stage-attached checklist"
            variant="compact"
            showPanel={true}
            showAside={false}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search SWS templates, stages, operations, or tags"
            sidePanel={
                <SWSWorkspaceSidePanelNav
                    mode={state === "loading" ? "skeleton" : "dynamic"}
                    data={{
                        badgeNumber: params.badgeNumber,
                        records,
                    }}
                />
            }
            subHeader={
                <div className="flex flex-col gap-3 border border-border bg-card/60 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-3">
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground sm:text-sm">SWS Library</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                            Manage the template library, stage coverage, and linked operations.
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {hasAssignmentContext ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 px-2 text-xs sm:h-8 sm:gap-2 sm:px-3"
                                    onClick={() => openAssignmentSws("PRINT_MANUAL")}
                                >
                                    <span className="hidden xs:inline">Open</span> Assignment
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 px-2 text-xs sm:h-8 sm:gap-2 sm:px-3"
                                    onClick={() => openAssignmentSws("TABLET_INTERACTIVE")}
                                >
                                    Tablet
                                </Button>
                            </>
                        ) : null}
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs sm:h-8 sm:gap-2 sm:px-3" onClick={() => void loadWorkspace()}>
                            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden xs:inline">Refresh</span>
                        </Button>
                        <Button size="sm" className="h-7 gap-1.5 px-2 text-xs sm:h-8 sm:gap-2 sm:px-3" onClick={() => void handleCreateTemplate()}>
                            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden xs:inline">Create</span> Template
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 lg:p-6">
                {state === "error" ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive sm:rounded-2xl sm:p-4 sm:text-sm">
                        {error ?? "The SWS library could not be loaded."}
                    </div>
                ) : (
                    <WorkspaceCollectionView
                        title="Templates"
                        items={collectionItems}
                        mode={state === "loading" ? "skeleton" : "dynamic"}
                        filters={collectionFilters}
                        defaultView="grid"
                        searchPlaceholder="Search templates..."
                    />
                )}
            </div>
        </PageContent>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <DetailSectionCard title={label}>
            <div className="text-2xl font-semibold text-foreground">{value}</div>
        </DetailSectionCard>
    );
}
