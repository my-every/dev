"use client";

/**
 * Unified Upload Card
 * 
 * Allows users to upload both Excel workbook and Layout PDF in a single dropzone.
 * Files are automatically detected and processed based on their extension.
 * Shows upload status for both file types with the ability to re-upload either.
 */

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Plus
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractStructuredPdfText } from "@/lib/layout-matching/extract-pdf-text";
import type { LayoutPdfTextSource } from "@/lib/wire-length";
import type { UploadProgress } from "@/lib/workbook/types";
import { ACCEPTED_FILE_EXTENSIONS } from "@/lib/workbook/constants";

interface UploadedFile {
  name: string;
  type: "excel" | "pdf";
  status: "pending" | "processing" | "success" | "error";
  message?: string;
}

interface UnifiedUploadCardProps {
  onExcelSelect: (file: File) => void;
  onPdfParsed: (pdfSource: LayoutPdfTextSource, fileName: string, file?: File) => void;
  excelProgress: UploadProgress;
  pdfProgress: UploadProgress;
  excelError: string | null;
  pdfError: string | null;
}

const ACCEPTED_PDF_EXTENSIONS = [".pdf"];
const ALL_ACCEPTED_EXTENSIONS = [...ACCEPTED_FILE_EXTENSIONS, ...ACCEPTED_PDF_EXTENSIONS];

export function UnifiedUploadCard({
  onExcelSelect,
  onPdfParsed,
  excelProgress,
  pdfProgress,
  excelError,
  pdfError,
}: UnifiedUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

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

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const fileName = file.name.toLowerCase();

      // Check if it's an Excel file
      if (ACCEPTED_FILE_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
        setUploadedFiles(prev => [
          ...prev.filter(f => f.type !== "excel"),
          { name: file.name, type: "excel", status: "pending" }
        ]);
        onExcelSelect(file);
      }
      // Check if it's a PDF file
      else if (ACCEPTED_PDF_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
        setUploadedFiles(prev => [
          ...prev.filter(f => f.type !== "pdf"),
          { name: file.name, type: "pdf", status: "processing" }
        ]);

        try {
          const pdfSource = await extractStructuredPdfText(file);
          onPdfParsed(pdfSource, file.name, file);
        } catch (err) {
          console.error("[d380] PDF extraction error:", err);
          setUploadedFiles(prev =>
            prev.map(f => f.type === "pdf" ? { ...f, status: "error", message: "Failed to parse PDF" } : f)
          );
        }
      }
    }
  }, [onExcelSelect, onPdfParsed]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      e.target.value = "";
    },
    [processFiles]
  );

  const removeFile = useCallback((type: "excel" | "pdf") => {
    setUploadedFiles(prev => prev.filter(f => f.type !== type));
  }, []);

  // Determine overall state
  const hasExcel = uploadedFiles.some(f => f.type === "excel") || excelProgress.state !== "idle";
  const hasPdf = uploadedFiles.some(f => f.type === "pdf") || pdfProgress.state !== "idle";
  const isProcessingExcel = excelProgress.state === "uploading" || excelProgress.state === "parsing";
  const isProcessingPdf = pdfProgress.state === "uploading" || pdfProgress.state === "parsing";
  const isProcessing = isProcessingExcel || isProcessingPdf;

  // Get file display info
  const excelFile = uploadedFiles.find(f => f.type === "excel");
  const pdfFile = uploadedFiles.find(f => f.type === "pdf");

  return (
    <Card
      className={`
        relative overflow-hidden border-2 border-dashed transition-colors duration-200
        ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/40"}
      `}
    >
      <CardContent className="p-0">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-6 p-8 md:p-12"
        >
          {/* Header with dropzone icon */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={`
                rounded-full p-4 transition-all duration-200
                ${isDragOver ? "bg-primary/10 scale-110" : "bg-muted"}
              `}
            >
              <Upload className={`h-8 w-8 transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                {isDragOver ? "Drop files here" : "Upload Project Files"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag and drop Excel workbook and/or Layout PDF, or click to browse
              </p>
            </div>
          </div>

          {/* File status pills */}
          {(hasExcel || hasPdf) && (
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-md">
              {/* Excel file status */}
              {hasExcel && (
                <div className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                  ${excelProgress.state === "success" ? "bg-chart-2/10 border-chart-2/30" : ""}
                  ${excelProgress.state === "error" ? "bg-destructive/10 border-destructive/30" : ""}
                  ${isProcessingExcel ? "bg-primary/10 border-primary/30" : ""}
                  ${excelProgress.state === "idle" && excelFile ? "bg-muted border-muted-foreground/20" : ""}
                `}>
                  {isProcessingExcel ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : excelProgress.state === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  ) : excelProgress.state === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium truncate max-w-32">
                    {excelFile?.name || "Workbook"}
                  </span>
                  <Badge variant="secondary" className="text-xs">Excel</Badge>
                  {excelProgress.state === "success" && (
                    <button
                      onClick={() => removeFile("excel")}
                      className="ml-1 p-0.5 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {/* PDF file status */}
              {hasPdf && (
                <div className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                  ${pdfProgress.state === "success" ? "bg-chart-2/10 border-chart-2/30" : ""}
                  ${pdfProgress.state === "error" ? "bg-destructive/10 border-destructive/30" : ""}
                  ${isProcessingPdf ? "bg-primary/10 border-primary/30" : ""}
                  ${pdfProgress.state === "idle" && pdfFile ? "bg-muted border-muted-foreground/20" : ""}
                `}>
                  {isProcessingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : pdfProgress.state === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  ) : pdfProgress.state === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium truncate max-w-32">
                    {pdfFile?.name || "Layout"}
                  </span>
                  <Badge variant="outline" className="text-xs">PDF</Badge>
                  {pdfProgress.state === "success" && (
                    <button
                      onClick={() => removeFile("pdf")}
                      className="ml-1 p-0.5 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Processing message */}
          {isProcessing && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {isProcessingExcel && excelProgress.message}
              {isProcessingExcel && isProcessingPdf && " | "}
              {isProcessingPdf && pdfProgress.message}
            </p>
          )}

          {/* Error messages */}
          {(excelError || pdfError) && (
            <div className="flex flex-col gap-1 text-center">
              {excelError && (
                <p className="text-sm text-destructive">{excelError}</p>
              )}
              {pdfError && (
                <p className="text-sm text-destructive">{pdfError}</p>
              )}
            </div>
          )}

          {/* Browse button */}
          <div className="flex flex-col items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALL_ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              className="sr-only"
              multiple
              disabled={isProcessing}
            />
            <Button
              type="button"
              variant={hasExcel || hasPdf ? "outline" : "default"}
              className="gap-2"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
            >
              {hasExcel || hasPdf ? (
                <>
                  <Plus className="h-4 w-4" />
                  Add More Files
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Select Files
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-medium">Excel:</span> {ACCEPTED_FILE_EXTENSIONS.join(", ")}
              <span className="mx-2">|</span>
              <span className="font-medium">PDF:</span> Layout drawings (optional)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
