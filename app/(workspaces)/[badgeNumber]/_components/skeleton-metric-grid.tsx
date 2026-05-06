import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonMetricGridProps = {
    count?: number;
    className?: string;
};

export function SkeletonMetricGrid({ count = 4, className }: SkeletonMetricGridProps) {
    return (
        <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-border bg-card/60 p-4">
                    <Skeleton className="mb-3 h-4 w-24" />
                    <Skeleton className="mb-2 h-8 w-16" />
                    <Skeleton className="h-3 w-28" />
                </div>
            ))}
        </div>
    );
}