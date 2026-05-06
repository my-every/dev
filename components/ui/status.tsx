import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusProps = HTMLAttributes<HTMLSpanElement> & {
    status: "online" | "offline" | "maintenance" | "degraded";
    size?: "sm" | "md" | "lg";
    children?: ReactNode;
};

const STATUS_BG = {
    online: "bg-emerald-500",
    offline: "bg-red-500",
    maintenance: "bg-blue-500",
    degraded: "bg-amber-500",
} as const;

const SIZE_STYLES = {
    sm: { container: "px-1.5 py-0.5 text-[10px]", dot: "h-1.5 w-1.5" },
    md: { container: "px-2 py-0.5 text-xs", dot: "h-2 w-2" },
    lg: { container: "px-2.5 py-1 text-sm", dot: "h-2.5 w-2.5" },
} as const;

export const Status = ({ className, status, size = "md", children, ...props }: StatusProps) => (
    <span
        className={cn(
            "inline-flex items-center gap-1.5 rounded-full font-medium",
            SIZE_STYLES[size].container,
            "group",
            status,
            className
        )}
        {...props}
    >
        <span className={cn("rounded-full", SIZE_STYLES[size].dot, STATUS_BG[status])} />
        {children}
    </span>
);

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement>;

export const StatusIndicator = ({
    className,
    ...props
}: StatusIndicatorProps) => (
    <span className={cn("relative flex h-2 w-2", className)} {...props}>
        <span
            className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                "group-[.online]:bg-emerald-500",
                "group-[.offline]:bg-red-500",
                "group-[.maintenance]:bg-blue-500",
                "group-[.degraded]:bg-amber-500"
            )}
        />
        <span
            className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                "group-[.online]:bg-emerald-500",
                "group-[.offline]:bg-red-500",
                "group-[.maintenance]:bg-blue-500",
                "group-[.degraded]:bg-amber-500"
            )}
        />
    </span>
);

export type StatusLabelProps = HTMLAttributes<HTMLSpanElement>;

export const StatusLabel = ({
    className,
    children,
    ...props
}: StatusLabelProps) => (
    <span className={cn("text-muted-foreground", className)} {...props}>
        {children ?? (
            <>
                <span className="hidden group-[.online]:block">Online</span>
                <span className="hidden group-[.offline]:block">Offline</span>
                <span className="hidden group-[.maintenance]:block">Maintenance</span>
                <span className="hidden group-[.degraded]:block">Degraded</span>
            </>
        )}
    </span>
);
