"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectLifecycleWorkspace } from "@/components/projects/project-lifecycle-workspace";

interface ProjectLifecycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
}

export function ProjectLifecycleModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectLifecycleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[94vh] max-w-[98vw] gap-0 overflow-hidden border-0 bg-card p-0 shadow-2xl sm:max-w-[98vw]" showCloseButton>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Project Lifecycle</DialogTitle>
          <DialogDescription>
            {projectName
              ? `Dependency-aware lifecycle workspace for ${projectName}.`
              : "Dependency-aware lifecycle workspace for this project."}
          </DialogDescription>
        </DialogHeader>

        <ProjectLifecycleWorkspace
          projectId={projectId}
          presentation="modal"
          onRequestClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
