import { Skeleton } from "@/components/ui/skeleton";

import { DetailSectionCard } from "./detail-section-card";

type SkeletonDefinitionListCardProps = {
    rows?: number;
    className?: string;
};

export function SkeletonDefinitionListCard({ rows = 6, className }: SkeletonDefinitionListCardProps) {
    return (
        <DetailSectionCard mode="default" className={className}>
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3.5 w-20" />
                    </div>
                ))}
            </div>
        </DetailSectionCard>
    );
}