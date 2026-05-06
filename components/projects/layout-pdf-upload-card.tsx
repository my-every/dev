"use client";

/**
 * Upload card component for layout PDF file upload.
 * 
 * Features:
 * - Drag and drop support for PDF files
 * - PDF text extraction using pdf.js (loaded from CDN)
 * - Layout parsing for wire length estimation
 * - Upload progress feedback
 */

import { useCallback, useState, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, AlertCircle, CheckCircle2, Loader2, Ruler } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { extractStructuredPdfText } from "@/lib/layout-matching/extract-pdf-text";
import type { LayoutPdfTextSource } from "@/lib/wire-length";
import type { UploadProgress } from "@/lib/workbook/types";

interface LayoutPdfUploadCardProps {
  onPdfParsed: (pdfSource: LayoutPdfTextSource, fileName: string, file?: File) => void;
  uploadProgress: UploadProgress;
  error: string | null;
  disabled?: boolean;
}

const ACCEPTED_PDF_EXTENSIONS = [".pdf"];

export function LayoutPdfUploadCard({
  onPdfParsed,
  uploadProgress,
  error,
  disabled = false,
}: LayoutPdfUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (disabled) return;

    const fileName = file.name.toLowerCase();
    if (!ACCEPTED_PDF_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
      return;
    }

    try {
      const pdfSource = await extractStructuredPdfText(file);
      onPdfParsed(pdfSource, file.name, file);
    } catch (err) {
      console.error("[d380] PDF extraction error:", err);
    }
  }, [disabled, onPdfParsed]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [disabled, processFile]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [processFile]
  );

  const isProcessing = uploadProgress.state === "uploading" || uploadProgress.state === "parsing";
  const isSuccess = uploadProgress.state === "success";
  const isError = uploadProgress.state === "error";

  return (
    <Card
      className={`
        relative overflow-hidden border-2 border-dashed transition-colors duration-200
        ${isDragOver && !disabled ? "border-primary bg-muted/50" : "border-muted-foreground/25"}
        ${isError ? "border-destructive/50" : ""}
        ${isSuccess ? "border-chart-2/50" : ""}
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}
      `}
    >
      <CardContent className="p-0">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-3 p-6"
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{uploadProgress.message || "Parsing PDF..."}</p>
                  <p className="text-xs text-muted-foreground">Extracting layout data</p>
                </div>
              </motion.div>
            ) : isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <CheckCircle2 className="h-8 w-8 text-chart-2" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{uploadProgress.message || "Layout loaded!"}</p>
                  <p className="text-xs text-muted-foreground">Wire lengths can now be estimated</p>
                </div>
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div className="text-center">
                  <p className="text-sm font-medium text-destructive">{error || "PDF parsing failed"}</p>
                  <p className="text-xs text-muted-foreground">Please try a valid layout PDF</p>
                </div>
                <label>
                  <Button variant="outline" size="sm" asChild disabled={disabled}>
                    <span>Try Again</span>
                  </Button>
                  <input
                    type="file"
                    accept={ACCEPTED_PDF_EXTENSIONS.join(",")}
                    onChange={handleFileChange}
                    className="sr-only"
                    disabled={disabled}
                  />
                </label>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <div
                  className={`
                    rounded-full p-3 transition-colors duration-200
                    ${isDragOver && !disabled ? "bg-primary/10" : "bg-muted"}
                  `}
                >
                  {isDragOver && !disabled ? (
                    <Ruler className="h-6 w-6 text-primary" />
                  ) : (
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {isDragOver && !disabled ? "Drop layout PDF here" : "Upload Layout PDF"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Optional: For wire length estimation
                  </p>
                </div>
                <label>
                  <Button variant="outline" size="sm" asChild disabled={disabled}>
                    <span>Select PDF</span>
                  </Button>
                  <input
                    type="file"
                    accept={ACCEPTED_PDF_EXTENSIONS.join(",")}
                    onChange={handleFileChange}
                    className="sr-only"
                    disabled={disabled}
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
