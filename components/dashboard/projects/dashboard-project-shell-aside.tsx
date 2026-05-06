"use client";

import { ExternalLink, Layers, Link2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import type { ProjectManifest } from "@/types/project-manifest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardProjectAside } from "@/components/projects/dashboard-project-aside";
import { getDashboardProjectStatus, hasUploadedLegals } from "@/lib/projects/dashboard-status";
import { useLayoutUI } from "@/components/layout/layout-context";

interface DashboardProjectShellAsideProps {
    project: ProjectManifest;
    badgeNumber: string;
    activeShellTab: string;
    onClose: () => void;
}

export function DashboardProjectShellAside({
    project,
    badgeNumber,
    activeShellTab,
    onClose,
}: DashboardProjectShellAsideProps) {
    const router = useRouter();
    const { closeAside } = useLayoutUI();
    const assignments = Object.values(project.assignments ?? {});
    const status = getDashboardProjectStatus(project);
    const blockedCount = assignments.filter((assignment) => assignment.status === "BLOCKED").length;
    const inProgressCount = assignments.filter((assignment) => assignment.status === "IN_PROGRESS").length;

    const handleClose = () => {
        onClose();
        closeAside();
    };

    return (
        <DashboardProjectAside project={project} />
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/50 bg-background/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}
