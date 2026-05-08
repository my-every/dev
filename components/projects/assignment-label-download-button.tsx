"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LabelType = "blue" | "white" | "cable";

const LABEL_META: Record<LabelType, { label: string; className: string; iconClassName: string }> = {
  blue: {
    label: "Blue Labels",
    className:
      "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
    iconClassName: "text-blue-500 dark:text-blue-400",
  },
  white: {
    label: "White Labels",
    className:
      "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
    iconClassName: "text-muted-foreground",
  },
  cable: {
    label: "Cable Labels",
    className:
      "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900",
    iconClassName: "text-amber-500 dark:text-amber-400",
  },
};

interface AssignmentLabelDownloadButtonProps {
  projectId: string;
  assignmentSlug: string;
  labelType: LabelType;
  className?: string;
}

export function AssignmentLabelDownloadButton({
  projectId,
  assignmentSlug,
  labelType,
  className,
}: AssignmentLabelDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const meta = LABEL_META[labelType];

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const url = `/api/projects/${encodeURIComponent(projectId)}/assignment-labels-xlsx?assignmentSlug=${encodeURIComponent(assignmentSlug)}&labelType=${labelType}`;
      const res = await fetch(url);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        console.error("Label download failed:", err.error);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? `${assignmentSlug}-${labelType}-labels.xlsx`;

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        meta.className,
        className,
      )}
    >
      {loading ? (
        <Loader2 className={cn("h-3 w-3 animate-spin", meta.iconClassName)} />
      ) : (
        <Download className={cn("h-3 w-3", meta.iconClassName)} />
      )}
      {meta.label}
    </button>
  );
}
