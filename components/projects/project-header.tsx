"use client";

/**
 * Project header component displaying project info and actions.
 */

import { FileSpreadsheet, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectModel } from "@/lib/workbook/types";

interface ProjectHeaderProps {
  project: ProjectModel;
  onClear: () => void;
}

export function ProjectHeader({ project, onClear }: ProjectHeaderProps) {
  const operationalCount = project.sheets.filter(s => s.kind === "operational").length;
  const referenceCount = project.sheets.filter(s => s.kind === "reference").length;
  const totalRows = project.sheets.reduce((sum, s) => sum + s.rowCount, 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between p-6 rounded-xl bg-card/30 border border-border/50">
      <div className="flex items-start w-full justify-between gap-4">
       
        <div className="flex flex-col flex-1 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="default" className="bg-muted  text-foreground border border-muted/30">{operationalCount} Wire Lists</Badge>
            <Badge variant="secondary" className="bg-secondary/50">{referenceCount} Reference</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {project.createdAt.toLocaleDateString()}
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span>{project.sheets.length} sheets</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{totalRows.toLocaleString()} total rows</span>
          </div>
      </div>
      <div className="flex gap-2 sm:flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Project
        </Button>
      </div>
    </div>
  );
}
