import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PART_ALTERNATES, PART_INSTRUCTIONS, PART_NOTES } from "./part-fixtures";

type PartInstructionListProps = BaseStatefulProps<{
    instructions: typeof PART_INSTRUCTIONS;
    alternates: typeof PART_ALTERNATES;
    notes: typeof PART_NOTES;
}> & {
    variant?: "overview" | "notes";
};

const DEFAULT_DATA = {
    instructions: PART_INSTRUCTIONS,
    alternates: PART_ALTERNATES,
    notes: PART_NOTES,
};

export function PartInstructionList({ mode = "default", data = DEFAULT_DATA, variant = "overview", className }: PartInstructionListProps) {
    const records = variant === "overview" ? data.instructions : data.notes;

    return (
        <div className={className}>
            {variant === "overview" ? (
                <div className="space-y-4">
                    <DetailSectionCard title="Instructions" description="Do, don't, and warnings">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-lg" />
                                        <Skeleton className="h-4 flex-1 max-w-[90%]" />
                                    </div>
                                ))
                                : records.map((item) => (
                                    <div key={`${item.type}-${item.text}`} className="flex gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-lg border border-border bg-card px-1 text-[10px] text-muted-foreground">
                                            {item.type}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-sm text-foreground">{item.text}</div>
                                            <div className="mt-1 text-xs text-muted-foreground">{item.stage}</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>

                    <DetailSectionCard title="Alternates" description="Cross-reference part numbers">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                        <Skeleton className="h-3.5 w-28" />
                                        <Skeleton className="h-5 w-20 rounded-full" />
                                    </div>
                                ))
                                : data.alternates.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-foreground">{item.label}</span>
                                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.value}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>
            ) : (
                <DetailSectionCard title="Assembly Notes" description="Stage-specific instructions and cautions">
                    <div className="space-y-3">
                        {mode === "skeleton"
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-border bg-background/70 p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-4 w-full max-w-[95%]" />
                                </div>
                            ))
                            : records.map((item) => (
                                <div key={`${item.type}-${item.text}`} className="rounded-xl border border-border bg-background/70 p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.type}</span>
                                        <span className="text-xs text-muted-foreground">{item.stage}</span>
                                    </div>
                                    <div className="text-sm text-foreground">{item.text}</div>
                                </div>
                            ))}
                    </div>
                </DetailSectionCard>
            )}
        </div>
    );
}