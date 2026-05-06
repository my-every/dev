import { BookOpen, Clock3, FolderTree, Link2 } from "lucide-react";

import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type TrainingMetricGridData = {
    totalModules: number;
    totalCategories: number;
    publishedModules: number;
    linkedPartNumbers: number;
};

type TrainingMetricGridProps = BaseStatefulProps<TrainingMetricGridData>;

const METRICS = [
    { key: "totalModules", label: "Modules", icon: BookOpen },
    { key: "totalCategories", label: "Categories", icon: FolderTree },
    { key: "publishedModules", label: "Published", icon: Clock3 },
    { key: "linkedPartNumbers", label: "Linked Parts", icon: Link2 },
] as const;

export function TrainingMetricGrid({ mode = "default", data }: TrainingMetricGridProps) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {METRICS.map((metric) => {
                const Icon = metric.icon;
                return (
                    <DetailSectionCard key={metric.key} className="p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground sm:h-11 sm:w-11 sm:rounded-2xl">
                                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div className="min-w-0 space-y-0.5 sm:space-y-1">
                                <div className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.14em]">{metric.label}</div>
                                {mode === "skeleton" ? (
                                    <Skeleton className="h-5 w-12 sm:h-6 sm:w-16" />
                                ) : (
                                    <div className="text-xl font-medium text-foreground sm:text-2xl">{data?.[metric.key] ?? 0}</div>
                                )}
                            </div>
                        </div>
                    </DetailSectionCard>
                );
            })}
        </div>
    );
}
