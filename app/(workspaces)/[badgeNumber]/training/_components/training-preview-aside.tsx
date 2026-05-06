import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, Link2, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DetailSectionCard, SkeletonDefinitionListCard } from "@/app/(workspaces)/[badgeNumber]/_components";

import type { WorkspaceTrainingCategory, WorkspaceTrainingRecord } from "./training-types";

type TrainingPreviewAsideProps = {
    badgeNumber: string;
    module: WorkspaceTrainingRecord | null;
    categories: WorkspaceTrainingCategory[];
};

export function TrainingPreviewAside({ badgeNumber, module, categories }: TrainingPreviewAsideProps) {
    if (!module) {
        return (
            <div className="space-y-4 p-4">
                <SkeletonDefinitionListCard rows={4} />
            </div>
        );
    }

    const category = categories.find((entry) => entry.id === module.category);

    return (
        <div className="space-y-4 p-4">
            <DetailSectionCard title="Module Preview" description="Quick training summary before opening the full workspace.">
                <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                        <div className="text-lg font-medium text-foreground">{module.name}</div>
                        <div className="text-muted-foreground">{module.id}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{normalizeLabel(module.status)}</Badge>
                        <Badge variant="outline">{normalizeLabel(module.difficulty)}</Badge>
                        {category ? <Badge variant="outline">{category.label}</Badge> : null}
                    </div>
                    {module.description ? <div className="text-muted-foreground">{module.description}</div> : null}
                </div>
            </DetailSectionCard>

            <DetailSectionCard title="Coverage">
                <div className="space-y-3 text-sm">
                    <PreviewRow icon={BookOpen} label="Stages" value={`${module.enabledStages.length}`} />
                    <PreviewRow icon={Clock3} label="Minutes" value={module.totalEstimatedMinutes ? `${module.totalEstimatedMinutes}` : "—"} />
                    <PreviewRow icon={Link2} label="Part numbers" value={`${module.partNumbers.length}`} />
                    <PreviewRow icon={Tag} label="Tags" value={`${module.tags.length}`} />
                </div>
            </DetailSectionCard>

            <DetailSectionCard title="Open full detail">
                <Button asChild className="w-full rounded-xl">
                    <Link href={`/${badgeNumber}/training/${module.id}`}>
                        Open training workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </DetailSectionCard>
        </div>
    );
}

function PreviewRow({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{label}:</span>
            <span className="truncate text-foreground">{value}</span>
        </div>
    );
}

function normalizeLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
