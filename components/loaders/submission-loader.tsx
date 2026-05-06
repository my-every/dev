"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmissionLoaderProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

/**
 * Full-screen overlay loader for form submissions and filter applications.
 * Prevents multiple submissions and provides visual feedback.
 */
export function SubmissionLoader({
  isVisible,
  message = "Processing...",
  className,
}: SubmissionLoaderProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
            className
          )}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-lg"
          >
            <div className="relative">
              {/* Pulsing ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Spinner */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Please wait while we process your request
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
