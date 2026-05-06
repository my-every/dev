"use client";

/**
 * Upload card component for workbook file upload.
 * 
 * Features:
 * - Drag and drop support
 * - File validation
 * - Upload progress feedback
 * - Error state handling
 */

import { useCallback, useState, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UploadProgress } from "@/lib/workbook/types";
import { ACCEPTED_FILE_EXTENSIONS } from "@/lib/workbook/constants";

interface ProjectUploadCardProps {
  onFileSelect: (file: File) => void;
  uploadProgress: UploadProgress;
  error: string | null;
}

export function ProjectUploadCard({
  onFileSelect,
  uploadProgress,
  error,
}: ProjectUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [onFileSelect]
  );

  const isProcessing = uploadProgress.state === "uploading" || uploadProgress.state === "parsing";
  const isSuccess = uploadProgress.state === "success";
  const isError = uploadProgress.state === "error";

  return (
    <Card
      className={`
        relative overflow-hidden border-2 border-dashed transition-colors duration-200
        ${isDragOver ? "border-primary bg-muted/50" : "border-muted-foreground/25"}
        ${isError ? "border-destructive/50" : ""}
        ${isSuccess ? "border-chart-2/50" : ""}
      `}
    >
      <CardContent className="p-0">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-4 p-8 md:p-12"
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{uploadProgress.message || "Processing..."}</p>
                  <p className="text-sm text-muted-foreground">Please wait while we parse your workbook</p>
                </div>
              </motion.div>
            ) : isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <CheckCircle2 className="h-12 w-12 text-chart-2" />
                <div className="text-center">
                  <p className="font-medium text-foreground">{uploadProgress.message || "Success!"}</p>
                  <p className="text-sm text-muted-foreground">Your workbook has been parsed</p>
                </div>
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="text-center">
                  <p className="font-medium text-destructive">{error || "Upload failed"}</p>
                  <p className="text-sm text-muted-foreground">Please try again with a valid Excel file</p>
                </div>
                <label>
                  <Button variant="outline" asChild>
                    <span>Try Again</span>
                  </Button>
                  <input
                    type="file"
                    accept={ACCEPTED_FILE_EXTENSIONS.join(",")}
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <div
                  className={`
                    rounded-full p-4 transition-colors duration-200
                    ${isDragOver ? "bg-primary/10" : "bg-muted"}
                  `}
                >
                  {isDragOver ? (
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                  ) : (
                    <Upload className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">
                    {isDragOver ? "Drop your workbook here" : "Upload Excel Workbook"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to browse
                  </p>
                </div>
                <label>
                  <Button variant="outline" asChild>
                    <span>Select File</span>
                  </Button>
                  <input
                    type="file"
                    accept={ACCEPTED_FILE_EXTENSIONS.join(",")}
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Supported: {ACCEPTED_FILE_EXTENSIONS.join(", ")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
