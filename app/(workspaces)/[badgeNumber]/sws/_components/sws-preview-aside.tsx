"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, GitBranch, Link2, Route } from "lucide-react";

import { DetailSectionCard } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { WorkspaceSwsTemplateRecord } from "./sws-types";

type SWSPreviewAsideProps = {
    badgeNumber: string;
    record: WorkspaceSwsTemplateRecord | null;
    contextProjectId?: string;
    contextSheetSlug?: string;
};

export function SWSPreviewAside({ badgeNumber, record, contextProjectId, contextSheetSlug }: SWSPreviewAsideProps) {
    if (!record) {
        return (
            <div className="space-y-4 p-4">
                <DetailSectionCard title="SWS Preview" description="Select a template to review stage coverage, linked operations, and checklist size." />
            </div>
        );
    }

    const hasAssignmentContext = Boolean(contextProjectId && contextSheetSlug);
    const detailQuery = hasAssignmentContext
        ? `?projectId=${encodeURIComponent(contextProjectId!)}&sheetSlug=${encodeURIComponent(contextSheetSlug!)}`
        : "";
    const assignmentQuery = hasAssignmentContext
        ? `?section=summary&action=sws&swsSheetSlug=${encodeURIComponent(contextSheetSlug!)}`
        : "";

    return (
        <div className="space-y-4 p-4">
            <DetailSectionCard
                title={record.template.name}
                description={record.template.description || "Reusable SWS template for staged checklist execution."}
                action={<Badge variant={record.template.status === "active" ? "default" : "outline"}>{record.template.status}</Badge>}
            >
                <div className="flex flex-wrap gap-2">
                    <Badge variant={record.template.kind === "standard" ? "secondary" : "outline"}>
                        {record.template.kind}
                    </Badge>
                    {record.template.versionLabel ? <Badge variant="outline">{record.template.versionLabel}</Badge> : null}
                    {record.isRegistryTemplate ? <Badge variant="outline">Registry</Badge> : null}
                </div>
            </DetailSectionCard>

            <DetailSectionCard title="Stage Coverage" description="This template is attached to the following assignment stages.">
                <div className="flex flex-wrap gap-2">
                    {record.stageLabels.length > 0 ? (
                        record.stageLabels.map((stage) => (
                            <Badge key={stage} variant="outline">{stage}</Badge>
                        ))
                    ) : (
                        <div className="text-sm text-muted-foreground">No explicit stage operations linked yet.</div>
                    )}
                </div>
            </DetailSectionCard>

            <DetailSectionCard title="Template Summary" description="Checklist size and linked usage.">
                <div className="grid gap-3">
                    <MetricRow icon={ClipboardList} label="Checklist Groups" value={`${record.summary.groupCount}`} />
                    <MetricRow icon={GitBranch} label="Tasks" value={`${record.summary.taskCount}`} />
                    <MetricRow icon={Link2} label="Operations" value={`${record.summary.operationCount}`} />
                    <MetricRow
                        icon={Route}
                        label="Usage"
                        value={`${record.usage?.stageIds.length ?? 0} stages / ${record.usage?.trainingModuleIds.length ?? 0} training`}
                    />
                </div>
            </DetailSectionCard>

            <Button asChild className="w-full gap-2">
                <Link href={`/${badgeNumber}/sws/${encodeURIComponent(record.id)}${detailQuery}`}>
                    Open Template
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </Button>

            {hasAssignmentContext ? (
                <Button asChild variant="outline" className="w-full gap-2">
                    <Link href={`/${badgeNumber}/projects/${encodeURIComponent(contextProjectId!)}${assignmentQuery}`}>
                        Open Assignment SWS
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            ) : null}
        </div>
    );
}

function MetricRow({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof ClipboardList;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-border bg-background/80 px-3 py-3">
            <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-foreground">{label}</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{value}</span>
        </div>
    );
}
