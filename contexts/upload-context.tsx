"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadState {
    status: UploadStatus;
    message: string;
    projectName?: string;
}

interface UploadContextValue {
    /** Current upload state */
    uploadState: UploadState;
    /** Begin a background upload — sets status to uploading */
    startUpload: (projectName: string) => void;
    /** Mark upload as complete with success */
    completeUpload: (message?: string) => void;
    /** Update the current background upload message */
    updateUploadMessage: (message: string) => void;
    /** Mark upload as failed */
    failUpload: (error: string) => void;
    /** Whether an upload is currently in progress */
    isUploading: boolean;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadContext() {
    const ctx = useContext(UploadContext);
    if (!ctx) {
        throw new Error("useUploadContext must be used within an UploadProvider");
    }
    return ctx;
}

export function UploadProvider({ children }: { children: ReactNode }) {
    const [uploadState, setUploadState] = useState<UploadState>({
        status: "idle",
        message: "",
    });
    const [showBanner, setShowBanner] = useState(false);

    const startUpload = useCallback((projectName: string) => {
        setUploadState({
            status: "uploading",
            message: "Processing upload in the background…",
            projectName,
        });
        setShowBanner(true);
    }, []);

    const completeUpload = useCallback((message?: string) => {
        setUploadState((prev) => ({
            ...prev,
            status: "success",
            message: message || `${prev.projectName || "Project"} uploaded successfully!`,
        }));
        // Auto-dismiss after 6 seconds
        setTimeout(() => setShowBanner(false), 6000);
    }, []);

    const updateUploadMessage = useCallback((message: string) => {
        setUploadState((prev) => ({
            ...prev,
            status: "uploading",
            message,
        }));
        setShowBanner(true);
    }, []);

    const failUpload = useCallback((error: string) => {
        setUploadState((prev) => ({
            ...prev,
            status: "error",
            message: error,
        }));
        // Auto-dismiss after 8 seconds
        setTimeout(() => setShowBanner(false), 8000);
    }, []);

    const dismissBanner = useCallback(() => {
        setShowBanner(false);
        if (uploadState.status !== "uploading") {
            setUploadState({ status: "idle", message: "" });
        }
    }, [uploadState.status]);

    return (
        <UploadContext.Provider
            value={{
                uploadState,
                startUpload,
                completeUpload,
                updateUploadMessage,
                failUpload,
                isUploading: uploadState.status === "uploading",
            }}
        >
            {children}
            <AnimatePresence>
                {showBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: 60 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 60 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2"
                    >
                        <div
                            className={cn(
                                "flex items-center gap-3 rounded-full border px-5 py-3 shadow-lg backdrop-blur-xl",
                                uploadState.status === "uploading" &&
                                "border-primary/30 bg-background/90",
                                uploadState.status === "success" &&
                                "border-emerald-500/30 bg-background/90",
                                uploadState.status === "error" &&
                                "border-destructive/30 bg-background/90",
                            )}
                        >
                            {uploadState.status === "uploading" && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            {uploadState.status === "success" && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                            {uploadState.status === "error" && (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                            )}

                            <span className="text-sm font-medium text-foreground">
                                {uploadState.message}
                            </span>

                            {uploadState.status !== "uploading" && (
                                <button
                                    type="button"
                                    onClick={dismissBanner}
                                    className="ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </UploadContext.Provider>
    );
}
