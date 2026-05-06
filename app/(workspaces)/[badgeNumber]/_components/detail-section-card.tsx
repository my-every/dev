import type { ReactNode } from "react";

import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "./workspace-view-mode";

type DetailSectionCardProps = BaseStatefulProps & {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    children?: ReactNode;
};

export function DetailSectionCard({
    mode = "default",
    title,
    description,
    action,
    children,
    className,
}: DetailSectionCardProps) {
    if (mode === "skeleton") {
        return (
            <Card className={cn("gap-4 rounded-2xl border border-border bg-card/60 py-2.5", className)}>
                <CardHeader className="gap-3 px-4 py-4 sm:px-5">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-56 max-w-[85%]" />
                    </div>
                    <CardAction>
                        <Skeleton className="h-8 w-20 rounded-xl" />
                    </CardAction>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("gap-4 rounded-2xl border border-border bg-card/60 py-0", className)}>
            {(title || description || action) ? (
                <CardHeader className="gap-2 px-4 py-4 sm:px-5">
                    <div className="min-w-0 space-y-1.5">
                        {title ? <CardTitle className="text-sm font-medium text-foreground sm:text-base">{title}</CardTitle> : null}
                        {description ? <CardDescription className="text-xs sm:text-sm">{description}</CardDescription> : null}
                    </div>
                    {action ? <CardAction>{action}</CardAction> : null}
                </CardHeader>
            ) : null}
            {children ? <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</CardContent> : null}
        </Card>
    );
}