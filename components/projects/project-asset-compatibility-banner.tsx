"use client";

/**
 * Banner component showing workbook/PDF compatibility status.
 * 
 * Displays:
 * - Project number match status
 * - Revision match status
 * - Sheet-to-page mapping summary
 * - Warnings for mismatches
 */

import { AlertCircle, CheckCircle2, AlertTriangle, FileImage, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { CompatibilityResult } from "@/lib/layout-matching";
import { getCompatibilityMessage, getCompatibilityBadgeVariant } from "@/lib/layout-matching";

interface ProjectAssetCompatibilityBannerProps {
  compatibility: CompatibilityResult | null;
  className?: string;
}

export function ProjectAssetCompatibilityBanner({
  compatibility,
  className = "",
}: ProjectAssetCompatibilityBannerProps) {
  // Don't render if no compatibility data
  if (!compatibility) {
    return null;
  }

  // Determine icon and variant based on status
  const getStatusIcon = () => {
    switch (compatibility.status) {
      case "matched":
        return <CheckCircle2 className="h-4 w-4" />;
      case "partial_match":
        return <AlertTriangle className="h-4 w-4" />;
      case "mismatch":
        return <AlertCircle className="h-4 w-4" />;
      case "missing_pdf":
        return <Info className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (): "default" | "destructive" => {
    return compatibility.status === "mismatch" ? "destructive" : "default";
  };

  const badgeVariant = getCompatibilityBadgeVariant(compatibility.status);
  const message = getCompatibilityMessage(compatibility);

  // If missing PDF, show minimal info state
  if (compatibility.status === "missing_pdf") {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <FileImage className="h-4 w-4" />
        <span>No layout PDF attached</span>
      </div>
    );
  }

  return (
    <Alert variant={getAlertVariant()} className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <AlertTitle className="flex items-center gap-2 text-sm m-0">
            Layout PDF Status
            <Badge variant={badgeVariant} className="text-xs">
              {compatibility.status === "matched" ? "Matched" :
                compatibility.status === "partial_match" ? "Partial Match" : "Mismatch"}
            </Badge>
          </AlertTitle>
        </div>

        <AlertDescription className="flex flex-wrap items-center gap-4 text-xs sm:ml-auto">
          {/* Match details - inline flex row */}
          {compatibility.workbookMeta?.projectNumber && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Project:</span>
              <span className={compatibility.projectNumberMatch ? "text-chart-2" : "text-muted-foreground"}>
                {compatibility.pdfMeta?.projectNumber || "?"}
              </span>
              {compatibility.projectNumberMatch && (
                <CheckCircle2 className="h-3 w-3 text-chart-2" />
              )}
            </div>
          )}

          {compatibility.workbookMeta?.revision && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Rev:</span>
              <span className={compatibility.revisionMatch ? "text-chart-2" : "text-muted-foreground"}>
                {compatibility.pdfMeta?.revision || "?"}
              </span>
              {compatibility.revisionMatch && (
                <CheckCircle2 className="h-3 w-3 text-chart-2" />
              )}
            </div>
          )}

          {/* Warnings indicator */}
          {compatibility.warnings.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>{compatibility.warnings.length} warning{compatibility.warnings.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}
