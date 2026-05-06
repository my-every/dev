"use client";

import * as React from "react";
import { useMemo, useCallback, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components";
import type { ProjectManifest } from "@/types/project-manifest";

interface ProjectPickerProps {
  projects: ProjectManifest[];
  selectedId: string;
  onSelectionChange: (projectId: string, pdNumber: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Project Picker with Visual Context
 *
 * Enhanced project selector featuring:
 * - Project icon thumbnail with color
 * - Project name + PD number
 * - LWC type badge
 * - Searchable dropdown
 * - Organized list view
 */
export function ProjectPickerWithContext({
  projects,
  selectedId,
  onSelectionChange,
  loading = false,
  placeholder = "Select project",
  className,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const handleSelect = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        onSelectionChange(projectId, project.pdNumber);
        setOpen(false);
      }
    },
    [projects, onSelectionChange],
  );

  // Render project option with context
  const renderProjectOption = (project: ProjectManifest) => (
    <div className="flex items-center gap-2.5 min-w-0">
      <ProjectIcon
        name={project.name}
        color={project.color}
        interactive={false}
        size="sm"
      />
      <div className="min-w-0 flex-1 py-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate text-foreground">
            {project.name}
          </span>
          {project.lwcType && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {project.lwcType}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{project.pdNumber}</span>
          {project.unitNumber && (
            <>
              <span>·</span>
              <span>U{project.unitNumber}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select Project"
          className={cn(" w-full py-2.5 justify-between px-3", className)}
          disabled={loading}
        >
          <div className="min-w-0 flex-1 text-left">
            {selectedProject ? renderProjectOption(selectedProject) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading projects..." : "No projects match your search"}
            </CommandEmpty>
            <CommandGroup>
              {projects.map((project) => {
                const value = `${project.id} ${project.name} ${project.pdNumber} ${project.unitNumber ?? ""}`;
                const isSelected = selectedId === project.id;
                return (
                  <CommandItem
                    key={project.id}
                    value={value}
                    onSelect={() => handleSelect(project.id)}
                    className="gap-2.5 px-3 py-2.5"
                  >
                    <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">{renderProjectOption(project)}</div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
