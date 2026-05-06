import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PROFILE_ACTIVITY } from "./profile-fixtures";

type ProfileActivityTimelineProps = BaseStatefulProps<typeof PROFILE_ACTIVITY>;

export function ProfileActivityTimeline({ mode = "default", data = PROFILE_ACTIVITY, className }: ProfileActivityTimelineProps) {
    return (
        <DetailSectionCard
            className={className}
            title="Activity Log"
            description="Logins, edits, completions, and events"
            action={mode === "skeleton" ? <Skeleton className="h-8 w-24 rounded-full" /> : <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">Recent</span>}
        >
            <div className="space-y-4">
                {mode === "skeleton"
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                            <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-full max-w-[90%]" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    ))
                    : data.map((item) => (
                        <div key={`${item.title}-${item.timestamp}`} className="flex gap-3">
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/60" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="text-sm font-medium text-foreground">{item.title}</div>
                                <div className="text-sm text-muted-foreground">{item.detail}</div>
                                <div className="text-xs text-muted-foreground">{item.timestamp}</div>
                            </div>
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}