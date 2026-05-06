"use client";

import type { ProjectScheduleSlotsProps } from "@/components/projects/project-schedule-slots-types";
import { ProjectScheduleSlotsTable } from "@/components/projects/project-schedule-slots";

export function ProjectScheduleSlotsTableShell(props: ProjectScheduleSlotsProps) {
  return <ProjectScheduleSlotsTable {...props} />;
}
