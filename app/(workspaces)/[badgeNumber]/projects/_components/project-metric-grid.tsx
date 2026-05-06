import { SkeletonMetricGrid } from "@/app/(workspaces)/[badgeNumber]/_components";
import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

import { PROJECT_METRICS } from "./project-fixtures";

type ProjectMetricGridProps = BaseStatefulProps<typeof PROJECT_METRICS>;

export function ProjectMetricGrid({ mode = "default", data = PROJECT_METRICS, className }: ProjectMetricGridProps) {
    if (mode === "skeleton") {
        return <SkeletonMetricGrid className={className} />;
    }

    return (
        <div className={className}>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {data.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-border bg-card/60 p-4">
                        <p className="mb-3 text-xs text-muted-foreground">{metric.label}</p>
                        <div className="mb-2 text-2xl font-semibold tracking-tight text-foreground">{metric.value}</div>
                        <p className="text-xs text-muted-foreground">{metric.note}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}