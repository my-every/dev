"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowRight,
    Copy,
    GitBranch,
    Link2,
    Loader2,
    Plus,
    Save,
    Settings2,
    Trash2,
    Search,
    RefreshCw,
} from "lucide-react";

import { DashboardDomainShell } from "@/components/dashboard/shared/dashboard-domain-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
    SwsChecklistGroup,
    SwsLibraryManifest,
    SwsLibrarySettings,
    SwsOperationRecord,
    SwsOperationStatus,
    SwsSuggestionRule,
    SwsTaskNode,
    SwsTemplateRecord,
    SwsUsageRecord,
} from "@/types/sws-library";
import { buildPartFamilies } from "@/lib/parts/part-families";
import type { PartRecord } from "@/types/parts-library";

const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed for ${url}`);
    }
    return response.json();
};

type SwsTab = "overview" | "templates" | "tasks" | "operations" | "settings";

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

function createTaskNode(): SwsTaskNode {
    return {
        id: `task-${Date.now()}`,
        title: "New task",
        description: "",
        required: true,
        children: [],
    };
}

export function SwsDashboardShell({ badgeNumber }: { badgeNumber: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeTab = (searchParams.get("tab") as SwsTab) || "overview";
    const operationTemplateId = searchParams.get("templateId");
    const operationTargetType = searchParams.get("targetType");
    const operationTargetId = searchParams.get("targetId");
    const operationTargetLabel = searchParams.get("targetLabel");

    const { data: manifestPayload, mutate: mutateManifest, error: manifestError, isLoading: isManifestLoading } = useSWR<SwsLibraryManifest>("/api/sws/templates?manifest=true", fetcher);
    const { data: templatesPayload, mutate: mutateTemplates, error: templatesError, isLoading: isTemplatesLoading } = useSWR<{ templates: SwsTemplateRecord[] }>("/api/sws/templates", fetcher);
    const { data: operationsPayload, mutate: mutateOperations, error: operationsError, isLoading: isOperationsLoading } = useSWR<{ operations: SwsOperationRecord[] }>("/api/sws/operations", fetcher);
    const { data: suggestionsPayload, error: suggestionsError } = useSWR<{ suggestions: SwsSuggestionRule[] }>("/api/sws/suggestions", fetcher);
    const { data: usagePayload, error: usageError } = useSWR<{ usage: SwsUsageRecord[] }>("/api/sws/usage", fetcher);
    const { data: settingsPayload, mutate: mutateSettings, error: settingsError, isLoading: isSettingsLoading } = useSWR<{ settings: SwsLibrarySettings }>("/api/sws/settings", fetcher);
    const { data: stacksPayload } = useSWR<{ stacks: Array<{ id: string; name: string }> }>("/api/parts/stacks?manifest=true", fetcher);
    const { data: trainingPayload } = useSWR<{ trainings: Array<{ id: string; name: string }> }>("/api/training", fetcher);
    const { data: partsPayload } = useSWR<{ results: PartRecord[] }>("/api/parts?limit=250", fetcher);

    const templates = templatesPayload?.templates ?? [];
    const operations = operationsPayload?.operations ?? [];
    const suggestions = suggestionsPayload?.suggestions ?? [];
    const usage = usagePayload?.usage ?? [];
    const manifest = manifestPayload?.templates ?? [];
    const settings = settingsPayload?.settings;
    const stacks = stacksPayload?.stacks ?? [];
    const trainings = trainingPayload?.trainings ?? [];
    const parts = partsPayload?.results ?? [];
    const partFamilies = useMemo(() => buildPartFamilies(parts), [parts]);
    const isLibraryLoading = isManifestLoading || isTemplatesLoading || isOperationsLoading || isSettingsLoading;
    const libraryError = manifestError || templatesError || operationsError || settingsError || suggestionsError || usageError;

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [draftTemplate, setDraftTemplate] = useState<SwsTemplateRecord | null>(null);
    const [settingsDraft, setSettingsDraft] = useState<SwsLibrarySettings | null>(null);
    const [operationFilter, setRelationFilter] = useState<"all" | SwsOperationRecord["targetType"]>("all");
    const [operationQuery, setRelationQuery] = useState("");
    const [operationDraft, setRelationDraft] = useState({
        id: "",
        templateId: "",
        targetType: "stage",
        targetId: "",
        targetLabel: "",
        status: "active" as SwsOperationStatus,
        note: "",
    });

    useEffect(() => {
        if (templates.length === 0) {
            setSelectedTemplateId(null);
            setDraftTemplate(null);
            return;
        }

        setSelectedTemplateId((current) => current && templates.some((template) => template.id === current) ? current : templates[0].id);
    }, [templates]);

    useEffect(() => {
        if (!selectedTemplateId) {
            setDraftTemplate(null);
            return;
        }

        const nextTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
        setDraftTemplate(nextTemplate ? structuredClone(nextTemplate) : null);
        setRelationDraft((current) => ({
            ...current,
            templateId: nextTemplate?.id ?? current.templateId,
        }));
    }, [selectedTemplateId, templates]);

    useEffect(() => {
        if (settings) {
            setSettingsDraft(settings);
        }
    }, [settings]);

    const handleTabChange = (tabId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tabId);
        router.replace(`/profile/${badgeNumber}/sws?${params.toString()}`);
    };

    useEffect(() => {
        if (!templates.length) return;

        if (operationTemplateId && templates.some((template) => template.id === operationTemplateId)) {
            setSelectedTemplateId(operationTemplateId);
        }
    }, [operationTemplateId, templates]);

    useEffect(() => {
        if (!operationTargetType && !operationTargetId && !operationTargetLabel && !operationTemplateId) return;

        setRelationDraft((current) => ({
            id: current.id,
            templateId:
                operationTemplateId && templates.some((template) => template.id === operationTemplateId)
                    ? operationTemplateId
                    : current.templateId,
            targetType: operationTargetType ?? current.targetType,
            targetId: operationTargetId ?? current.targetId,
            targetLabel: operationTargetLabel ?? current.targetLabel,
            status: current.status,
            note: current.note,
        }));
    }, [
        operationTargetId,
        operationTargetLabel,
        operationTargetType,
        operationTemplateId,
        templates,
    ]);

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "templates", label: "Templates" },
        { id: "tasks", label: "Tasks" },
        { id: "operations", label: "Operations" },
        { id: "settings", label: "Settings" },
    ];

    const summary = (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SwsMetricCard label="Templates" value={`${manifest.length}`} description="Standard and custom checklist templates" />
            <SwsMetricCard label="Operations" value={`${operations.length}`} description="Links to stages, parts, stacks, and training" />
            <SwsMetricCard label="Custom" value={`${manifest.filter((item) => item.kind === "custom").length}`} description="Editable custom work standards" />
            <SwsMetricCard label="Guidance" value={`${suggestions.length}`} description="Suggestions, required-link gaps, and lifecycle indicators" />
        </div>
    );

    const actions = (
        <>
            <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                    setDraftTemplate(createEmptyTemplate());
                    handleTabChange("templates");
                }}
            >
                <Plus className="h-3.5 w-3.5" />
                Create Template
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleTabChange("operations")}>
                <Link2 className="h-3.5 w-3.5" />
                Review Operations
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void Promise.all([mutateTemplates(), mutateManifest(), mutateOperations(), mutateSettings()])}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
            </Button>
        </>
    );

    const selectedTemplateOperations = operations.filter((operation) => operation.templateId === selectedTemplateId);
    const selectedUsage = usage.find((entry) => entry.templateId === selectedTemplateId);
    const filteredOperations = useMemo(() => {
        const query = operationQuery.trim().toLowerCase();
        return operations.filter((operation) => {
            const matchesType = operationFilter === "all" || operation.targetType === operationFilter;
            const matchesQuery =
                query.length === 0
                || operation.targetLabel.toLowerCase().includes(query)
                || operation.templateId.toLowerCase().includes(query)
                || operation.targetId.toLowerCase().includes(query);
            return matchesType && matchesQuery;
        });
    }, [operationFilter, operationQuery, operations]);

    const rightPane = (
        <SwsTemplateAside
            template={draftTemplate}
            operations={selectedTemplateOperations}
            usage={selectedUsage}
            onChange={setDraftTemplate}
            onSave={async () => {
                if (!draftTemplate) return;
                const method = templates.some((template) => template.id === draftTemplate.id) ? "PUT" : "POST";
                const endpoint = method === "POST" ? "/api/sws/templates" : `/api/sws/templates/${encodeURIComponent(draftTemplate.id)}`;
                await fetch(endpoint, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(draftTemplate),
                });
                console.info("[sws/template-save]", { templateId: draftTemplate.id, kind: draftTemplate.kind, status: draftTemplate.status });
                await Promise.all([mutateTemplates(), mutateManifest()]);
                setSelectedTemplateId(draftTemplate.id);
            }}
            onClone={() => {
                if (!draftTemplate) return;
                const clone = structuredClone(draftTemplate);
                clone.id = `sws-${Date.now()}`;
                clone.name = `${draftTemplate.name} Copy`;
                clone.kind = "custom";
                clone.baseTemplateId = draftTemplate.id;
                setDraftTemplate(clone);
            }}
            onDelete={async () => {
                if (!draftTemplate) return;
                await fetch(`/api/sws/templates/${encodeURIComponent(draftTemplate.id)}`, { method: "DELETE" });
                console.info("[sws/template-delete]", { templateId: draftTemplate.id });
                await Promise.all([mutateTemplates(), mutateManifest(), mutateOperations()]);
            }}
        />
    );

    if (isLibraryLoading) {
        return (
            <DashboardDomainShell
                title="SWS"
                description="Reusable standard work templates, nested task libraries, and explicit operations to parts, stacks, training, stages, and project usage."
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
            >
                <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/50">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading SWS library...
                    </div>
                </div>
            </DashboardDomainShell>
        );
    }

    if (libraryError) {
        return (
            <DashboardDomainShell
                title="SWS"
                description="Reusable standard work templates, nested task libraries, and explicit operations to parts, stacks, training, stages, and project usage."
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
            >
                <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
                    <p className="text-base font-semibold">SWS library unavailable</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The SWS library state could not be loaded. Refresh the page or review the filesystem-backed library files.
                    </p>
                </div>
            </DashboardDomainShell>
        );
    }

    return (
        <DashboardDomainShell
            title="SWS"
            description="Reusable standard work templates, nested task libraries, and explicit operations to parts, stacks, training, stages, and project usage."
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
        
          
            rightPane={rightPane}
        >
            {activeTab === "overview" ? (
                <div className="space-y-4">
                    <SwsStatusStrip manifest={manifest} />
                    <SwsHealthSummary manifest={manifest} suggestions={suggestions} />
                    <SwsSuggestionPanel
                        suggestions={suggestions}
                        onSelectSuggestion={(suggestion) => {
                            if (suggestion.templateId) {
                                setSelectedTemplateId(suggestion.templateId);
                            }
                            if ((suggestion.actionLabel || "").toLowerCase().includes("link") || (suggestion.actionLabel || "").toLowerCase().includes("usage")) {
                                handleTabChange("operations");
                                return;
                            }
                            handleTabChange("tasks");
                        }}
                    />
                    <div className="grid gap-4 lg:grid-cols-2">
                        <SwsUsageSummary usage={usage} />
                        <SwsTemplateCollection
                            templates={templates}
                            selectedTemplateId={selectedTemplateId}
                            onSelectTemplate={(templateId) => {
                                setSelectedTemplateId(templateId);
                                handleTabChange("templates");
                            }}
                        />
                    </div>
                </div>
            ) : null}

            {activeTab === "templates" ? (
                <SwsTemplateCollection
                    templates={templates}
                    selectedTemplateId={selectedTemplateId}
                    onSelectTemplate={setSelectedTemplateId}
                />
            ) : null}

            {activeTab === "tasks" && draftTemplate ? (
                <SwsChecklistGroupEditor
                    groups={draftTemplate.groups}
                    onChange={(groups) => setDraftTemplate({ ...draftTemplate, groups })}
                    onSave={async () => {
                        await fetch(`/api/sws/templates/${encodeURIComponent(draftTemplate.id)}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ saveTasksOnly: true, groups: draftTemplate.groups }),
                        });
                        await Promise.all([mutateTemplates(), mutateManifest()]);
                    }}
                />
            ) : null}

            {activeTab === "operations" ? (
                <div className="space-y-4">
                    <SwsLinkedResourcePicker
                        draft={operationDraft}
                        templates={templates}
                        parts={parts}
                        partFamilies={partFamilies}
                        stacks={stacks}
                        trainings={trainings}
                        onChange={setRelationDraft}
                        onSave={async () => {
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
                            console.info("[sws/operation-save]", { operationId: id, templateId: operationDraft.templateId, targetType: operationDraft.targetType, targetId: operationDraft.targetId });
                            await Promise.all([mutateOperations(), mutateManifest()]);
                            setRelationDraft((current) => ({ ...current, id: "", targetId: "", targetLabel: "", note: "", status: "active" }));
                        }}
                    />
                    <div className="grid gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
                        <Select value={operationFilter} onValueChange={(value) => setRelationFilter(value as typeof operationFilter)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All operation targets</SelectItem>
                                <SelectItem value="stage">Stages</SelectItem>
                                <SelectItem value="part-number">Part numbers</SelectItem>
                                <SelectItem value="part-family">Part families</SelectItem>
                                <SelectItem value="stack">Stacks</SelectItem>
                                <SelectItem value="training-module">Training modules</SelectItem>
                                <SelectItem value="assignment-sws">Assignment SWS types</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={operationQuery} onChange={(event) => setRelationQuery(event.target.value)} placeholder="Search operation labels, ids, or template ids..." className="pl-9" />
                        </div>
                    </div>
                    <SwsOperationMatrix
                        operations={filteredOperations}
                        onEdit={(operation) => {
                            setRelationDraft({
                                id: operation.id,
                                templateId: operation.templateId,
                                targetType: operation.targetType,
                                targetId: operation.targetId,
                                targetLabel: operation.targetLabel,
                                status: operation.status ?? "active",
                                note: operation.note ?? "",
                            });
                        }}
                        onDelete={async (operationId) => {
                            await fetch("/api/sws/operations", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deleteId: operationId }),
                            });
                            console.info("[sws/operation-delete]", { operationId });
                            await Promise.all([mutateOperations(), mutateManifest()]);
                        }}
                    />
                </div>
            ) : null}

            {activeTab === "settings" && settingsDraft ? (
                <div className="space-y-4">
                    <Card className="rounded-2xl border-border/60">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Settings2 className="h-4 w-4" />
                                Library defaults
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <Field label="Naming Prefix">
                                <Input
                                    value={settingsDraft.namingPrefix}
                                    onChange={(event) => setSettingsDraft({ ...settingsDraft, namingPrefix: event.target.value })}
                                />
                            </Field>
                            <Field label="Default Checklist Group Title">
                                <Input
                                    value={settingsDraft.defaultChecklistGroupTitle}
                                    onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultChecklistGroupTitle: event.target.value })}
                                />
                            </Field>
                            <Field label="Nested Tasks">
                                <Select
                                    value={settingsDraft.allowNestedTasks ? "enabled" : "disabled"}
                                    onValueChange={(value) => setSettingsDraft({ ...settingsDraft, allowNestedTasks: value === "enabled" })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enabled">Enabled</SelectItem>
                                        <SelectItem value="disabled">Disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Suggestion Helpers">
                                <Select
                                    value={settingsDraft.suggestionHelpersEnabled ? "enabled" : "disabled"}
                                    onValueChange={(value) => setSettingsDraft({ ...settingsDraft, suggestionHelpersEnabled: value === "enabled" })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enabled">Enabled</SelectItem>
                                        <SelectItem value="disabled">Disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Require Part Or Stage Link">
                                <Select
                                    value={settingsDraft.requirePartOrStageLink ? "enabled" : "disabled"}
                                    onValueChange={(value) => setSettingsDraft({ ...settingsDraft, requirePartOrStageLink: value === "enabled" })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enabled">Enabled</SelectItem>
                                        <SelectItem value="disabled">Disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </CardContent>
                    </Card>
                    <Button
                        className="gap-1.5"
                        onClick={async () => {
                            await fetch("/api/sws/settings", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(settingsDraft),
                            });
                            await mutateSettings();
                        }}
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save SWS Settings
                    </Button>
                </div>
            ) : null}
        </DashboardDomainShell>
    );
}

export function SwsSubheader({
    title,
    description,
    actions,
}: {
    title: string;
    description: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">SWS Library</p>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}

export function SwsStatusStrip({ manifest }: { manifest: SwsLibraryManifest["templates"] }) {
    return (
        <div className="grid gap-3 md:grid-cols-3">
            <StatusCard title="Ready Templates" value={manifest.filter((item) => item.status === "active").length} />
            <StatusCard title="Draft Templates" value={manifest.filter((item) => item.status === "draft").length} />
            <StatusCard title="Linked Training" value={manifest.reduce((total, item) => total + item.linkedTrainingCount, 0)} />
        </div>
    );
}

function SwsHealthSummary({
    manifest,
    suggestions,
}: {
    manifest: SwsLibraryManifest["templates"];
    suggestions: SwsSuggestionRule[];
}) {
    return (
        <div className="grid gap-3 md:grid-cols-3">
            <StatusCard title="Unlinked Templates" value={manifest.filter((item) => item.operationCount === 0).length} />
            <StatusCard title="Deprecated In Use" value={manifest.filter((item) => item.status === "deprecated" && item.operationCount > 0).length} />
            <StatusCard title="Open Guidance" value={suggestions.filter((item) => item.kind !== "ready").length} />
        </div>
    );
}

export function SwsTemplateCard({
    template,
    isSelected,
    onSelect,
}: {
    template: SwsTemplateRecord;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const taskCount = template.groups.reduce((total, group) => total + countTaskNodes(group.tasks), 0);
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? "border-primary bg-primary/5" : "border-border/60 bg-card/70 hover:border-primary/40"}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold">{template.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{template.description || "No description yet"}</p>
                </div>
                <SwsUsageBadge kind={template.kind} status={template.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{template.groups.length} groups</Badge>
                <Badge variant="outline">{taskCount} tasks</Badge>
                {template.versionLabel ? <Badge variant="outline">{template.versionLabel}</Badge> : null}
                {template.memberBadge ? <Badge variant="secondary">Member {template.memberBadge}</Badge> : null}
                {template.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
            </div>
        </button>
    );
}

export function SwsChecklistGroupEditor({
    groups,
    onChange,
    onSave,
}: {
    groups: SwsChecklistGroup[];
    onChange: (groups: SwsChecklistGroup[]) => void;
    onSave: () => Promise<void>;
}) {
    const updateGroup = (groupId: string, patch: Partial<SwsChecklistGroup>) => {
        onChange(groups.map((group) => group.id === groupId ? { ...group, ...patch } : group));
    };

    const duplicateGroup = (groupId: string) => {
        const source = groups.find((group) => group.id === groupId);
        if (!source) return;
        onChange([
            ...groups,
            {
                ...structuredClone(source),
                id: `group-${Date.now()}`,
                title: `${source.title} Copy`,
                order: groups.length,
            },
        ]);
    };

    const reorderGroup = (groupId: string, direction: -1 | 1) => {
        const index = groups.findIndex((group) => group.id === groupId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= groups.length) return;
        const nextGroups = [...groups];
        const [moved] = nextGroups.splice(index, 1);
        nextGroups.splice(nextIndex, 0, moved);
        onChange(nextGroups.map((group, order) => ({ ...group, order })));
    };

    const addGroup = () => {
        onChange([
            ...groups,
            {
                id: `group-${Date.now()}`,
                title: "New Checklist Group",
                description: "",
                order: groups.length,
                tasks: [],
            },
        ]);
    };

    return (
        <div className="space-y-6">
            {groups.map((group, groupIndex) => (
                <div key={group.id} className="group/group overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm">
                    {/* Group Header */}
                    <div className="border-b border-border/40 bg-muted/30 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Input
                                    value={group.title}
                                    onChange={(event) => updateGroup(group.id, { title: event.target.value })}
                                    className="h-auto border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                                    placeholder="Group title..."
                                />
                                <Textarea
                                    value={group.description || ""}
                                    onChange={(event) => updateGroup(group.id, { description: event.target.value })}
                                    placeholder="Describe what this checklist group covers..."
                                    className="min-h-[40px] resize-none border-0 bg-transparent p-0 text-sm text-muted-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/group:opacity-100">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => reorderGroup(group.id, -1)}
                                    disabled={groupIndex === 0}
                                >
                                    <ArrowRight className="h-4 w-4 rotate-[-90deg]" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => reorderGroup(group.id, 1)}
                                    disabled={groupIndex === groups.length - 1}
                                >
                                    <ArrowRight className="h-4 w-4 rotate-90" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateGroup(group.id)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive/70 hover:text-destructive"
                                    onClick={() => onChange(groups.filter((item) => item.id !== group.id))}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Tasks */}
                    <div className="p-4">
                        <SwsTaskTreeEditor
                            tasks={group.tasks}
                            onChange={(tasks) => updateGroup(group.id, { tasks })}
                        />
                    </div>
                </div>
            ))}

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4">
                <Button variant="outline" className="gap-1.5" onClick={addGroup}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Checklist Group
                </Button>
                <div className="flex-1" />
                <Button className="gap-1.5" onClick={() => void onSave()}>
                    <Save className="h-3.5 w-3.5" />
                    Save Tasks
                </Button>
            </div>
        </div>
    );
}

export function SwsTaskTreeEditor({
    tasks,
    onChange,
}: {
    tasks: SwsTaskNode[];
    onChange: (tasks: SwsTaskNode[]) => void;
}) {
    const updateTask = (taskId: string, patch: Partial<SwsTaskNode>, list: SwsTaskNode[] = tasks): SwsTaskNode[] =>
        list.map((task) => {
            if (task.id === taskId) {
                return { ...task, ...patch };
            }
            return { ...task, children: updateTask(taskId, patch, task.children ?? []) };
        });

    const addRootTask = () => onChange([...tasks, createTaskNode()]);

    return (
        <div className="space-y-3">
            {(tasks ?? []).map((task) => (
                <TaskNodeEditor
                    key={task.id}
                    task={task}
                    onChange={(patch) => onChange(updateTask(task.id, patch))}
                    onDelete={() => onChange(tasks.filter((item) => item.id !== task.id))}
                />
            ))}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addRootTask}>
                <Plus className="h-3.5 w-3.5" />
                Add Task
            </Button>
        </div>
    );
}

function TaskNodeEditor({
    task,
    onChange,
    onDelete,
    depth = 0,
}: {
    task: SwsTaskNode;
    onChange: (patch: Partial<SwsTaskNode>) => void;
    onDelete: () => void;
    depth?: number;
}) {
    const children = task.children ?? [];
    const isNested = depth > 0;

    return (
        <div className={`group/task rounded-2xl border bg-card transition-shadow hover:shadow-sm ${isNested ? 'border-border/40 bg-muted/30' : 'border-border/60'}`}>
            {/* Task Header */}
            <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-3">
                    {/* Title Row */}
                    <div className="flex items-center gap-3">
                        <Input
                            value={task.title}
                            onChange={(event) => onChange({ title: event.target.value })}
                            className="h-10 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
                            placeholder="Task title..."
                        />
                    </div>
                    
                    {/* Description */}
                    <Textarea
                        value={task.description || ""}
                        onChange={(event) => onChange({ description: event.target.value })}
                        placeholder="Describe the work step, accessory note, or review guidance..."
                        className="min-h-[60px] resize-none border-0 bg-muted/40 text-sm placeholder:text-muted-foreground/60"
                    />
                    
                    {/* Inline Fields Grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Accessory hint</label>
                            <Input
                                value={task.accessoryHint || ""}
                                onChange={(event) => onChange({ accessoryHint: event.target.value })}
                                className="h-9 bg-muted/40"
                                placeholder="e.g., Hardware kit, tools needed"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Review requirement</label>
                            <Input
                                value={task.reviewRequirement || ""}
                                onChange={(event) => onChange({ reviewRequirement: event.target.value })}
                                className="h-9 bg-muted/40"
                                placeholder="e.g., Visual check, measurement"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <Select
                        value={task.required === false ? "optional" : "required"}
                        onValueChange={(value) => onChange({ required: value === "required" })}
                    >
                        <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="required">Required</SelectItem>
                            <SelectItem value="optional">Optional</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover/task:opacity-100"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Nested Tasks */}
            {(children.length > 0 || depth === 0) && (
                <div className="border-t border-border/40 bg-muted/20 px-4 py-3">
                    <div className="space-y-2">
                        {children.map((child, index) => (
                            <TaskNodeEditor
                                key={child.id}
                                task={child}
                                depth={depth + 1}
                                onChange={(patch) => {
                                    const nextChildren = [...children];
                                    nextChildren[index] = { ...nextChildren[index], ...patch };
                                    onChange({ children: nextChildren });
                                }}
                                onDelete={() => {
                                    onChange({ children: children.filter((item) => item.id !== child.id) });
                                }}
                            />
                        ))}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => onChange({ children: [...children, createTaskNode()] })}
                        >
                            <GitBranch className="h-3.5 w-3.5" />
                            Add Nested Task
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function SwsOperationMatrix({
    operations,
    onEdit,
    onDelete,
}: {
    operations: SwsOperationRecord[];
    onEdit: (operation: SwsOperationRecord) => void;
    onDelete: (operationId: string) => Promise<void>;
}) {
    const groupedOperations = operations.reduce<Record<string, SwsOperationRecord[]>>((acc, operation) => {
        acc[operation.targetType] = [...(acc[operation.targetType] ?? []), operation];
        return acc;
    }, {});

    return (
        <Card className="rounded-2xl border-border/60">
            <CardHeader>
                <CardTitle className="text-base">Operations Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {operations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No SWS operations yet. Link templates to parts, stacks, stages, and training modules here.</p>
                ) : (
                    Object.entries(groupedOperations).map(([targetType, targetOperations]) => (
                        <div key={targetType} className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{targetType}</p>
                                <Badge variant="outline">{targetOperations.length}</Badge>
                            </div>
                            {targetOperations.map((operation) => (
                                <div key={operation.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{operation.targetLabel}</p>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                            <span>{operation.templateId}</span>
                                            <Badge variant="outline">{operation.status ?? "active"}</Badge>
                                            {operation.note ? <span className="truncate">{operation.note}</span> : null}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(operation)}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => void onDelete(operation.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

export function SwsLinkedResourcePicker({
    draft,
    templates,
    parts,
    partFamilies,
    stacks,
    trainings,
    onChange,
    onSave,
}: {
    draft: { id: string; templateId: string; targetType: string; targetId: string; targetLabel: string; status: SwsOperationStatus; note: string };
    templates: SwsTemplateRecord[];
    parts: Array<{ partNumber: string; description: string }>;
    partFamilies: Array<{ id: string; familyName: string }>;
    stacks: Array<{ id: string; name: string }>;
    trainings: Array<{ id: string; name: string }>;
    onChange: (draft: { id: string; templateId: string; targetType: string; targetId: string; targetLabel: string; status: SwsOperationStatus; note: string }) => void;
    onSave: () => Promise<void>;
}) {
    const options = useMemo(() => {
        if (draft.targetType === "part-number") {
            return parts.map((part) => ({ id: part.partNumber, label: `${part.partNumber} · ${part.description}` }));
        }
        if (draft.targetType === "part-family") {
            return partFamilies.map((family) => ({ id: family.id, label: family.familyName }));
        }
        if (draft.targetType === "stack") {
            return stacks.map((stack) => ({ id: stack.id, label: stack.name }));
        }
        if (draft.targetType === "training-module") {
            return trainings.map((training) => ({ id: training.id, label: training.name }));
        }
        if (draft.targetType === "assignment-sws") {
            return [
                { id: "BLANK", label: "Blank / Basic" },
                { id: "RAIL", label: "Rail" },
                { id: "BOX", label: "Box" },
                { id: "PANEL", label: "Panel" },
                { id: "COMPONENT", label: "Component" },
                { id: "UNDECIDED", label: "Undecided" },
            ];
        }
        if (draft.targetType === "stage") {
            return [
                { id: "READY_TO_LAY", label: "Ready to Lay" },
                { id: "BUILD_UP", label: "Build Up" },
                { id: "WIRING", label: "Wiring" },
                { id: "BRANDING", label: "Branding" },
            ];
        }
        return [];
    }, [draft.targetType, partFamilies, parts, stacks, trainings]);

    return (
        <Card className="rounded-2xl border-border/60">
            <CardHeader>
                <CardTitle className="text-base">Create operation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select value={draft.templateId} onValueChange={(value) => onChange({ ...draft, templateId: value })}>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>
                        {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={draft.targetType} onValueChange={(value) => onChange({ ...draft, targetType: value, targetId: "", targetLabel: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="stage">Stage</SelectItem>
                        <SelectItem value="part-number">Part Number</SelectItem>
                        <SelectItem value="part-family">Part Family</SelectItem>
                        <SelectItem value="stack">Stack</SelectItem>
                        <SelectItem value="training-module">Training Module</SelectItem>
                        <SelectItem value="assignment-sws">Assignment SWS Type</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={draft.targetId}
                    onValueChange={(value) => {
                        const option = options.find((item) => item.id === value);
                        onChange({ ...draft, targetId: value, targetLabel: option?.label ?? value });
                    }}
                >
                    <SelectTrigger><SelectValue placeholder="Linked resource" /></SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={draft.status} onValueChange={(value) => onChange({ ...draft, status: value as SwsOperationStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                </Select>
                <Input value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} placeholder="Relation note or usage hint" />
                <Button className="gap-1.5" onClick={() => void onSave()} disabled={!draft.templateId || !draft.targetId}>
                    <Link2 className="h-3.5 w-3.5" />
                    {draft.id ? "Update Relation" : "Save Relation"}
                </Button>
            </CardContent>
        </Card>
    );
}

export function SwsSuggestionPanel({
    suggestions,
    onSelectSuggestion,
}: {
    suggestions: SwsSuggestionRule[];
    onSelectSuggestion: (suggestion: SwsSuggestionRule) => void;
}) {
    return (
        <div className="grid gap-3 lg:grid-cols-2">
            {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold">{suggestion.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p>
                        </div>
                        <Badge variant={suggestion.kind === "warning" ? "destructive" : suggestion.kind === "ready" ? "secondary" : "outline"}>
                            {suggestion.kind}
                        </Badge>
                    </div>
                    {suggestion.actionLabel ? (
                        <Button variant="ghost" size="sm" className="mt-3 gap-1.5 px-0" onClick={() => onSelectSuggestion(suggestion)}>
                            {suggestion.actionLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export function SwsUsageBadge({ kind, status }: { kind: SwsTemplateRecord["kind"]; status: SwsTemplateRecord["status"] }) {
    return (
        <div className="flex flex-col items-end gap-2">
            <Badge variant={kind === "standard" ? "secondary" : "outline"}>{kind}</Badge>
            <Badge variant={status === "active" ? "default" : "outline"}>{status}</Badge>
        </div>
    );
}

export function SwsTemplateAside({
    template,
    operations,
    usage,
    onChange,
    onSave,
    onClone,
    onDelete,
}: {
    template: SwsTemplateRecord | null;
    operations: SwsOperationRecord[];
    usage?: SwsUsageRecord;
    onChange: (template: SwsTemplateRecord | null) => void;
    onSave: () => Promise<void>;
    onClone: () => void;
    onDelete: () => Promise<void>;
}) {
    if (!template) {
        return (
            <div className="space-y-2">
                <p className="text-sm font-semibold">SWS Template Detail</p>
                <p className="text-sm text-muted-foreground">Select a template card to edit its name, guidance, status, and reusable operations.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Template Aside</p>
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="text-sm text-muted-foreground">Edit the reusable template while keeping tasks and operations visible in the main pane.</p>
            </div>
            <Field label="Name">
                <Input value={template.name} onChange={(event) => onChange({ ...template, name: event.target.value })} />
            </Field>
            <Field label="Description">
                <Textarea value={template.description || ""} onChange={(event) => onChange({ ...template, description: event.target.value })} />
            </Field>
            <Field label="Kind">
                <Select value={template.kind} onValueChange={(value: SwsTemplateRecord["kind"]) => onChange({ ...template, kind: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                </Select>
            </Field>
            <Field label="Status">
                <Select value={template.status} onValueChange={(value: SwsTemplateRecord["status"]) => onChange({ ...template, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Version Label">
                    <Input value={template.versionLabel || ""} onChange={(event) => onChange({ ...template, versionLabel: event.target.value })} placeholder="v1" />
                </Field>
                <Field label="Version Number">
                    <Input
                        type="number"
                        min={1}
                        value={template.version}
                        onChange={(event) => onChange({ ...template, version: Number(event.target.value) || 1 })}
                    />
                </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Member Badge">
                    <Input value={template.memberBadge || ""} onChange={(event) => onChange({ ...template, memberBadge: event.target.value })} placeholder="75241" />
                </Field>
                <Field label="Member Name">
                    <Input value={template.memberName || ""} onChange={(event) => onChange({ ...template, memberName: event.target.value })} placeholder="Team Lead" />
                </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Review Cadence (days)">
                    <Input
                        type="number"
                        min={0}
                        value={template.reviewCadenceDays ?? ""}
                        onChange={(event) =>
                            onChange({
                                ...template,
                                reviewCadenceDays: event.target.value ? Number(event.target.value) : null,
                            })
                        }
                        placeholder="30"
                    />
                </Field>
                <Field label="Approved By">
                    <Input value={template.approvedBy || ""} onChange={(event) => onChange({ ...template, approvedBy: event.target.value })} placeholder="Approver badge or name" />
                </Field>
            </div>
            <Field label="Notes">
                <Textarea value={template.notes || ""} onChange={(event) => onChange({ ...template, notes: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Button className="gap-1.5" onClick={() => void onSave()}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={onClone}>
                    <Copy className="h-3.5 w-3.5" />
                    Clone
                </Button>
            </div>
            <Button variant="ghost" className="w-full gap-1.5 text-destructive hover:text-destructive" onClick={() => void onDelete()}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete Template
            </Button>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-semibold">Linked resources</p>
                <div className="mt-3 space-y-2">
                    {operations.map((operation) => (
                        <div key={operation.id} className="flex items-center justify-between gap-2 text-sm">
                            <span>{operation.targetLabel}</span>
                            <Badge variant="outline">{operation.targetType}</Badge>
                        </div>
                    ))}
                    {operations.length === 0 ? <p className="text-sm text-muted-foreground">No links yet.</p> : null}
                </div>
                {usage ? (
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                        <span>{usage.stageIds.length} stages</span>
                        <span>{usage.stackIds.length} stacks</span>
                        <span>{usage.trainingModuleIds.length} training modules</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function SwsTemplateCollection({
    templates,
    selectedTemplateId,
    onSelectTemplate,
}: {
    templates: SwsTemplateRecord[];
    selectedTemplateId: string | null;
    onSelectTemplate: (templateId: string) => void;
}) {
    return (
        <div className="grid gap-4 xl:grid-cols-2">
            {templates.map((template) => (
                <SwsTemplateCard
                    key={template.id}
                    template={template}
                    isSelected={template.id === selectedTemplateId}
                    onSelect={() => onSelectTemplate(template.id)}
                />
            ))}
            {templates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                    No SWS templates yet. Create the first standard or custom template to start managing checklist operations.
                </div>
            ) : null}
        </div>
    );
}

function SwsUsageSummary({ usage }: { usage: SwsUsageRecord[] }) {
    return (
        <Card className="rounded-2xl border-border/60">
            <CardHeader>
                <CardTitle className="text-base">Usage Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {usage.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No linked usage yet. Connect templates to parts, stacks, stages, or training modules.</p>
                ) : (
                    usage.map((entry) => (
                        <div key={entry.templateId} className="rounded-2xl border border-border/60 p-3">
                            <p className="font-medium">{entry.templateId}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>{entry.stageIds.length} stages</span>
                                <span>{entry.partNumbers.length} parts</span>
                                <span>{entry.stackIds.length} stacks</span>
                                <span>{entry.trainingModuleIds.length} training links</span>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function StatusCard({ title, value }: { title: string; value: number }) {
    return (
        <Card className="rounded-2xl border-border/60 bg-card/80">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
        </Card>
    );
}

function SwsMetricCard({
    label,
    value,
    description,
}: {
    label: string;
    value: string;
    description: string;
}) {
    return (
        <Card className="rounded-2xl border-border/60 bg-card/80">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-2 text-sm">
            <span className="font-medium">{label}</span>
            {children}
        </label>
    );
}

function countTaskNodes(tasks: SwsTaskNode[]): number {
    return tasks.reduce((total, task) => total + 1 + countTaskNodes(task.children ?? []), 0);
}
