import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserTitleLabel } from "./users-display";

type UserIdentityData = {
    badge: string;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    department?: string | null;
    title?: string | null;
    bio?: string | null;
};

type UserIdentityCardProps = BaseStatefulProps<UserIdentityData>;

export function UserIdentityCard({ mode = "default", data }: UserIdentityCardProps) {
    return (
        <DetailSectionCard title="Overview" description="Primary identity and contact details for this user.">
            <div className="grid gap-3 md:grid-cols-2">
                {mode === "skeleton"
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="mt-2 h-4 w-32" />
                        </div>
                    ))
                    : [
                        ["Badge", data?.badge ?? "—"],
                        ["Email", data?.email ?? "—"],
                        ["Phone", data?.phone ?? "—"],
                        ["Location", data?.location ?? "—"],
                        ["Department", data?.department ?? "—"],
                        ["Title", getUserTitleLabel({ title: data?.title ?? null, role: data?.role ?? null })],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
                            <div className="mt-1 text-sm text-foreground">{value}</div>
                        </div>
                    ))}
            </div>
            {mode === "dynamic" && data?.bio ? (
                <div className="mt-4 rounded-xl border border-border bg-background/80 px-3 py-3 text-sm text-muted-foreground">
                    {data.bio}
                </div>
            ) : null}
        </DetailSectionCard>
    );
}
