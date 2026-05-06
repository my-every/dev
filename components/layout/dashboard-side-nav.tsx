"use client";

/**
 * DashboardSideNav
 *
 * Reusable side panel navigation for all dashboard pages.
 * Supports:
 *  - Top-level menu items with optional sub-items (tabs within a view)
 *  - Permission-based visibility via `requiredAccess`
 *  - Drill-in sub-menu with animated back-button header
 *  - Optional "Back to Roles" link for non-developer dashboards
 *  - Consistent styling across developer/manager/supervisor dashboards
 */

import { useState, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DashboardAccess } from "@/types/user-settings";

// ============================================================================
// Types
// ============================================================================

export interface SideNavSubItem {
    /** Unique ID for this sub-item (used as tab value) */
    id: string;
    /** Display label */
    label: string;
    /** Optional icon */
    icon?: React.ElementType;
    /** Access key from DashboardAccess — sub-item hidden when access is false */
    requiredAccess?: keyof DashboardAccess;
}

export interface SideNavItem {
    /** Unique view ID */
    id: string;
    /** Display label */
    label: string;
    /** Icon component */
    icon: React.ElementType;
    /** Sub-items rendered as drill-in tabs */
    subItems?: SideNavSubItem[];
    /** Optional inline content shown below the item when active (e.g. status panel) */
    activeSlot?: ReactNode;
    /** Access key from DashboardAccess — item hidden when access is false */
    requiredAccess?: keyof DashboardAccess;
    /** If true, item is always visible regardless of access */
    alwaysVisible?: boolean;
}

export interface DashboardSideNavProps {
    /** Menu items to render */
    items: SideNavItem[];
    /** Currently active view ID */
    activeView: string;
    /** Called when a top-level view changes */
    onViewChange: (viewId: string) => void;
    /** Currently active sub-item (tab) within the active view */
    activeSubItem?: string | null;
    /** Called when a sub-item tab is selected */
    onSubItemChange?: (subItemId: string) => void;
    /** Dashboard access permissions for the current user */
    access?: Partial<DashboardAccess>;
    /** Optional "Back to Roles" link (manager/supervisor dashboards) */
    backHref?: string;
    /** Optional class name */
    className?: string;
}

// ============================================================================
// Animation
// ============================================================================

const SLIDE_VARIANTS = {
    enter: (direction: number) => ({
        x: direction > 0 ? 60 : -60,
        opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
        x: direction > 0 ? -60 : 60,
        opacity: 0,
    }),
};

const SPRING = { type: "spring" as const, stiffness: 400, damping: 32, mass: 0.8 };

// ============================================================================
// Component
// ============================================================================

export function DashboardSideNav({
    items,
    activeView,
    onViewChange,
    activeSubItem,
    onSubItemChange,
    access,
    backHref,
    className,
}: DashboardSideNavProps) {
    // Track which view is "drilled in" to show sub-items
    const [drilledView, setDrilledView] = useState<string | null>(null);
    const [direction, setDirection] = useState(1);

    // Filter items by permission
    const visibleItems = useMemo(() => {
        return items.filter(item => {
            if (item.alwaysVisible) return true;
            if (!item.requiredAccess) return true;
            if (!access) return true; // no access config = show all
            return access[item.requiredAccess] !== false;
        });
    }, [items, access]);

    // Active item config
    const activeItem = useMemo(() => {
        return items.find(i => i.id === activeView);
    }, [items, activeView]);

    // Drilled item config with filtered sub-items
    const drilledItem = useMemo(() => {
        if (!drilledView) return null;
        const item = items.find(i => i.id === drilledView);
        if (!item) return null;
        
        // Filter sub-items by permission
        const filteredSubItems = item.subItems?.filter(sub => {
            if (!sub.requiredAccess) return true;
            if (!access) return true;
            return access[sub.requiredAccess] !== false;
        });
        
        return { ...item, subItems: filteredSubItems };
    }, [items, drilledView, access]);

    const handleItemClick = useCallback((item: SideNavItem) => {
        onViewChange(item.id);
        if (item.subItems && item.subItems.length > 0) {
            setDirection(1);
            setDrilledView(item.id);
            // Auto-select first visible sub-item if none selected
            if (!activeSubItem || activeView !== item.id) {
                // Filter to visible sub-items
                const visibleSubs = item.subItems.filter(sub => {
                    if (!sub.requiredAccess) return true;
                    if (!access) return true;
                    return access[sub.requiredAccess] !== false;
                });
                if (visibleSubs.length > 0) {
                    onSubItemChange?.(visibleSubs[0].id);
                }
            }
        } else {
            setDrilledView(null);
        }
    }, [onViewChange, onSubItemChange, activeSubItem, activeView, access]);

    const handleBack = useCallback(() => {
        setDirection(-1);
        setDrilledView(null);
    }, []);

    const handleSubItemClick = useCallback((subId: string) => {
        onSubItemChange?.(subId);
    }, [onSubItemChange]);

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {/* Back to Roles (manager/supervisor only) */}
                {backHref && !drilledView && (
                    <Button variant="ghost" size="sm" asChild className="w-full justify-start gap-2 mb-2 text-muted-foreground hover:text-foreground">
                        <Link href={backHref}>
                            <ArrowLeft className="h-3 w-3" />
                            Back to Roles
                        </Link>
                    </Button>
                )}

                <AnimatePresence mode="wait" custom={direction} initial={false}>
                    {drilledView && drilledItem ? (
                        /* ─── Sub-items view ─── */
                        <motion.div
                            key={`sub-${drilledView}`}
                            custom={direction}
                            variants={SLIDE_VARIANTS}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={SPRING}
                            className="space-y-1"
                        >
                            {/* Back header */}
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer mb-1"
                            >
                                <ArrowLeft className="h-3 w-3" />
                                <span>{drilledItem.label}</span>
                            </button>

                            {/* Sub-items */}
                            {drilledItem.subItems?.map((sub) => {
                                const SubIcon = sub.icon;
                                const isActive = activeSubItem === sub.id;
                                return (
                                    <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => handleSubItemClick(sub.id)}
                                        className={cn(
                                            "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors cursor-pointer",
                                            isActive
                                                ? "bg-accent text-foreground font-medium shadow-sm"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {SubIcon && <SubIcon className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">{sub.label}</span>
                                        {isActive && (
                                            <motion.div
                                                layoutId={`sub-indicator-${drilledView}`}
                                                className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                                                transition={SPRING}
                                            />
                                        )}
                                    </button>
                                );
                            })}

                            {/* Active slot (inline content below active view's sub-items) */}
                            {drilledItem.activeSlot}
                        </motion.div>
                    ) : (
                        /* ─── Top-level items ─── */
                        <motion.div
                            key="top-level"
                            custom={direction}
                            variants={SLIDE_VARIANTS}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={SPRING}
                            className="space-y-1"
                        >
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeView === item.id;
                                const hasSubs = item.subItems && item.subItems.length > 0;
                                return (
                                    <div key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleItemClick(item)}
                                            className={cn(
                                                "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors cursor-pointer",
                                                isActive
                                                    ? "bg-accent text-foreground font-medium shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate flex-1 text-left">{item.label}</span>
                                            {hasSubs && (
                                                <ChevronRight className="h-3.5 w-3.5 opacity-40 shrink-0" />
                                            )}
                                        </button>
                                        {/* Inline active slot for items without sub-items */}
                                        {isActive && !hasSubs && item.activeSlot}
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
