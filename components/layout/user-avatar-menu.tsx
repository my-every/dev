"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Status } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export type UserPresence = "online" | "away" | "offline";

export type UserAvatarMenuProps = {
    fullName: string;
    role?: string;
    email?: string;
    imageSrc?: string;
    initials?: string;
    presence?: UserPresence;
    showName?: boolean;
    interactive?: boolean;
    className?: string;
    onSignOutSelect?: () => void;
};

const SPRING = {
    type: "spring",
    stiffness: 340,
    damping: 28,
    mass: 0.8,
} as const;

const PRESENCE_LABEL: Record<UserPresence, string> = {
    online: "Online",
    away: "Away",
    offline: "Offline",
};

const PRESENCE_TO_STATUS: Record<UserPresence, "online" | "offline" | "degraded"> = {
    online: "online",
    away: "degraded",
    offline: "offline",
};

const PRESENCE_COLOR: Record<UserPresence, string> = {
    online: "bg-emerald-500",
    away: "bg-amber-500",
    offline: "bg-slate-400",
};

function getInitials(name: string, fallback = "ME") {
    const chunks = name
        .split(" ")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 2);

    if (chunks.length === 0) {
        return fallback;
    }

    return chunks.map((item) => item[0]?.toUpperCase() ?? "").join("");
}

export function UserAvatarMenu({
    fullName,
    role = "Member",
    email,
    imageSrc,
    initials,
    presence = "online",
    showName = true,
    interactive = true,
    className,
    onSignOutSelect,
}: UserAvatarMenuProps) {
    const derivedInitials = initials ?? getInitials(fullName);
    const [open, setOpen] = useState(false);

    if (!interactive) {
        return (
            <div
                className={cn(
                    "group flex max-w-full items-center rounded-2xl border border-border bg-card/90 text-left",
                    showName ? "gap-2 py-1.5 pl-2 pr-5" : "h-12 w-12 justify-center p-0",
                    className
                )}
                aria-label="User info"
            >
                <span className="relative">
                    <Avatar size="lg" className="rounded-2xl after:rounded-2xl">
                        {imageSrc ? <AvatarImage src={imageSrc} alt={fullName} className="rounded-2xl" /> : null}
                        <AvatarFallback className="rounded-2xl">{derivedInitials}</AvatarFallback>
                    </Avatar>
                    <span
                        className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background",
                            PRESENCE_COLOR[presence]
                        )}
                    />
                </span>

                {showName ? (
                    <span className="hidden min-w-0 md:block">
                        <span className="block truncate text-sm font-medium text-foreground">{fullName}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{role}</span>
                    </span>
                ) : null}
            </div>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "group flex max-w-full items-center rounded-2xl border border-border bg-card/90 text-left transition-colors hover:bg-accent",
                        showName ? "gap-2 py-1.5 pl-2 pr-5" : "h-12 w-12 justify-center p-0",
                        className
                    )}
                    aria-label="Open user menu"
                >
                    <span className="relative">
                        <Avatar size="lg" className="rounded-2xl after:rounded-2xl">
                            {imageSrc ? <AvatarImage src={imageSrc} alt={fullName} className="rounded-2xl" /> : null}
                            <AvatarFallback className="rounded-2xl">{derivedInitials}</AvatarFallback>
                        </Avatar>
                        <span
                            className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background",
                                PRESENCE_COLOR[presence]
                            )}
                        />
                    </span>

                    {showName ? (
                        <span className="hidden min-w-0 md:block">
                            <span className="block truncate text-sm font-medium text-foreground">{fullName}</span>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{role}</span>
                        </span>
                    ) : null}
                </button>
            </PopoverTrigger>

            <AnimatePresence>
                {open ? (
                    <PopoverContent forceMount align="start" side="right" sideOffset={12} className="w-64 border-0 bg-transparent p-4 shadow-none ring-0">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, x: -8, y: 6 }}
                            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, x: -6, y: 4 }}
                            transition={SPRING}
                            className="overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
                        >
                            <div className="relative p-3 pr-24">
                                <div className="flex items-start flex-col">
                                    <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
                                    {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
                                </div>
                                <Status status={PRESENCE_TO_STATUS[presence]} size="sm" className="absolute right-3 top-3 text-xs">
                                    {PRESENCE_LABEL[presence]}
                                </Status>

                            </div>

                            <div className="border-t border-border p-1.5">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                                    onClick={() => {
                                        onSignOutSelect?.();
                                        setOpen(false);
                                    }}
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Sign out</span>
                                </button>
                            </div>
                        </motion.div>
                    </PopoverContent>
                ) : null}
            </AnimatePresence>
        </Popover>
    );
}
