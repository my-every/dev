"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, FolderPlus, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { cn } from "@/lib/utils";

type CreateMode = "project" | "unit" | null;

export function LegalCreateSplitActionButton({
  pdNumber,
  revision,
  disabled,
}: {
  pdNumber: string;
  revision: string | null;
  disabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  return (
    <>
      <div className="inline-flex min-w-0 flex-1 items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Button
          size="sm"
          className="flex-1 rounded-r-none border-r border-primary-foreground/20"
          disabled={disabled}
          onClick={() => setCreateMode("project")}
        >
          <FolderPlus className="mr-1.5 h-4 w-4" />
          Create
        </Button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              className="rounded-l-none px-2.5"
              disabled={disabled}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-88 overflow-hidden rounded-2xl border-border/60 p-0">
            <div className="border-b border-border/50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Create</p>
              <p className="mt-1 text-sm font-medium">Choose a workflow</p>
            </div>
            <div className="space-y-2 p-3">
              <ActionCard
                title="Create project instance"
                description="Create a standard project instance from this legal package."
                icon={<FolderPlus className="h-4 w-4" />}
                onClick={() => {
                  setCreateMode("project");
                  setMenuOpen(false);
                }}
              />
              <ActionCard
                title="Create project unit instance"
                description="Create a unit-focused project instance and require a unit number."
                icon={<PackagePlus className="h-4 w-4" />}
                onClick={() => {
                  setCreateMode("unit");
                  setMenuOpen(false);
                }}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <CreateProjectDialog
        trigger={null}
        open={createMode === "project"}
        onOpenChange={(open) => {
          if (!open) {
            setCreateMode(null);
          }
        }}
        dialogTitle="Create Project Instance"
        dialogDescription="Create a standard project instance from this legal package."
        initialValues={{ sourceMode: "legal-library" }}
        initialLegalSource={{ pdNumber, revision }}
      />

      <CreateProjectDialog
        trigger={null}
        open={createMode === "unit"}
        onOpenChange={(open) => {
          if (!open) {
            setCreateMode(null);
          }
        }}
        dialogTitle="Create Project Unit Instance"
        dialogDescription="Create a project unit instance from this legal package. Unit number is required for this flow."
        requireUnitNumber
        initialValues={{
          sourceMode: "legal-library",
          name: `${pdNumber} Unit`,
        }}
        initialLegalSource={{ pdNumber, revision }}
      />
    </>
  );
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-border/50 p-2 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}
