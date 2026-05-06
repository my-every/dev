"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { TrainingModuleBuilder } from "@/components/training/training-module-builder";
import { PartImageGallery } from "@/app/(workspaces)/[badgeNumber]/parts/_components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import {
    WorkspaceSectionTabs,
    type DetailSectionConfig,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import {
    TrainingDetailSidePanelNav,
    TrainingDetailSubheader,
    TrainingInstallStepsCard,
    TrainingLinkedOperationsList,
    TrainingOverviewCard,
    TrainingProgressCard,
    TrainingRequirementsList,
    type WorkspaceTrainingCategory,
    type WorkspaceTrainingRecord,
} from "../_components";
import { TRAINING_STAGE_INFO } from "@/types/training";
import { TrainingCategoryRouter } from "@/components/training/viewers";

type TrainingDetailsPageProps = {
    params: Promise<{
        badgeNumber: string;
        trainingId: string;
    }>;
};

type InstallLinksResponse = {
    modules?: Array<{
        id: string;
        name: string;
        category?: string | null;
        difficulty?: string;
        stageCount: number;
        estimatedMinutes: number | null;
    }>;
};
type TeamMember = {
    badge: string;
    fullName: string;
    role?: string | null;
};
type DispatchRecord = {
    id: string;
    sentAt: string;
    sentBy: string;
    badges: string[];
    note?: string;
};

export default function TrainingDetailsPage({ params: paramsPromise }: TrainingDetailsPageProps) {
    const { user, hasAnyRole } = useSession();
    const params = use(paramsPromise);
    const searchParams = useSearchParams();
    const [module, setModule] = useState<WorkspaceTrainingRecord | null>(null);
    const [categories, setCategories] = useState<WorkspaceTrainingCategory[]>([]);
    const [installLinks, setInstallLinks] = useState<InstallLinksResponse["modules"]>([]);
    const [mode, setMode] = useState<ViewMode>("skeleton");
    const [editorOpen, setEditorOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"details" | "preview">("details");
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
    const [dispatchNote, setDispatchNote] = useState("");
    const [sending, setSending] = useState(false);
    const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
    const [assignmentBadges, setAssignmentBadges] = useState<string[]>([]);
    const canDispatch = hasAnyRole(["TEAM_LEAD", "SUPERVISOR", "MANAGER", "DEVELOPER"]);

    useEffect(() => {
        let mounted = true;

        async function loadModule() {
            setMode("skeleton");

            const [moduleResponse, categoryResponse] = await Promise.all([
                fetch(`/api/training/${encodeURIComponent(params.trainingId)}`, { cache: "no-store" }),
                fetch("/api/training/categories", { cache: "no-store" }),
            ]);

            const [modulePayload, categoryPayload] = await Promise.all([
                moduleResponse.ok ? moduleResponse.json() : Promise.resolve({ training: null }),
                categoryResponse.ok ? categoryResponse.json() : Promise.resolve({ categories: [] }),
            ]);

            const nextModule = (modulePayload as { training?: WorkspaceTrainingRecord | null }).training ?? null;
            const nextCategories = (categoryPayload as { categories?: WorkspaceTrainingCategory[] }).categories ?? [];

            if (!mounted) {
                return;
            }

            setModule(nextModule);
            setCategories(nextCategories);

            if (nextModule?.partNumbers?.[0]) {
                const response = await fetch(
                    `/api/training/install-links?partNumber=${encodeURIComponent(nextModule.partNumbers[0])}&badgeNumber=${encodeURIComponent(params.badgeNumber)}`,
                    { cache: "no-store" }
                );
                if (mounted) {
                    const payload = response.ok ? ((await response.json()) as InstallLinksResponse) : { modules: [] };
                    setInstallLinks(payload.modules ?? []);
                }
            } else if (mounted) {
                setInstallLinks([]);
            }

            if (mounted) {
                setMode("dynamic");
            }
        }

        void loadModule();

        return () => {
            mounted = false;
        };
    }, [params.badgeNumber, params.trainingId]);

    useEffect(() => {
        let mounted = true;
        async function loadTeamAndDispatches() {
            const [first, second, dispatchRes] = await Promise.all([
                fetch(`/api/users/team?shift=1st`, { cache: "no-store" }),
                fetch(`/api/users/team?shift=2nd`, { cache: "no-store" }),
                fetch(`/api/training/${encodeURIComponent(params.trainingId)}/dispatch`, { cache: "no-store" }),
            ]);
            const [firstPayload, secondPayload, dispatchPayload] = await Promise.all([
                first.ok ? first.json() : Promise.resolve({ members: [] }),
                second.ok ? second.json() : Promise.resolve({ members: [] }),
                dispatchRes.ok ? dispatchRes.json() : Promise.resolve({ dispatches: [] }),
            ]);
            const members = [...(firstPayload.members ?? []), ...(secondPayload.members ?? [])] as TeamMember[];
            const deduped = Array.from(new Map(members.map((member) => [member.badge, member])).values());
            if (mounted) {
                setTeam(deduped);
                setDispatches((dispatchPayload.dispatches ?? []) as DispatchRecord[]);
            }
        }
        void loadTeamAndDispatches();
        return () => {
            mounted = false;
        };
    }, [params.trainingId]);

    useEffect(() => {
        let mounted = true;
        async function loadAssignmentContextBadges() {
            const projectId = searchParams.get("projectId");
            if (!projectId) {
                if (mounted) setAssignmentBadges([]);
                return;
            }
            const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
            if (!response.ok) {
                if (mounted) setAssignmentBadges([]);
                return;
            }
            const payload = (await response.json()) as { manifest?: { assignments?: Record<string, { boardAssignment?: { assignedBadge?: string } }> } };
            const badges = Object.values(payload.manifest?.assignments ?? {})
                .map((entry) => entry.boardAssignment?.assignedBadge)
                .filter((badge): badge is string => Boolean(badge));
            if (mounted) setAssignmentBadges(Array.from(new Set(badges)));
        }
        void loadAssignmentContextBadges();
        return () => {
            mounted = false;
        };
    }, [searchParams]);

    const categoryLabel = categories.find((entry) => entry.id === module?.category)?.label ?? normalizeLabel(module?.category ?? "uncategorized");
    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Training",
                items: [
                    {
                        id: "training-root",
                        label: "Training Workspace",
                        href: `/${params.badgeNumber}/training`,
                        keywords: ["training", "modules"],
                    },
                    {
                        id: "training-detail",
                        label: module?.name ?? params.trainingId,
                        href: `/${params.badgeNumber}/training/${params.trainingId}`,
                        keywords: [params.trainingId, module?.name ?? "", module?.category ?? ""],
                    },
                ],
            },
        ],
        [module?.category, module?.name, params.badgeNumber, params.trainingId]
    );

    const requirements = useMemo(
        () => [
            { label: "Part numbers", value: module?.partNumbers.length ? module.partNumbers.join(", ") : "No linked parts" },
            { label: "Tags", value: module?.tags.length ? module.tags.join(", ") : "No tags" },
            { label: "Visible roles", value: module?.visibleRoles?.length ? module.visibleRoles.join(", ") : "Everyone" },
            { label: "Stages", value: module?.enabledStages.map((stage) => TRAINING_STAGE_INFO[stage].label).join(", ") || "No stages" },
        ],
        [module?.enabledStages, module?.partNumbers, module?.tags, module?.visibleRoles]
    );

    const linkedOperations = useMemo(
        () =>
            (module?.swsTemplateIds ?? []).map((templateId) => ({
                label: templateId,
                value: "Linked SWS operation template",
            })),
        [module?.swsTemplateIds]
    );

    const installSteps = useMemo(
        () =>
            (installLinks ?? []).slice(0, 6).map((entry) => ({
                label: entry.name,
                value: `${entry.stageCount} stages • ${entry.estimatedMinutes ?? "—"} min`,
            })),
        [installLinks]
    );

    const progress = useMemo(
        () => [
            { label: "Visible sections", value: `${module?.sections.filter((section) => section.visible).length ?? 0}` },
            { label: "Enabled stages", value: `${module?.enabledStages.length ?? 0}` },
            { label: "Linked operations", value: `${module?.swsTemplateIds?.length ?? 0}` },
            { label: "Part coverage", value: `${module?.partNumbers.length ?? 0}` },
        ],
        [module?.enabledStages.length, module?.partNumbers.length, module?.sections, module?.swsTemplateIds?.length]
    );
    const moduleImages = useMemo(() => {
        if (!module) return [];
        const items: Array<{ id: string; url: string; name: string; uploadedAt: string; tags: string[] }> = [];
        if (module.coverImage?.imageUrl) {
            items.push({
                id: "cover-image",
                url: module.coverImage.imageUrl,
                name: module.coverImage.caption || module.name || "Cover image",
                uploadedAt: module.updatedAt,
                tags: ["cover"],
            });
        }
        for (const section of module.sections) {
            if (section.type !== "photos") continue;
            const photos = (section.content as { images?: Array<{ id: string; url: string; caption?: string }> }).images ?? [];
            for (const image of photos) {
                items.push({
                    id: image.id,
                    url: image.url,
                    name: image.caption || "Training photo",
                    uploadedAt: module.updatedAt,
                    tags: ["training"],
                });
            }
        }
        return items;
    }, [module]);

    async function saveModule(nextModule: import("@/types/training").TrainingModuleV2) {
        const response = await fetch(`/api/training/${encodeURIComponent(params.trainingId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextModule),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { training?: WorkspaceTrainingRecord };
        if (payload.training) {
            setModule(payload.training);
        }
    }

    async function updateModuleType(nextType: "quiz" | "page" | "slides") {
        if (!module) return;
        const currentSections = module.sections ?? [];
        const sectionTypeKeep = nextType === "quiz"
            ? new Set(["details", "checklist", "dos-and-donts"])
            : nextType === "slides"
              ? new Set(["cover-image", "photos", "custom", "video"])
              : new Set(["details", "cover-image", "photos", "custom", "video", "required-tools", "required-hardware"]);
        const nextSections = currentSections.filter((section) => sectionTypeKeep.has(section.type));
        await saveModule({
            ...(module as import("@/types/training").TrainingModuleV2),
            type: nextType,
            sections: nextSections.map((section, index) => ({ ...section, order: index })),
            updatedAt: new Date().toISOString(),
        });
    }

    async function sendTrainingToSelected() {
        if (!selectedBadges.length || !module || !user?.badge) return;
        setSending(true);
        try {
            const response = await fetch(`/api/training/${encodeURIComponent(params.trainingId)}/dispatch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    badges: selectedBadges,
                    sentBy: user.badge,
                    note: dispatchNote || undefined,
                }),
            });
            if (!response.ok) return;
            const payload = (await response.json()) as { dispatch?: DispatchRecord };
            if (payload.dispatch) {
                setDispatches((prev) => [payload.dispatch as DispatchRecord, ...prev]);
                setSelectedBadges([]);
                setDispatchNote("");
            }
        } finally {
            setSending(false);
        }
    }

    const sections: DetailSectionConfig[] = [];
    sections.push({
            id: "overview",
            label: "Overview",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Overview" eyebrow="Summary" />,
            renderPanel: (viewMode) => (
                <TrainingOverviewCard
                    mode={viewMode}
                    data={{
                        id: module?.id ?? params.trainingId,
                        description: module?.description,
                        visibility: normalizeLabel(module?.visibility ?? "everyone"),
                        type: module?.type ? normalizeLabel(module.type) : "General",
                        totalEstimatedMinutes: module?.totalEstimatedMinutes,
                    }}
                />
            ),
        });
    if (requirements.some((item) => item.value && item.value !== "No linked parts" && item.value !== "No tags")) {
        sections.push({
            id: "requirements",
            label: "Requirements",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Requirements" eyebrow="Inputs" />,
            renderPanel: (viewMode) => <TrainingRequirementsList mode={viewMode} data={requirements} />,
        });
    }
    if (installSteps.length > 0) {
        sections.push({
            id: "install-steps",
            label: "Install Steps",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Install Steps" eyebrow="Links" />,
            renderPanel: (viewMode) => <TrainingInstallStepsCard mode={viewMode} data={installSteps} />,
        });
    }
    if (linkedOperations.length > 0) {
        sections.push({
            id: "linked-operations",
            label: "Linked Operations",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Linked Operations" eyebrow="SWS" />,
            renderPanel: (viewMode) => <TrainingLinkedOperationsList mode={viewMode} data={linkedOperations} />,
        });
    }
    sections.push({
            id: "progress",
            label: "Progress",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Progress" eyebrow="Coverage" />,
            renderPanel: (viewMode) => <TrainingProgressCard mode={viewMode} data={progress} />,
        });
    if (moduleImages.length > 0) {
        sections.push({
            id: "media",
            label: "Media",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Media" eyebrow="Gallery" />,
            renderPanel: (viewMode) =>
                viewMode === "skeleton" ? (
                    <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">Loading media...</div>
                ) : (
                    <PartImageGallery mode="dynamic" data={{ images: moduleImages, allowUpload: false }} />
                ),
        });
    }
    sections.push({
            id: "dispatch",
            label: "Dispatch",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Dispatch" eyebrow="Team" />,
            renderPanel: (viewMode) => (
                <div className="space-y-3 rounded-xl border border-border/60 p-4">
                    <div className="text-sm font-medium">Send Module To Team Members</div>
                    {viewMode === "skeleton" ? (
                        <div className="text-sm text-muted-foreground">Loading team members...</div>
                    ) : canDispatch ? (
                        <>
                            <div className="grid gap-2 md:grid-cols-2">
                                {team.map((member) => {
                                    const checked = selectedBadges.includes(member.badge);
                                    return (
                                        <label key={member.badge} className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-sm">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(next) => {
                                                    setSelectedBadges((prev) =>
                                                        next ? Array.from(new Set([...prev, member.badge])) : prev.filter((badge) => badge !== member.badge),
                                                    );
                                                }}
                                            />
                                            <span>{member.fullName}</span>
                                            <span className="text-xs text-muted-foreground">({member.badge})</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <Input
                                value={dispatchNote}
                                onChange={(event) => setDispatchNote(event.target.value)}
                                placeholder="Optional note for this training dispatch"
                            />
                            {assignmentBadges.length > 0 ? (
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedBadges(Array.from(new Set([...selectedBadges, ...assignmentBadges])))}
                                >
                                    Send to assignment assignees ({assignmentBadges.length})
                                </Button>
                            ) : null}
                            <Button onClick={() => void sendTrainingToSelected()} disabled={sending || selectedBadges.length === 0}>
                                {sending ? "Sending..." : `Send to ${selectedBadges.length} member(s)`}
                            </Button>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground">Dispatch is available for Team Lead, Supervisor, Manager, or Developer roles.</div>
                    )}
                    {dispatches.length > 0 ? (
                        <div className="space-y-2 pt-2">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recent dispatches</div>
                            {dispatches.slice(0, 5).map((entry) => (
                                <div key={entry.id} className="rounded-lg border border-border/50 px-2 py-1.5 text-xs">
                                    {new Date(entry.sentAt).toLocaleString()} • {entry.sentBy} • {entry.badges.join(", ")}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ),
        });

    return (
        <PageContent
            title="Training Details"
            subtitle={params.trainingId}
            variant="compact"
            showPanel={true}
            showAside={false}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search this training workspace"
            sidePanel={
                <TrainingDetailSidePanelNav
                    sections={sections}
                    mode={mode}
                    backHref={`/${params.badgeNumber}/training`}
                    title={module?.name ?? params.trainingId}
                    subtitle={categoryLabel}
                />
            }
            subHeader={
                <TrainingDetailSubheader
                    mode={mode}
                    data={{
                        name: module?.name ?? params.trainingId,
                        category: categoryLabel,
                        difficulty: module?.difficulty ? normalizeLabel(module.difficulty) : "Unknown",
                        status: module?.status ? normalizeLabel(module.status) : "Unknown",
                        partCount: module?.partNumbers.length ?? 0,
                        stageCount: module?.enabledStages.length ?? 0,
                    }}
                />
            }
            headerActions={
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-border/60 p-0.5">
                        <Button
                            variant={viewMode === "details" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("details")}
                            className="h-7 px-3 text-xs"
                        >
                            Details
                        </Button>
                        <Button
                            variant={viewMode === "preview" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("preview")}
                            className="h-7 px-3 text-xs"
                        >
                            Preview
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void updateModuleType("quiz")}>Quiz</Button>
                    <Button variant="outline" size="sm" onClick={() => void updateModuleType("page")}>Page</Button>
                    <Button variant="outline" size="sm" onClick={() => void updateModuleType("slides")}>Slides</Button>
                    <Button size="sm" onClick={() => setEditorOpen(true)}>Open Editor</Button>
                </div>
            }
        >
            {viewMode === "details" ? (
                <div className="p-4 sm:p-5 lg:p-6">
                    <WorkspaceSectionTabs sections={sections} mode={mode} />
                </div>
            ) : module ? (
                <div className="h-[calc(100vh-12rem)] overflow-hidden">
                    <TrainingCategoryRouter
                        module={module as import("@/types/training").TrainingModuleV2}
                        className="h-full"
                    />
                </div>
            ) : (
                <div className="p-6 text-center text-muted-foreground">
                    Loading module preview...
                </div>
            )}
            {module ? (
                <TrainingModuleBuilder
                    isOpen={editorOpen}
                    onClose={() => setEditorOpen(false)}
                    initialModule={module as import("@/types/training").TrainingModuleV2}
                    onSave={async (nextModule) => {
                        await saveModule(nextModule);
                    }}
                />
            ) : null}
        </PageContent>
    );
}

function DetailNavItem({
    label,
    eyebrow,
    mode,
}: {
    label: string;
    eyebrow: string;
    mode: ViewMode;
}) {
    if (mode === "skeleton") {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="h-3.5 w-24 rounded bg-muted" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground">
                {label.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>
                <div className="truncate text-sm font-medium text-foreground">{label}</div>
            </div>
        </div>
    );
}

function normalizeLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
