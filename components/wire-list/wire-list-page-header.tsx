"use client";

/**
 * Page header for wire list detail pages.
 * Includes breadcrumb navigation and sheet metadata.
 */

import Link from "next/link";
import { ChevronRight, ArrowLeft, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectSheetSummary, ProjectModel, HeaderDetectionInfo } from "@/lib/workbook/types";
import { getSheetKindLabel, getSheetKindVariant } from "@/lib/workbook/classify-sheet";
import { getProjectsRoutePath } from "@/hooks/use-sheet-route";

interface WireListPageHeaderProps {
  project: ProjectModel;
  sheet: ProjectSheetSummary;
  headerDetection?: HeaderDetectionInfo;
}

export function WireListPageHeader({ project, sheet, headerDetection }: WireListPageHeaderProps) {
  const kindLabel = getSheetKindLabel(sheet.kind);
  const kindVariant = getSheetKindVariant(sheet.kind);

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={getProjectsRoutePath()}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-muted-foreground">{project.name}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{sheet.name}</span>
      </nav>

      {/* Header Content */}
      <div className="flex flex-col gap-4 justify-between">
        <div className="flex items-start gap-4 flex-col">
          <div
            className={`
              rounded-lg p-3
              ${sheet.kind === "operational" ? "bg-secondary/20" : "bg-muted"}
            `}
          >
            <Table2
              className={`
                h-6 w-6
                ${sheet.kind === "operational" ? "text-secondary-foreground" : "text-muted-foreground"}
              `}
            />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {sheet.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{sheet.rowCount.toLocaleString()} wire rows</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{sheet.columnCount} columns</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={kindVariant}>{kindLabel}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={getProjectsRoutePath()}>
              Back to Project
            </Link>
          </Button>
        </div>
      </div>


    </div>
  );
}
