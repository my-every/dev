"use client";

import {
    BriefcaseBusiness,
    FolderKanban,
    GraduationCap,
    Home,
    Library,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { AppFloatingActions, type FloatingActionSection } from "@/components/layout/app-floating-actions";
import { type CommandSearchGroup } from "@/components/layout/layout-composite";
import type { TourConfig } from "@/components/tour/tour/index";
import { type UserAvatarMenuProps } from "@/components/layout/user-avatar-menu";
import PageLayoutShell, {
    LayoutPage,
    type PageLayoutShellClassNames,
    type LayoutVariant,
    type RootNavItem,
} from "./layout";


type PageLayoutProps = {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    headerActions?: React.ReactNode;
    floatingActions?: React.ReactNode;
    showFloatingActions?: boolean;
    variant?: LayoutVariant;
    contentVariant?: "default" | "grid" | "focus";
    showAside?: boolean;
    navItems?: RootNavItem[];
    activeRootId?: string;
    commandSearchGroups?: CommandSearchGroup[];
    commandSearchPlaceholder?: string;
    floatingActionSections?: FloatingActionSection[];
    floatingActionTourConfig?: TourConfig;
    classNames?: PageLayoutShellClassNames;
    // Optional custom content components - use defaults if not provided
    sidePanelContent?: React.ReactNode;
    asideContent?: React.ReactNode;
    subHeader?: React.ReactNode;
    sideRailFooter?: React.ReactNode;
    showSidePanelToggle?: boolean;
    showAsideToggle?: boolean;
    showBreadcrumbs?: boolean;
    showHeader?: boolean;
    showHeading?: boolean;
    showHeaderTitleInline?: boolean;
    showSubHeader?: boolean;
    showStartUpButton?: boolean;
    userAvatarMenu?: UserAvatarMenuProps;
    showUserAvatarMenu?: boolean;
};

const SPRING = {
    type: "spring",
    stiffness: 260,
    damping: 24,
    mass: 0.75,
} as const;

const ROOT_NAV: RootNavItem[] = [

    { id: "projects", href: "/projects", label: "Projects", icon: FolderKanban },

];

function resolveRoot(pathname: string): string {
 
    if (pathname.startsWith("/projects")) {
        return "projects";
    }

 

    return "home";
}

export default function PageLayout({
    children,
    title,
    subtitle,
    headerActions,
    floatingActions,
    showFloatingActions = false,
    variant = "default",
    showAside = true,
    navItems = ROOT_NAV,
    activeRootId: activeRootIdProp,
    commandSearchGroups = [],
    commandSearchPlaceholder,
    floatingActionSections,
    floatingActionTourConfig,
    classNames,
    sidePanelContent,
    asideContent,
    subHeader,
    sideRailFooter,
    showSidePanelToggle,
    showAsideToggle,
    showBreadcrumbs = true,
    showHeader = true,
    showHeading = false,
    showHeaderTitleInline = false,
    showSubHeader = true,
    showStartUpButton = false,
    userAvatarMenu,
    showUserAvatarMenu = true,
}: PageLayoutProps) {
    const pathname = usePathname();

    const activeRoot = useMemo(() => activeRootIdProp ?? resolveRoot(pathname), [activeRootIdProp, pathname]);
    const activeNav = navItems.find((item) => item.id === activeRoot) ?? navItems[0];

    return (
        <PageLayoutShell
            activeRootId={activeRoot}
            navItems={navItems}
            variant={variant}
            classNames={classNames}
            sideRailFooter={sideRailFooter}
            userAvatarMenu={userAvatarMenu}
            showUserAvatarMenu={showUserAvatarMenu}
            defaultAsideOpen={showAside}
            defaultSidePanelOpen={Boolean(sidePanelContent)}
        >
            <LayoutPage
                title={title ?? activeNav.label}
                subtitle={subtitle}
                sidePanel={sidePanelContent}
                showPanel={Boolean(sidePanelContent)}
                aside={showAside ? asideContent : undefined}
                subHeader={subHeader}
                showAside={showAside}
                variant={variant}
                classNames={classNames}
                floatingActions={showFloatingActions ? (floatingActions ?? (
                    <AppFloatingActions
                        sections={floatingActionSections}
                        tourConfig={floatingActionTourConfig}
                    />
                )) : undefined}
                commandSearchGroups={commandSearchGroups}
                commandSearchPlaceholder={commandSearchPlaceholder ?? `Search in ${title ?? activeNav.label}...`}
                showSidePanelToggle={showSidePanelToggle}
                showAsideToggle={showAsideToggle ?? showAside}
                showBreadcrumbs={showBreadcrumbs}
                showHeader={showHeader}
                showHeading={showHeading}
                showHeaderTitleInline={showHeaderTitleInline}
                showSubHeader={showSubHeader}
                showStartUpButton={showStartUpButton}
                userAvatarMenu={userAvatarMenu}
                showUserAvatarMenu={showUserAvatarMenu}
                headerActions={headerActions}
            >
                <motion.div
                    className="w-full h-full"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING}
                >
                    {children}
                </motion.div>
            </LayoutPage>
        </PageLayoutShell>
    );
}
