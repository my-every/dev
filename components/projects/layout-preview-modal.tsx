"use client";

import { LayoutPdfWorkspaceDialog } from "@/components/projects/layout-pdf-workspace-dialog";

interface LayoutPreviewModalProps {
  endpoint: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LayoutPreviewModal({
  endpoint,
  isOpen,
  onClose,
}: LayoutPreviewModalProps) {
  return (
    <LayoutPdfWorkspaceDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      endpoint={endpoint}
    />
  );
}
