import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonEntityListProps = {
    count?: number;
    className?: string;
};

export function SkeletonEntityList({ count = 5, className }: SkeletonEntityListProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-40 max-w-[70%]" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-3 w-14" />
                        </div>
                    </div>
                    <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
                </div>
            ))}
        </div>
    );
}