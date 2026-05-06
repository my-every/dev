"use client";

import {
    DetailSectionCard,
    SkeletonMetricGrid,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";

type PartsMetricGridData = {
    totalParts: number;
    totalCategories: number;
    catalogEnriched: number;
    photoCoverage: number;
};

type PartsMetricGridProps = BaseStatefulProps<PartsMetricGridData>;

export function PartsMetricGrid({ mode = "default", data, className }: PartsMetricGridProps) {
    if (mode === "skeleton") {
        return <SkeletonMetricGrid className={className} count={4} />;
    }

    const metrics = [
        { label: "Parts", value: `${data?.totalParts ?? 0}`, description: "Live library records" },
        { label: "Categories", value: `${data?.totalCategories ?? 0}`, description: "Active part groupings" },
        { label: "Catalog", value: `${data?.catalogEnriched ?? 0}`, description: "Enriched catalog entries" },
        { label: "Photos", value: `${data?.photoCoverage ?? 0}`, description: "Parts with reference imagery" },
    ];

    return (
        <div className={className}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {metrics.map((metric) => (
                    <DetailSectionCard key={metric.label} className="p-3 sm:p-4">
                        <div className="space-y-1 sm:space-y-2">
                            <div className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">{metric.label}</div>
                            <div className="text-xl font-semibold text-foreground sm:text-2xl">{metric.value}</div>
                            <div className="line-clamp-2 text-[10px] text-muted-foreground sm:text-xs">{metric.description}</div>
                        </div>
                    </DetailSectionCard>
                ))}
            </div>
        </div>
    );
}
