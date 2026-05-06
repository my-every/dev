"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { LwcTypeField, RevisionField, UnitNumberField } from "@/components/projects/fields";
import { LWC_TYPE_REGISTRY, type LwcType } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";

import { ProjectIcon } from "./project-icon";
import type { DueProjectNavItem } from "./projects-side-panel-nav";

type ProjectNavCardVariant = "default" | "due-emphasis";

type ProjectNavCardProps = {
  project: DueProjectNavItem;
  /** Optional override for the card key when used in repeated groups. */
  variant?: ProjectNavCardVariant;
  /** Extra trailing content rendered after the badges row. */
  trailing?: ReactNode;
  /** When provided, replaces the default ProjectIcon on the left. */
  leading?: ReactNode;
  /** When provided and the project has no href, render as a clickable button. */
  onClick?: () => void;
  className?: string;
};

const BASE_CARD_CLASSES =
  "w-full flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-3 transition-colors";

/**
 * Single project card rendered inside the side-panel nav and inside grouped
 * accordions. Wraps in a Link when the project has an href, otherwise renders
 * a non-interactive div.
 */
export function ProjectNavCard({
  project,
  variant = "default",
  trailing,
  leading,
  onClick,
  className,
}: ProjectNavCardProps) {
  const dueLabel = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString()
    : "No due date";
  const lwcType = toLwcType(project.lwcType);

  const dueClassName =
    variant === "due-emphasis"
      ? "text-[11px] text-red-500"
      : "text-[11px] text-muted-foreground";

  const content = (
    <>
      {leading ?? (
        <ProjectIcon
          name={project.name}
          color={project.color ?? undefined}
          interactive={false}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {project.name}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project.unitNumber ? (
            <UnitNumberField
              mode="status"
              value={project.unitNumber}
              className="h-5 text-[10px]"
            />
          ) : null}
      
          {project.revision ? (
            <RevisionField
              mode="status"
              value={project.revision}
              className="h-5 text-[10px]"
            />
          ) : null}
        
        </div>
        {trailing}
      </div>
    </>
  );

  if (project.href) {
    return (
      <Link
        href={project.href}
        className={cn(BASE_CARD_CLASSES, "hover:bg-accent", className)}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(BASE_CARD_CLASSES, "w-full text-left hover:bg-accent cursor-pointer", className)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cn(BASE_CARD_CLASSES, "opacity-80", className)}>
      {content}
    </div>
  );
}

function toLwcType(value?: string | null): LwcType | undefined {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return normalized in LWC_TYPE_REGISTRY ? (normalized as LwcType) : undefined;
}
