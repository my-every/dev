import {
    DetailSectionCard,
    SkeletonDefinitionListCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import {
    PROJECT_AUDIT_ITEMS,
    PROJECT_FEATURE_ACCESS,
    PROJECT_SETTINGS,
    PROJECT_OVERVIEW_ACTIONS,
} from "./project-fixtures";

type ProjectSettingsListProps = BaseStatefulProps<{
    settings: typeof PROJECT_SETTINGS;
    featureAccess: typeof PROJECT_FEATURE_ACCESS;
    auditItems: typeof PROJECT_AUDIT_ITEMS;
    overviewActions: typeof PROJECT_OVERVIEW_ACTIONS;
}>;

const DEFAULT_DATA = {
    settings: PROJECT_SETTINGS,
    featureAccess: PROJECT_FEATURE_ACCESS,
    auditItems: PROJECT_AUDIT_ITEMS,
    overviewActions: PROJECT_OVERVIEW_ACTIONS,
};

export function ProjectSettingsList({ mode = "default", data = DEFAULT_DATA, className }: ProjectSettingsListProps) {
    return (
        <div className={className}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.75fr)]">
                <div className="space-y-4">
                    <DetailSectionCard
                        title="Project Settings"
                        description="Feature toggles and workflow configuration"
                        action={mode === "skeleton" ? <Skeleton className="h-9 w-28 rounded-xl" /> : undefined}
                    >
                        <div className="space-y-3">
                            {mode === "skeleton"
                                ? Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <Skeleton className="h-4 w-48 max-w-[60%]" />
                                            <Skeleton className="h-3 w-full max-w-[85%]" />
                                        </div>
                                        <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
                                    </div>
                                ))
                                : data.settings.map((item) => (
                                    <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="text-sm font-medium text-foreground">{item.title}</div>
                                            <div className="text-xs text-muted-foreground">{item.description}</div>
                                        </div>
                                        <span className={`rounded-full border border-border bg-card px-2.5 py-1 text-[11px] ${item.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                                            {item.enabled ? "On" : "Off"}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>

                    <DetailSectionCard title="Audit Log" description="Recent changes to project config and access">
                        <div className="space-y-3">
                            {mode === "skeleton"
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex gap-3">
                                        <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <Skeleton className="h-4 w-44" />
                                            <Skeleton className="h-3 w-full max-w-[88%]" />
                                        </div>
                                    </div>
                                ))
                                : data.auditItems.map((item) => (
                                    <div key={item.title} className="flex gap-3">
                                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/60" />
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="text-sm font-medium text-foreground">{item.title}</div>
                                            <div className="text-xs text-muted-foreground">{item.detail}</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>

                <div className="space-y-4">
                    {mode === "skeleton" ? (
                        <SkeletonDefinitionListCard rows={5} />
                    ) : (
                        <DetailSectionCard title="Feature Access" description="Role-based access per feature">
                            <div className="space-y-3">
                                {data.featureAccess.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-foreground">{item.label}</span>
                                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </DetailSectionCard>
                    )}

                    <DetailSectionCard title="Quick Actions">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                                ))
                                : data.overviewActions.map((action) => (
                                    <button
                                        key={action}
                                        type="button"
                                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent"
                                    >
                                        {action}
                                    </button>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>
            </div>
        </div>
    );
}
