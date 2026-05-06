import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PART_SPECIFICATION_SECTIONS } from "./part-fixtures";

type PartSpecificationGroupProps = BaseStatefulProps<typeof PART_SPECIFICATION_SECTIONS>;

export function PartSpecificationGroup({ mode = "default", data = PART_SPECIFICATION_SECTIONS, className }: PartSpecificationGroupProps) {
    return (
        <div className={className}>
            <div className="space-y-4">
                {data.map((section) => (
                    <DetailSectionCard key={section.title} title={section.title}>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2.5">
                                        <Skeleton className="h-3.5 w-28" />
                                        <Skeleton className="h-3.5 w-20" />
                                    </div>
                                ))
                                : section.rows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2.5">
                                        <span className="text-sm text-foreground">{row.label}</span>
                                        <span className="text-xs text-muted-foreground">{row.value}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                ))}
            </div>
        </div>
    );
}