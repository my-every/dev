import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PROFILE_TRAINING } from "./profile-fixtures";

type ProfileTrainingProgressProps = BaseStatefulProps<typeof PROFILE_TRAINING>;

export function ProfileTrainingProgress({ mode = "default", data = PROFILE_TRAINING, className }: ProfileTrainingProgressProps) {
    return (
        <DetailSectionCard className={className} title="Certifications" description="Completed and in-progress training modules">
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-44 max-w-[65%]" />
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <Skeleton className="h-full rounded-full" style={{ width: `${30 + (i * 15) % 65}%` }} />
                                </div>
                            </div>
                            <Skeleton className="h-7 w-20 rounded-full" />
                        </div>
                    ))
                    : data.map((item) => (
                        <div key={item.title} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground">
                                TR
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="text-sm font-medium text-foreground">{item.title}</div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-foreground/60" style={{ width: item.width }} />
                                </div>
                            </div>
                            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.status}</span>
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}