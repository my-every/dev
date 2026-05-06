"use client";

import { createContext, useContext, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type LayoutUIContextValue = {
    isSidebarOpen: boolean;
    isSidePanelOpen: boolean;
    isAsideOpen: boolean;
    isFloatingActionsOpen: boolean;
    isCommandSearchOpen: boolean;
    /** Whether SidePanel was auto-closed by Aside opening */
    sidePanelAutoHidden: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;
    openSidePanel: () => void;
    closeSidePanel: () => void;
    toggleSidePanel: () => void;
    openAside: () => void;
    closeAside: () => void;
    toggleAside: () => void;
    openFloatingActions: () => void;
    closeFloatingActions: () => void;
    toggleFloatingActions: () => void;
    openCommandSearch: () => void;
    closeCommandSearch: () => void;
    toggleCommandSearch: () => void;
};

const LayoutUIContext = createContext<LayoutUIContextValue | null>(null);

type LayoutUIProviderProps = {
    children: React.ReactNode;
    defaultSidePanelOpen?: boolean;
    defaultAsideOpen?: boolean;
    defaultFloatingActionsOpen?: boolean;
};

export function LayoutUIProvider({
    children,
    defaultSidePanelOpen = true,
    defaultAsideOpen = true,
    defaultFloatingActionsOpen = true,
}: LayoutUIProviderProps) {
    const isMobile = useIsMobile();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDesktopSidePanelOpen, setIsDesktopSidePanelOpen] = useState(defaultSidePanelOpen);
    const [isMobileSidePanelOpen, setIsMobileSidePanelOpen] = useState(false);
    const [isAsideOpen, setIsAsideOpen] = useState(defaultAsideOpen);
    const [isFloatingActionsOpen, setIsFloatingActionsOpen] = useState(defaultFloatingActionsOpen);
    const [isCommandSearchOpen, setIsCommandSearchOpen] = useState(false);
    // Track if SidePanel was open before Aside auto-closed it (for restore on mobile)
    const [sidePanelWasOpenBeforeAside, setSidePanelWasOpenBeforeAside] = useState(false);

    const sidePanelOpen = isMobile ? isMobileSidePanelOpen : isDesktopSidePanelOpen;

    const openSidePanel = () => {
        if (isMobile) {
            setIsMobileSidePanelOpen(true);
            return;
        }

        setIsDesktopSidePanelOpen(true);
    };

    const closeSidePanel = () => {
        if (isMobile) {
            setIsMobileSidePanelOpen(false);
            return;
        }

        setIsDesktopSidePanelOpen(false);
    };

    const toggleSidePanel = () => {
        if (isMobile) {
            setIsMobileSidePanelOpen((prev) => !prev);
            return;
        }

        setIsDesktopSidePanelOpen((prev) => !prev);
    };

    // Auto-close SidePanel when Aside opens, restore when closed
    const openAside = () => {
        if (isMobile && isMobileSidePanelOpen) {
            setSidePanelWasOpenBeforeAside(true);
            setIsMobileSidePanelOpen(false);
        } else if (!isMobile && isDesktopSidePanelOpen) {
            setSidePanelWasOpenBeforeAside(true);
            setIsDesktopSidePanelOpen(false);
        }
        setIsAsideOpen(true);
    };

    const closeAside = () => {
        setIsAsideOpen(false);
        // Keep navigation discoverable by reopening the side panel when aside closes.
        if (isMobile) {
            setIsMobileSidePanelOpen(true);
        } else {
            setIsDesktopSidePanelOpen(true);
        }
        setSidePanelWasOpenBeforeAside(false);
    };

    const toggleAside = () => {
        if (isAsideOpen) {
            closeAside();
        } else {
            openAside();
        }
    };

    const value: LayoutUIContextValue = {
        isSidebarOpen,
        isSidePanelOpen: sidePanelOpen,
        isAsideOpen,
        isFloatingActionsOpen,
        isCommandSearchOpen,
        sidePanelAutoHidden: sidePanelWasOpenBeforeAside,
        openSidebar: () => setIsSidebarOpen(true),
        closeSidebar: () => setIsSidebarOpen(false),
        toggleSidebar: () => setIsSidebarOpen((prev) => !prev),
        openSidePanel,
        closeSidePanel,
        toggleSidePanel,
        openAside,
        closeAside,
        toggleAside,
        openFloatingActions: () => setIsFloatingActionsOpen(true),
        closeFloatingActions: () => setIsFloatingActionsOpen(false),
        toggleFloatingActions: () => setIsFloatingActionsOpen((prev) => !prev),
        openCommandSearch: () => setIsCommandSearchOpen(true),
        closeCommandSearch: () => setIsCommandSearchOpen(false),
        toggleCommandSearch: () => setIsCommandSearchOpen((prev) => !prev),
    };

    return <LayoutUIContext.Provider value={value}>{children}</LayoutUIContext.Provider>;
}

export function useLayoutUI() {
    const context = useContext(LayoutUIContext);

    if (!context) {
        throw new Error("useLayoutUI must be used inside LayoutUIProvider.");
    }

    return context;
}
