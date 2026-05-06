"use client";

import type { ElementType } from "react";

import { EmptyTabState } from "@/components/projects/tabs/project-tab-helpers";

export function ProjectPlaceholderTab({
  icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return <EmptyTabState icon={icon} title={title} description={description} />;
}
