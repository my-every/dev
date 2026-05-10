"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const FLASH_ASIDE_DURATION = 3000; // 3 seconds auto-close

type LayoutUIContextValue = {
    isSidebarOpen: boolean;
    isSidePanelOpen: boolean;
    isAsideOpen: boolean;
    isFloatingActionsOpen: boolean;
    isCommandSearchOpen: boolean;
    /** Whether SidePanel was auto-closed by Aside opening */
    sidePanelAutoHidden: boolean;
    /** Whether aside was opened via flash (for animation styling) */
    isAsideFlashing: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;
    openSidePanel: () => void;
    closeSidePanel: () => void;
    toggleSidePanel: () => void;
    openAside: () => void;
    closeAside: () => void;
    toggleAside: () => void;
    /** Opens aside with flash animation and auto-closes after 3 seconds */
    flashAside: () => void;
    /** Pause flash auto-close (e.g., on hover) */
    pauseFlashAutoClose: () => void;
    /** Resume flash auto-close */
    resumeFlashAutoClose: () => void;
    /** Cancel flash auto-close (keeps aside open) */
    cancelFlashAutoClose: () => void;
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
    defaultSidebarOpen?: boolean;
    defaultSidePanelOpen?: boolean;
    defaultAsideOpen?: boolean;
    defaultFloatingActionsOpen?: boolean;
};

export function LayoutUIProvider({
    children,
    defaultSidebarOpen = true,
    defaultSidePanelOpen = true,
    defaultAsideOpen = true,
    defaultFloatingActionsOpen = true,
}: LayoutUIProviderProps) {
    const isMobile = useIsMobile();
    const [isSidebarOpen, setIsSidebarOpen] = useState(defaultSidebarOpen);
    const [isDesktopSidePanelOpen, setIsDesktopSidePanelOpen] = useState(defaultSidePanelOpen);
    const [isMobileSidePanelOpen, setIsMobileSidePanelOpen] = useState(false);
    const [isAsideOpen, setIsAsideOpen] = useState(defaultAsideOpen);
    const [isFloatingActionsOpen, setIsFloatingActionsOpen] = useState(defaultFloatingActionsOpen);
    const [isCommandSearchOpen, setIsCommandSearchOpen] = useState(false);
    // Track if SidePanel was open before Aside auto-closed it (for restore on mobile)
    const [sidePanelWasOpenBeforeAside, setSidePanelWasOpenBeforeAside] = useState(false);
    
    // Flash aside state
    const [isAsideFlashing, setIsAsideFlashing] = useState(false);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashPausedRef = useRef(false);
    const flashCancelledRef = useRef(false);
    const flashRemainingRef = useRef(FLASH_ASIDE_DURATION);
    const flashPauseStartRef = useRef<number | null>(null);

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

    const clearFlashTimeout = useCallback(() => {
        if (flashTimeoutRef.current) {
            clearTimeout(flashTimeoutRef.current);
            flashTimeoutRef.current = null;
        }
    }, []);

    const startFlashTimeout = useCallback((delay: number = FLASH_ASIDE_DURATION) => {
        clearFlashTimeout();
        if (flashCancelledRef.current) return;

        flashRemainingRef.current = delay;
        flashTimeoutRef.current = setTimeout(() => {
            if (!flashPausedRef.current && !flashCancelledRef.current) {
                setIsAsideFlashing(false);
                closeAside();
            }
        }, delay);
    }, [clearFlashTimeout]);

    const flashAside = useCallback(() => {
        // Reset flash state
        flashCancelledRef.current = false;
        flashPausedRef.current = false;
        flashRemainingRef.current = FLASH_ASIDE_DURATION;

        setIsAsideFlashing(true);
        openAside();
        startFlashTimeout(FLASH_ASIDE_DURATION);
    }, [startFlashTimeout]);

    const pauseFlashAutoClose = useCallback(() => {
        if (flashPausedRef.current || flashCancelledRef.current || !isAsideFlashing) return;

        flashPausedRef.current = true;
        flashPauseStartRef.current = Date.now();
        clearFlashTimeout();
    }, [clearFlashTimeout, isAsideFlashing]);

    const resumeFlashAutoClose = useCallback(() => {
        if (!flashPausedRef.current || flashCancelledRef.current || !isAsideFlashing) return;

        flashPausedRef.current = false;

        if (flashPauseStartRef.current) {
            const elapsed = Date.now() - flashPauseStartRef.current;
            const remaining = Math.max(0, flashRemainingRef.current - elapsed);
            if (remaining > 0) {
                startFlashTimeout(remaining);
            } else {
                setIsAsideFlashing(false);
                closeAside();
            }
        }

        flashPauseStartRef.current = null;
    }, [isAsideFlashing, startFlashTimeout]);

    const cancelFlashAutoClose = useCallback(() => {
        flashCancelledRef.current = true;
        flashPausedRef.current = false;
        clearFlashTimeout();
        setIsAsideFlashing(false);
        // Keep aside open - user interacted
    }, [clearFlashTimeout]);

    // Cleanup flash timeout on unmount
    useEffect(() => {
        return () => {
            clearFlashTimeout();
        };
    }, [clearFlashTimeout]);

    const value: LayoutUIContextValue = {
        isSidebarOpen,
        isSidePanelOpen: sidePanelOpen,
        isAsideOpen,
        isFloatingActionsOpen,
        isCommandSearchOpen,
        sidePanelAutoHidden: sidePanelWasOpenBeforeAside,
        isAsideFlashing,
        openSidebar: () => setIsSidebarOpen(true),
        closeSidebar: () => setIsSidebarOpen(false),
        toggleSidebar: () => setIsSidebarOpen((prev) => !prev),
        openSidePanel,
        closeSidePanel,
        toggleSidePanel,
        openAside,
        closeAside,
        toggleAside,
        flashAside,
        pauseFlashAutoClose,
        resumeFlashAutoClose,
        cancelFlashAutoClose,
        openFloatingActions: () => setIsFloatingActionsOpen(true),
        closeFloatingActions: () => setIsFloatingActionsOpen(false),
        toggleFloatingActions: () => setIsFloatingActionsOpen((prev) => !prev),
        openCommandSearch: () => setIsCommandSearchOpen(true),
        closeCommandSearch: () => setIsCommandSearchOpen(false),
        toggleCommandSearch: () => setIsCommandSearchOpen((prev) => !prev),
    };

    return <LayoutUIContext.Provider value={value}>{children}</LayoutUIContext.Provider>;
}

const defaultLayoutUIValue: LayoutUIContextValue = {
    isSidebarOpen: false,
    isSidePanelOpen: false,
    isAsideOpen: false,
    isFloatingActionsOpen: false,
    isCommandSearchOpen: false,
    sidePanelAutoHidden: false,
    isAsideFlashing: false,
    openSidebar: () => {},
    closeSidebar: () => {},
    toggleSidebar: () => {},
    openSidePanel: () => {},
    closeSidePanel: () => {},
    toggleSidePanel: () => {},
    openAside: () => {},
    closeAside: () => {},
    toggleAside: () => {},
    flashAside: () => {},
    pauseFlashAutoClose: () => {},
    resumeFlashAutoClose: () => {},
    cancelFlashAutoClose: () => {},
    openFloatingActions: () => {},
    closeFloatingActions: () => {},
    toggleFloatingActions: () => {},
    openCommandSearch: () => {},
    closeCommandSearch: () => {},
    toggleCommandSearch: () => {},
};

export function useLayoutUI(): LayoutUIContextValue {
    const context = useContext(LayoutUIContext);

    if (!context) {
        // Return safe default if used outside provider (e.g., standalone pages)
        return defaultLayoutUIValue;
    }

    return context;
}
