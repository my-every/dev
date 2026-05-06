"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectExportsPanel } from "@/components/projects/project-exports-panel";

interface ProjectExportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ProjectExportsModal({
  open,
  onOpenChange,
  projectId,
}: ProjectExportsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-[92vw] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Project Exports</DialogTitle>
        </DialogHeader>
        <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <ProjectExportsPanel projectId={projectId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
