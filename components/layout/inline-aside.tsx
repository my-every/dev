"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLayoutUI } from "@/components/layout/layout-context";
import { cn } from "@/lib/utils";

const SPRING = {
    type: "spring",
    stiffness: 280,
    damping: 28,
    mass: 0.8,
} as const;

interface InlineAsideProps {
    children: React.ReactNode;
    className?: string;
    showCloseButton?: boolean;
    onClose?: () => void;
}

/**
 * InlineAside - A contextual aside panel that integrates with the layout system.
 * 
 * On desktop (xl+): Renders inline as a right-side panel
 * On smaller screens: Renders as an overlay that auto-closes the SidePanel
 * 
 * Uses the layout context's isAsideOpen state for visibility.
 * Supports flash mode with auto-close and hover-to-pause behavior.
 */
export function InlineAside({ 
    children, 
    className,
    showCloseButton = true,
    onClose,
}: InlineAsideProps) {
    const { 
        isAsideOpen, 
        closeAside, 
        isAsideFlashing,
        pauseFlashAutoClose,
        resumeFlashAutoClose,
        cancelFlashAutoClose,
    } = useLayoutUI();

    const handleClose = () => {
        closeAside();
        onClose?.();
    };

    const handleMouseEnter = () => {
        if (isAsideFlashing) {
            pauseFlashAutoClose();
        }
    };

    const handleMouseLeave = () => {
        if (isAsideFlashing) {
            resumeFlashAutoClose();
        }
    };

    const handleClick = () => {
        // User clicked inside aside - cancel auto-close
        if (isAsideFlashing) {
            cancelFlashAutoClose();
        }
    };

    return (
        <>
            {/* Desktop inline panel */}
            <AnimatePresence>
                {isAsideOpen && (
                    <motion.aside
                        key="inline-aside-desktop"
                        className={cn(
                            "hidden shrink-0 border-l border-border bg-card xl:block xl:w-96",
                            isAsideFlashing && "ring-2 ring-primary/50 ring-offset-1 animate-pulse",
                            className
                        )}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={SPRING}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleClick}
                    >
                        {showCloseButton && (
                            <div className="absolute right-2 top-2 z-10">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={handleClose}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {children}
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Mobile/tablet overlay */}
            <AnimatePresence>
                {isAsideOpen && (
                    <>
                        <motion.button
                            key="inline-aside-overlay"
                            type="button"
                            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
                            onClick={handleClose}
                            aria-label="Close aside panel"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        />
                        <motion.aside
                            key="inline-aside-mobile"
                            className={cn(
                                "fixed inset-y-2 right-2 z-40 w-[85%] max-w-[22rem] rounded-3xl border border-border bg-card shadow-xl xl:hidden overflow-hidden",
                                isAsideFlashing && "ring-2 ring-primary/50 ring-offset-1 animate-pulse",
                                className
                            )}
                            initial={{ x: "110%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "110%" }}
                            transition={SPRING}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onClick={handleClick}
                        >
                            {showCloseButton && (
                                <div className="absolute right-3 top-3 z-10">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleClose}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                            {children}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
