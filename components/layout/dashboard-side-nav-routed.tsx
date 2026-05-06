"use client";

/**
 * DashboardSideNavRouted
 *
 * URL-based navigation for dashboard pages.
 * Reads from pathname to determine active state, uses Link for navigation.
 * Integrates with permission system to hide unauthorized routes.
 */

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Cable,
    Calendar,
    CheckCircle2,
    ChevronRight,
    CircleHelp,
    Clock,
    Cpu,
    Eye,
    FolderKanban,
    FolderOpen,
    GraduationCap,
    Hammer,
    History,
    LayoutDashboard,
    ListChecks,
    Package,
    Plug,
    Plus,
    Settings,
    Sparkles,
    Syringe,
    Tag,
    UserCircle,
    UserCog,
    Users,
    Wrench,
    Layers,
    Cable as WiringIcon,
    Zap,
    ClipboardCheck,
    Link2,
    Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAccess } from "@/types/user-settings";
import type { UserRole } from "@/types/d380-user-session";
import { useSession } from "@/hooks/use-session";
import {
    ProjectScheduleImportStatusPanel,
} from "@/components/profile/project-schedule/project-schedule-feature-view";

// ============================================================================
// Types
// ============================================================================

interface NavSubItem {
    id: string;
    label: string;
    href: string;
    icon?: React.ElementType;
    requiredAccess?: keyof DashboardAccess;
}

interface NavItem {
    id: string;
    label: string;
    href: string;
    icon: React.ElementType;
    subItems?: NavSubItem[];
    activeSlot?: React.ReactNode;
    requiredAccess?: keyof DashboardAccess;
    alwaysVisible?: boolean;
}

interface TrainingCategory {
    id: string;
    label: string;
    visibleRoles: UserRole[];
    description?: string;
    order: number;
}

interface DashboardSideNavRoutedProps {
    badgeNumber: string;
    access?: Partial<DashboardAccess>;
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

const fetcher = (url: string) => fetch(url).then((response) => response.json());

// ============================================================================
// Build nav items for a given badge
// ============================================================================

function buildNavItems(badgeNumber: string, trainingCategories: TrainingCategory[]): NavItem[] {
    const base = `/${badgeNumber}`;
    const trainingSubItems: NavSubItem[] = [
        { id: "all", label: "All Training", href: `${base}/training`, icon: GraduationCap },
        ...trainingCategories.map((category, index) => ({
            id: category.id,
            label: category.label,
            href: `${base}/training?category=${encodeURIComponent(category.id)}`,
            icon: index % 2 === 0 ? ClipboardCheck : Layers,
        })),
    ];
    
    return [
        {
            id: "workspace",
            label: "Workspace",
            href: `${base}/workspace`,
            icon: LayoutDashboard,
            alwaysVisible: true,
            subItems: [
                { id: "overview", label: "Overview", href: `${base}/workspace?tab=overview`, icon: UserCircle },
                { id: "settings", label: "Settings", href: `${base}/workspace?tab=settings`, icon: Settings },
                { id: "activity", label: "Activity", href: `${base}/workspace?tab=activity`, icon: History },
                { id: "assignments", label: "Assignments", href: `${base}/workspace?tab=assignments`, icon: ListChecks },
            ],
        },
        {
            id: "projects",
            label: "Projects",
            href: `${base}/projects`,
            icon: FolderOpen,
            alwaysVisible: true,
            subItems: [
                { id: "overview", label: "Overview", href: `${base}/projects?tab=overview`, icon: Eye },
                { id: "priority", label: "Priority", href: `${base}/projects?tab=priority`, icon: ListChecks },
                { id: "blocked", label: "Blocked", href: `${base}/projects?tab=blocked`, icon: AlertTriangle },
                { id: "completed", label: "Completed", href: `${base}/projects?tab=completed`, icon: CheckCircle2 },
                { id: "schedule", label: "Project Schedule", href: `${base}/projects?tab=schedule`, icon: FolderKanban, requiredAccess: "projectSchedule" },
            ],
        },
        {
            id: "branding",
            label: "Branding",
            href: `${base}/branding`,
            icon: Tag,
            requiredAccess: "brandingAccess",
            alwaysVisible: false,
            subItems: [
                { id: "overview", label: "Overview", href: `${base}/branding`, icon: Eye },
                { id: "brands", label: "Brands", href: `${base}/branding?tab=brands`, icon: Tag },
                { id: "activity", label: "Activity", href: `${base}/branding?tab=activity`, icon: History },
                { id: "settings", label: "Settings", href: `${base}/branding?tab=settings`, icon: Settings },
            ],
        },
        {
            id: "users",
            label: "Users",
            href: `${base}/users`,
            icon: Users,
            alwaysVisible: true,
            subItems: [
                { id: "directory", label: "Directory", href: `${base}/users?tab=directory`, icon: Users },
                { id: "access", label: "User Access", href: `${base}/users?tab=access`, icon: UserCog, requiredAccess: "userAccess" },
                { id: "skills", label: "Skills", href: `${base}/users?tab=skills`, icon: Sparkles, requiredAccess: "userAccess" },
                { id: "audit", label: "Audit Log", href: `${base}/users?tab=audit`, icon: History, requiredAccess: "userAccess" },
            ],
        },
        {
            id: "parts",
            label: "Parts Library",
            href: `${base}/parts`,
            icon: Package,
            requiredAccess: "catalogAccess",
            alwaysVisible: true,
            subItems: [
                { id: "all", label: "All Parts", href: `${base}/parts`, icon: Package },
                { id: "devices", label: "Devices", href: `${base}/parts/devices`, icon: Cpu },
                { id: "terminals", label: "Terminals", href: `${base}/parts/terminals`, icon: Plug },
                { id: "wiring", label: "Wiring", href: `${base}/parts/wiring`, icon: Cable },
                { id: "hardware", label: "Hardware", href: `${base}/parts/hardware`, icon: Wrench },
                { id: "tools", label: "Tools", href: `${base}/parts/tools`, icon: Hammer },
                { id: "consumables", label: "Consumables", href: `${base}/parts/consumables`, icon: Syringe },
                { id: "stacks", label: "Stacks", href: `${base}/parts/stacks`, icon: Layers },
                { id: "unknown", label: "Unknown", href: `${base}/parts/unknown`, icon: CircleHelp },
            ],
        },
        {
            id: "sws",
            label: "SWS",
            href: `${base}/sws`,
            icon: Route,
            alwaysVisible: true,
            subItems: [
                { id: "overview", label: "Overview", href: `${base}/sws?tab=overview`, icon: Eye },
                { id: "templates", label: "Templates", href: `${base}/sws?tab=templates`, icon: Layers },
                { id: "tasks", label: "Tasks", href: `${base}/sws?tab=tasks`, icon: ClipboardCheck },
                { id: "operations", label: "Operations", href: `${base}/sws?tab=operations`, icon: Link2 },
                { id: "settings", label: "Settings", href: `${base}/sws?tab=settings`, icon: Settings },
            ],
        },
        {
            id: "training",
            label: "Training",
            href: `${base}/training`,
            icon: GraduationCap,
            requiredAccess: "catalogAccess",
            alwaysVisible: true,
            subItems: trainingSubItems,
        },
    ];
}

// ============================================================================
// Component
// ============================================================================

export function DashboardSideNavRouted({
    badgeNumber,
    access,
    className,
}: DashboardSideNavRoutedProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useSession();
    const [direction, setDirection] = useState(1);
    const [drilledView, setDrilledView] = useState<string | null>(null);

    const { data: categoriesData } = useSWR<{ categories: TrainingCategory[] }>(
        user?.role ? `/api/training/categories?role=${encodeURIComponent(user.role)}` : null,
        fetcher
    );

    const trainingCategories = useMemo(
        () => categoriesData?.categories ?? [
            { id: "app", label: "App", visibleRoles: [], order: 0 },
            { id: "onboarding", label: "Onboarding", visibleRoles: [], order: 1 },
            { id: "safety", label: "Safety", visibleRoles: [], order: 2 },
            { id: "device", label: "Device", visibleRoles: [], order: 3 },
            { id: "tool", label: "Tool", visibleRoles: [], order: 4 },
        ],
        [categoriesData?.categories]
    );

    const navItems = useMemo(() => buildNavItems(badgeNumber, trainingCategories), [badgeNumber, trainingCategories]);

    // Determine active view and sub-item from pathname
    const { activeView, activeSubItem } = useMemo(() => {
        const basePath = `/${badgeNumber}`;
        const relativePath = pathname.replace(basePath, "");

        // Default to the workspace root shell
        if (relativePath === "" || relativePath === "/") {
            return { activeView: "workspace", activeSubItem: "overview" };
        }

        // Match view patterns
        for (const item of navItems) {
            if (relativePath.startsWith(`/${item.id}`)) {
                const subPath = relativePath.replace(`/${item.id}/`, "").replace(`/${item.id}`, "");
                const subPathId = subPath.split("/")[0] || "";
                const tabFromQuery =
                    item.id === "training"
                        ? (searchParams.get("category") ?? "all")
                        : (searchParams.get("tab") ?? null);
                const resolvedSubId = tabFromQuery ?? subPathId;
                const subItem = item.subItems?.find(s => s.id === resolvedSubId) ?? item.subItems?.[0];
                return { activeView: item.id, activeSubItem: subItem?.id ?? null };
            }
        }

        return { activeView: "workspace", activeSubItem: "overview" };
    }, [pathname, badgeNumber, navItems, searchParams]);

    // Filter items by permission
    const visibleItems = useMemo(() => {
        return navItems.filter(item => {
            if (item.alwaysVisible) return true;
            if (!item.requiredAccess) return true;
            if (!access) return true;
            return access[item.requiredAccess] !== false;
        });
    }, [navItems, access]);

    // Drilled item config with filtered sub-items
    const drilledItem = useMemo(() => {
        if (!drilledView) return null;
        const item = navItems.find(i => i.id === drilledView);
        if (!item) return null;

        const filteredSubItems = item.subItems?.filter(sub => {
            if (!sub.requiredAccess) return true;
            if (!access) return true;
            return access[sub.requiredAccess] !== false;
        });

        // Add active slot for project schedule
        let activeSlot: React.ReactNode = undefined;
        if (drilledView === "projects" && activeSubItem === "schedule") {
            activeSlot = <ProjectScheduleImportStatusPanel />;
        }

        return { ...item, subItems: filteredSubItems, activeSlot };
    }, [navItems, drilledView, access, activeSubItem]);

    const handleItemClick = useCallback((item: NavItem) => {
        if (item.subItems && item.subItems.length > 0) {
            setDirection(1);
            setDrilledView(item.id);
        } else {
            setDrilledView(null);
        }
    }, []);

    const handleBack = useCallback(() => {
        setDirection(-1);
        setDrilledView(null);
    }, []);

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                    {drilledView && drilledItem ? (
                        /* Sub-items view */
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

                            {/* Sub-items as links */}
                            {drilledItem.subItems?.map((sub) => {
                                const SubIcon = sub.icon;
                                const isActive = activeSubItem === sub.id;
                                return (
                                    <Link
                                        key={sub.id}
                                        href={sub.href}
                                        className={cn(
                                            "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
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
                                    </Link>
                                );
                            })}

                            {/* Active slot (e.g., import status panel) */}
                            {drilledItem.activeSlot}
                        </motion.div>
                    ) : (
                        /* Top-level items */
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

                                // For items with sub-items, clicking navigates to first sub + drills in
                                const firstVisibleSub = item.subItems?.find(sub => {
                                    if (!sub.requiredAccess) return true;
                                    if (!access) return true;
                                    return access[sub.requiredAccess] !== false;
                                });
                                const targetHref = hasSubs && firstVisibleSub ? firstVisibleSub.href : item.href;

                                return (
                                    <div key={item.id}>
                                        {hasSubs ? (
                                            <button
                                                type="button"
                                                onClick={() => handleItemClick(item)}
                                                className={cn(
                                                    "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
                                                    isActive
                                                        ? "bg-accent text-foreground font-medium shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate flex-1 text-left">{item.label}</span>
                                                <ChevronRight className="h-3.5 w-3.5 opacity-40 shrink-0" />
                                            </button>
                                        ) : (
                                            <Link
                                                href={targetHref}
                                                onClick={() => handleItemClick(item)}
                                                className={cn(
                                                    "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
                                                    isActive
                                                        ? "bg-accent text-foreground font-medium shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate flex-1 text-left">{item.label}</span>
                                            </Link>
                                        )}
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
