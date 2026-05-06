import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type UserPermissionsDetailCardProps = BaseStatefulProps<Array<{ label: string; value: string }>>;

export function UserPermissionsDetailCard({ mode = "default", data = [] }: UserPermissionsDetailCardProps) {
    return (
        <DetailSectionCard title="Permissions" description="Expanded access flags and configured user settings.">
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    ))
                    : data.map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between rounded-xl border border-border bg-background/80 px-3 py-3">
                            <span className="text-sm text-foreground">{entry.label}</span>
                            <span className="text-sm font-medium text-muted-foreground">{entry.value}</span>
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}
