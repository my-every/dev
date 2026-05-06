"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, Settings2 } from "lucide-react";

import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import { PageContent } from "@/components/layout/page-content";
import {
    DetailSectionCard,
    WorkspaceSectionTabs,
    type DetailSectionConfig,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import {
    SWSSidePanelNav,
    SWSSidePanelNavItem,
    buildWorkspaceSwsTemplateRecords,
    mapRegistryTemplateToRecord,
    normalizeStageLabel,
    type WorkspaceSwsTemplateRecord,
} from "@/app/(workspaces)/[badgeNumber]/sws/_components";
import type { SwsChecklistGroup, SwsLibrarySettings, SwsOperationRecord, SwsTemplateRecord, SwsUsageRecord } from "@/types/sws-library";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PartRecord } from "@/types/parts-library";
import { buildPartFamilies } from "@/lib/parts/part-families";
import { SWS_TEMPLATE_REGISTRY } from "@/lib/sws/sws-template-registry";
import { type SwsTemplateId } from "@/types/d380-sws";
import {
    SwsChecklistGroupEditor,
    SwsLinkedResourcePicker,
    SwsOperationMatrix,
} from "@/components/dashboard/sws/sws-dashboard";

type Props = {
    params: Promise<{ badgeNumber: string; swsId: string }>;
};

type LoadState = "loading" | "ready" | "error";

function createEmptySettings(): SwsLibrarySettings {
    return {
        namingPrefix: "SWS",
        requireReviewRequirement: false,
        allowNestedTasks: true,
        defaultChecklistGroupTitle: "Main Checklist",
        suggestionHelpersEnabled: true,
        requirePartOrStageLink: false,
        reviewDefaults: {
            requireStageLink: false,
            requireTrainingLink: false,
        },
        updatedAt: new Date().toISOString(),
    };
}

export default function SWSDetailsPage({ params: paramsPromise }: Props) {
    const params = use(paramsPromise);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [state, setState] = useState<LoadState>("loading");
    const [error, setError] = useState<string | null>(null);
    const [record, setRecord] = useState<WorkspaceSwsTemplateRecord | null>(null);
    const [templateDraft, setTemplateDraft] = useState<SwsTemplateRecord | null>(null);
    const [operations, setOperations] = useState<SwsOperationRecord[]>([]);
    const [settingsDraft, setSettingsDraft] = useState<SwsLibrarySettings>(createEmptySettings());
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [operationDraft, setOperationDraft] = useState({
        id: "",
        templateId: "",
        targetType: "stage",
        targetId: "",
        targetLabel: "",
        status: "active" as SwsOperationRecord["status"],
        note: "",
    });
    const [parts, setParts] = useState<PartRecord[]>([]);
    const [stacks, setStacks] = useState<Array<{ id: string; name: string }>>([]);
    const [trainings, setTrainings] = useState<Array<{ id: string; name: string }>>([]);

    const loadDetail = async () => {
        setState("loading");
        setError(null);
        try {
            const [templatesResponse, manifestResponse, operationsResponse, usageResponse, settingsResponse, stacksResponse, trainingResponse, partsResponse] =
                await Promise.all([
                    fetch("/api/sws/templates", { cache: "no-store" }),
                    fetch("/api/sws/templates?manifest=true", { cache: "no-store" }),
                    fetch("/api/sws/operations", { cache: "no-store" }),
                    fetch("/api/sws/usage", { cache: "no-store" }),
                    fetch("/api/sws/settings", { cache: "no-store" }),
                    fetch("/api/parts/stacks?manifest=true", { cache: "no-store" }),
                    fetch("/api/training", { cache: "no-store" }),
                    fetch("/api/parts?limit=250", { cache: "no-store" }),
                ]);

            if (!templatesResponse.ok || !manifestResponse.ok || !operationsResponse.ok || !usageResponse.ok || !settingsResponse.ok) {
                throw new Error("Failed to load the SWS template detail.");
            }

            const [templatesPayload, manifestPayload, operationsPayload, usagePayload, settingsPayload, stacksPayload, trainingPayload, partsPayload] = await Promise.all([
                templatesResponse.json() as Promise<{ templates?: SwsTemplateRecord[] }>,
                manifestResponse.json() as Promise<{ templates?: WorkspaceSwsTemplateRecord["summary"][] }>,
                operationsResponse.json() as Promise<{ operations?: SwsOperationRecord[] }>,
                usageResponse.json() as Promise<{ usage?: SwsUsageRecord[] }>,
                settingsResponse.json() as Promise<{ settings?: SwsLibrarySettings }>,
                stacksResponse.ok ? stacksResponse.json() as Promise<{ stacks?: Array<{ id: string; name: string }> }> : Promise.resolve({ stacks: [] }),
                trainingResponse.ok ? trainingResponse.json() as Promise<{ trainings?: Array<{ id: string; name: string }> }> : Promise.resolve({ trainings: [] }),
                partsResponse.ok ? partsResponse.json() as Promise<{ parts?: PartRecord[]; results?: PartRecord[] }> : Promise.resolve({ parts: [] }),
            ]);

            const nextRecords = buildWorkspaceSwsTemplateRecords({
                templates: templatesPayload.templates ?? [],
                manifest: manifestPayload.templates ?? [],
                operations: operationsPayload.operations ?? [],
                usage: usagePayload.usage ?? [],
            });

            const nextRecord =
                nextRecords.find((entry) => entry.id === decodeURIComponent(params.swsId))
                ?? (SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId]
                    ? {
                          id: decodeURIComponent(params.swsId),
                          template: mapRegistryTemplateToRecord(decodeURIComponent(params.swsId) as SwsTemplateId),
                          summary: {
                              id: decodeURIComponent(params.swsId),
                              name: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].name,
                              kind: "standard" as const,
                              status: "active" as const,
                              groupCount: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].sections.length,
                              taskCount: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].sections.reduce((total, section) => total + section.processSteps.length, 0),
                              operationCount: 0,
                              linkedStageCount: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].stageScopes.length,
                              linkedPartCount: 0,
                              linkedTrainingCount: 0,
                              updatedAt: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].revisionDate,
                          },
                          operations: [],
                          usage: null,
                          stageIds: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].stageScopes,
                          stageLabels: SWS_TEMPLATE_REGISTRY[decodeURIComponent(params.swsId) as SwsTemplateId].stageScopes.map(normalizeStageLabel),
                          isRegistryTemplate: true,
                      }
                    : null);

            if (!nextRecord) {
                throw new Error("SWS template not found.");
            }

            setRecord(nextRecord);
            setTemplateDraft(structuredClone(nextRecord.template));
            setOperations((operationsPayload.operations ?? []).filter((operation) => operation.templateId === nextRecord.id));
            setSettingsDraft(settingsPayload.settings ?? createEmptySettings());
            setSettingsLoaded(true);
            setOperationDraft((current) => ({
                ...current,
                templateId: nextRecord.id,
            }));
            setStacks(stacksPayload.stacks ?? []);
            setTrainings(trainingPayload.trainings ?? []);
            setParts(partsPayload.parts ?? partsPayload.results ?? []);
            setState("ready");
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load SWS detail.");
            setState("error");
        }
    };

    useEffect(() => {
        void loadDetail();
    }, [params.swsId]);

    const partFamilies = useMemo(() => buildPartFamilies(parts), [parts]);
    const usage = record?.usage ?? null;
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
                heading: "SWS",
                items: [
                    {
                        id: "sws-root",
                        label: "SWS Workspace",
                        href: `/${params.badgeNumber}/sws`,
                        keywords: ["sws", "templates"],
                    },
                    {
                        id: "sws-detail",
                        label: templateDraft?.name ?? decodeURIComponent(params.swsId),
                        href: `/${params.badgeNumber}/sws/${encodeURIComponent(params.swsId)}`,
                        keywords: [params.swsId, templateDraft?.name ?? "", templateDraft?.description ?? ""],
                    },
                ],
            },
        ],
        [params.badgeNumber, params.swsId, templateDraft?.description, templateDraft?.name],
    );

    const saveTemplate = async () => {
        if (!templateDraft) {
            return;
        }
        const method = record?.isRegistryTemplate ? "POST" : "PUT";
        const endpoint = method === "POST" ? "/api/sws/templates" : `/api/sws/templates/${encodeURIComponent(templateDraft.id)}`;
        const response = await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(templateDraft),
        });
        if (response.ok) {
            await loadDetail();
        }
    };

    const cloneTemplate = async () => {
        if (!templateDraft) return;
        const clone = structuredClone(templateDraft);
        clone.id = `sws-${Date.now()}`;
        clone.name = `${templateDraft.name} Copy`;
        clone.kind = "custom";
        clone.baseTemplateId = templateDraft.id;
        await fetch("/api/sws/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clone),
        });
        router.push(`/${params.badgeNumber}/sws/${encodeURIComponent(clone.id)}`);
    };

    const deleteTemplate = async () => {
        if (!templateDraft || record?.isRegistryTemplate) {
            router.push(`/${params.badgeNumber}/sws`);
            return;
        }
        await fetch(`/api/sws/templates/${encodeURIComponent(templateDraft.id)}`, { method: "DELETE" });
        router.push(`/${params.badgeNumber}/sws`);
    };

    const saveGroups = async (groups: SwsChecklistGroup[]) => {
        if (!templateDraft) return;
        setTemplateDraft({ ...templateDraft, groups });
        await fetch(`/api/sws/templates/${encodeURIComponent(templateDraft.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ saveTasksOnly: true, groups }),
        });
        await loadDetail();
    };

    const saveOperation = async () => {
        const id = operationDraft.id || `operation-${Date.now()}`;
        await fetch("/api/sws/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id,
                templateId: operationDraft.templateId,
                targetType: operationDraft.targetType,
                targetId: operationDraft.targetId,
                targetLabel: operationDraft.targetLabel,
                status: operationDraft.status,
                note: operationDraft.note,
            }),
        });
        setOperationDraft((current) => ({ ...current, id: "", targetId: "", targetLabel: "", note: "", status: "active" }));
        await loadDetail();
    };

    const saveSettings = async () => {
        await fetch("/api/sws/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settingsDraft),
        });
        await loadDetail();
    };

    const sections: DetailSectionConfig[] = [
        {
            id: "overview",
            label: "Overview",
            renderNav: (mode) => <SWSSidePanelNavItem mode={mode} active label="Overview" eyebrow="Template" meta={record ? `${record.summary.groupCount} groups` : undefined} />,
            renderPanel: (mode) => (
                <TemplateOverviewCard
                    mode={mode}
                    template={templateDraft}
                    record={record}
                    onChange={setTemplateDraft}
                    onSave={saveTemplate}
                    onClone={cloneTemplate}
                    onDelete={deleteTemplate}
                />
            ),
        },
        {
            id: "checklist",
            label: "Checklist",
            renderNav: (mode) => <SWSSidePanelNavItem mode={mode} label="Checklist" eyebrow="Groups" meta={record ? `${record.summary.groupCount}` : undefined} />,
            renderPanel: (mode) => <ChecklistGroupList mode={mode} template={templateDraft} />,
        },
        {
            id: "tasks",
            label: "Tasks",
            renderNav: (mode) => <SWSSidePanelNavItem mode={mode} label="Tasks" eyebrow="Editor" meta={record ? `${record.summary.taskCount}` : undefined} />,
            renderPanel: (mode) =>
                mode === "skeleton" || !templateDraft ? (
                    <DetailSectionCard mode="skeleton" />
                ) : (
                    <SwsChecklistGroupEditor
                        groups={templateDraft.groups}
                        onChange={(groups) => setTemplateDraft({ ...templateDraft, groups })}
                        onSave={() => saveGroups(templateDraft.groups)}
                    />
                ),
        },
        {
            id: "operations",
            label: "Operations",
            renderNav: (mode) => <SWSSidePanelNavItem mode={mode} label="Operations" eyebrow="Links" meta={`${operations.length}`} />,
            renderPanel: (mode) =>
                mode === "skeleton" ? (
                    <DetailSectionCard mode="skeleton" />
                ) : (
                    <div className="space-y-4">
                        <SwsLinkedResourcePicker
                            draft={operationDraft}
                            templates={templateDraft ? [templateDraft] : []}
                            parts={parts.map((part) => ({ partNumber: part.partNumber, description: part.description }))}
                            partFamilies={partFamilies}
                            stacks={stacks}
                            trainings={trainings}
                            onChange={setOperationDraft}
                            onSave={saveOperation}
                        />
                        <SwsOperationMatrix
                            operations={operations}
                            onEdit={(operation) =>
                                setOperationDraft({
                                    id: operation.id,
                                    templateId: operation.templateId,
                                    targetType: operation.targetType,
                                    targetId: operation.targetId,
                                    targetLabel: operation.targetLabel,
                                    status: operation.status ?? "active",
                                    note: operation.note ?? "",
                                })
                            }
                            onDelete={async (operationId) => {
                                await fetch("/api/sws/operations", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ deleteId: operationId }),
                                });
                                await loadDetail();
                            }}
                        />
                    </div>
                ),
        },
        {
            id: "usage",
            label: "Usage",
            renderNav: (mode) => <SWSSidePanelNavItem mode={mode} label="Usage" eyebrow="Stage Links" meta={`${usage?.stageIds.length ?? 0}`} />,
            renderPanel: (mode) => <UsageSummaryCard mode={mode} record={record} />,
        },
        {
            id: "settings",
            label: "Settings",
            renderNav: (mode) => <SWSSidePanelNavItem mode={mode} label="Settings" eyebrow="Library" meta={settingsLoaded ? "Live" : "—"} />,
            renderPanel: (mode) => (
                <SettingsEditorCard mode={mode} settings={settingsDraft} onChange={setSettingsDraft} onSave={saveSettings} />
            ),
        },
    ];

    return (
        <PageContent
            title="SWS Details"
            subtitle={templateDraft?.id ?? decodeURIComponent(params.swsId)}
            variant="compact"
            showPanel={true}
            showAside={true}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search SWS template details"
            sidePanel={
                <SWSSidePanelNav
                    mode={state === "loading" ? "skeleton" : "dynamic"}
                    sections={sections}
                    backHref={`/${params.badgeNumber}/sws`}
                    summary={{
                        title: "Template Detail",
                        subtitle: "Stage-attached checklist editor",
                        status: templateDraft?.status ?? "Loading",
                        headline: templateDraft?.name ?? decodeURIComponent(params.swsId),
                        subline: templateDraft?.description || "Edit template metadata, tasks, operations, usage, and settings.",
                        chips: [
                            templateDraft?.kind ?? "template",
                            templateDraft?.versionLabel ?? `v${templateDraft?.version ?? 1}`,
                            ...(record?.stageLabels.slice(0, 2) ?? []),
                        ],
                    }}

                />
            }
            subHeader={
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
                    <div>
                        <div className="text-sm font-semibold text-foreground">{templateDraft?.name ?? "SWS Template"}</div>
                        <div className="text-xs text-muted-foreground">
                            Manage the primary checklist template, linked operations, and stage coverage used by assignments.
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {record?.stageLabels.map((stage) => (
                            <Badge key={stage} variant="outline">{stage}</Badge>
                        ))}
                    </div>
                </div>
            }
            aside={
                <div className="space-y-4 p-4">
                    <DetailSectionCard title="Template Summary" description="Quick linked context for this template.">
                        <div className="space-y-3">
                            <MetaRow label="ID" value={templateDraft?.id ?? "—"} />
                            <MetaRow label="Kind" value={templateDraft?.kind ?? "—"} />
                            <MetaRow label="Status" value={templateDraft?.status ?? "—"} />
                            <MetaRow label="Operations" value={`${operations.length}`} />
                            <MetaRow label="Stage Links" value={`${record?.stageIds.length ?? 0}`} />
                            <MetaRow label="Tasks" value={`${record?.summary.taskCount ?? 0}`} />
                        </div>
                    </DetailSectionCard>
                    <UsageSummaryCard mode={state === "loading" ? "skeleton" : "dynamic"} record={record} />
                </div>
            }
            headerActions={
                <div className="flex flex-wrap items-center gap-2">
                    {hasAssignmentContext ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => openAssignmentSws("PRINT_MANUAL")}>
                                Open Assignment SWS
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openAssignmentSws("TABLET_INTERACTIVE")}>
                                Execute Tablet
                            </Button>
                        </>
                    ) : null}
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadDetail()}>
                        <Save className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-4 sm:p-5 lg:p-6">
                {state === "error" ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {error ?? "The SWS detail page could not be loaded."}
                    </div>
                ) : (
                    <WorkspaceSectionTabs sections={sections} mode={state === "loading" ? "skeleton" : "dynamic"} />
                )}
            </div>
        </PageContent>
    );
}

function TemplateOverviewCard({
    mode,
    template,
    record,
    onChange,
    onSave,
    onClone,
    onDelete,
}: {
    mode: ViewMode;
    template: SwsTemplateRecord | null;
    record: WorkspaceSwsTemplateRecord | null;
    onChange: (template: SwsTemplateRecord | null) => void;
    onSave: () => Promise<void>;
    onClone: () => Promise<void>;
    onDelete: () => Promise<void>;
}) {
    if (mode === "skeleton" || !template) {
        return <DetailSectionCard mode="skeleton" />;
    }

    return (
        <DetailSectionCard
            title="Overview"
            description="Template metadata, membership, lifecycle state, and registry status."
            action={record?.isRegistryTemplate ? <Badge variant="outline">Registry</Badge> : null}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <EditorField label="Template Name">
                    <Input value={template.name} onChange={(event) => onChange({ ...template, name: event.target.value })} />
                </EditorField>
                <EditorField label="Version Label">
                    <Input value={template.versionLabel || ""} onChange={(event) => onChange({ ...template, versionLabel: event.target.value })} />
                </EditorField>
                <EditorField label="Kind">
                    <Select value={template.kind} onValueChange={(value: SwsTemplateRecord["kind"]) => onChange({ ...template, kind: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                </EditorField>
                <EditorField label="Status">
                    <Select value={template.status} onValueChange={(value: SwsTemplateRecord["status"]) => onChange({ ...template, status: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                            <SelectItem value="deprecated">Deprecated</SelectItem>
                        </SelectContent>
                    </Select>
                </EditorField>
                <EditorField label="Member Badge">
                    <Input value={template.memberBadge || ""} onChange={(event) => onChange({ ...template, memberBadge: event.target.value })} />
                </EditorField>
                <EditorField label="Member Name">
                    <Input value={template.memberName || ""} onChange={(event) => onChange({ ...template, memberName: event.target.value })} />
                </EditorField>
            </div>
            <div className="mt-4 space-y-4">
                <EditorField label="Description">
                    <Textarea value={template.description || ""} onChange={(event) => onChange({ ...template, description: event.target.value })} rows={4} />
                </EditorField>
                <EditorField label="Notes">
                    <Textarea value={template.notes || ""} onChange={(event) => onChange({ ...template, notes: event.target.value })} rows={4} />
                </EditorField>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                <Button className="gap-2" onClick={() => void onSave()}>
                    <Save className="h-4 w-4" />
                    {record?.isRegistryTemplate ? "Import To Library" : "Save Template"}
                </Button>
                <Button variant="outline" onClick={() => void onClone()}>Clone Template</Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void onDelete()}>
                    {record?.isRegistryTemplate ? "Back To Library" : "Delete Template"}
                </Button>
            </div>
        </DetailSectionCard>
    );
}

function ChecklistGroupList({ mode, template }: { mode: ViewMode; template: SwsTemplateRecord | null }) {
    if (mode === "skeleton" || !template) {
        return <DetailSectionCard mode="skeleton" />;
    }

    return (
        <div className="space-y-4">
            {template.groups.map((group) => (
                <DetailSectionCard
                    key={group.id}
                    title={group.title}
                    description={group.description || `${group.tasks.length} checklist items`}
                    action={<Badge variant="outline">{group.tasks.length} tasks</Badge>}
                >
                    <div className="space-y-2">
                        {group.tasks.map((task) => (
                            <div key={task.id} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                                <div className="text-sm font-medium text-foreground">{task.title}</div>
                                {task.description ? <div className="mt-1 text-sm text-muted-foreground">{task.description}</div> : null}
                            </div>
                        ))}
                    </div>
                </DetailSectionCard>
            ))}
        </div>
    );
}

function UsageSummaryCard({ mode, record }: { mode: ViewMode; record: WorkspaceSwsTemplateRecord | null }) {
    if (mode === "skeleton") {
        return <DetailSectionCard mode="skeleton" />;
    }

    return (
        <DetailSectionCard title="Usage" description="Where this template is attached and discoverable.">
            <div className="grid gap-3">
                <MetaRow label="Stage Links" value={record?.stageLabels.join(", ") || "No stage links"} />
                <MetaRow label="Operations" value={`${record?.operations.length ?? 0}`} />
                <MetaRow label="Stacks" value={`${record?.usage?.stackIds.length ?? 0}`} />
                <MetaRow label="Training Modules" value={`${record?.usage?.trainingModuleIds.length ?? 0}`} />
                <MetaRow label="Part Numbers" value={`${record?.usage?.partNumbers.length ?? 0}`} />
            </div>
        </DetailSectionCard>
    );
}

function SettingsEditorCard({
    mode,
    settings,
    onChange,
    onSave,
}: {
    mode: ViewMode;
    settings: SwsLibrarySettings;
    onChange: (settings: SwsLibrarySettings) => void;
    onSave: () => Promise<void>;
}) {
    if (mode === "skeleton") {
        return <DetailSectionCard mode="skeleton" />;
    }

    return (
        <DetailSectionCard title="Library Settings" description="Global rules that guide SWS template linking and review behavior.">
            <div className="grid gap-4 md:grid-cols-2">
                <EditorField label="Naming Prefix">
                    <Input value={settings.namingPrefix} onChange={(event) => onChange({ ...settings, namingPrefix: event.target.value })} />
                </EditorField>
                <EditorField label="Default Checklist Group Title">
                    <Input value={settings.defaultChecklistGroupTitle} onChange={(event) => onChange({ ...settings, defaultChecklistGroupTitle: event.target.value })} />
                </EditorField>
                <EditorField label="Nested Tasks">
                    <Select
                        value={settings.allowNestedTasks ? "enabled" : "disabled"}
                        onValueChange={(value) => onChange({ ...settings, allowNestedTasks: value === "enabled" })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </EditorField>
                <EditorField label="Suggestion Helpers">
                    <Select
                        value={settings.suggestionHelpersEnabled ? "enabled" : "disabled"}
                        onValueChange={(value) => onChange({ ...settings, suggestionHelpersEnabled: value === "enabled" })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </EditorField>
                <EditorField label="Require Part Or Stage Link">
                    <Select
                        value={settings.requirePartOrStageLink ? "enabled" : "disabled"}
                        onValueChange={(value) => onChange({ ...settings, requirePartOrStageLink: value === "enabled" })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </EditorField>
                <EditorField label="Require Review Requirement">
                    <Select
                        value={settings.requireReviewRequirement ? "enabled" : "disabled"}
                        onValueChange={(value) => onChange({ ...settings, requireReviewRequirement: value === "enabled" })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </EditorField>
            </div>
            <div className="mt-4">
                <Button className="gap-2" onClick={() => void onSave()}>
                    <Settings2 className="h-4 w-4" />
                    Save Settings
                </Button>
            </div>
        </DetailSectionCard>
    );
}

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-2 text-sm">
            <span className="font-medium text-foreground">{label}</span>
            {children}
        </label>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-border bg-background/80 px-3 py-3">
            <span className="text-sm text-foreground">{label}</span>
            <span className="text-sm font-medium text-muted-foreground">{value}</span>
        </div>
    );
}
