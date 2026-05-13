import { Columns3, Grid3X3, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceCollectionDisplayView = "grid" | "list" | "kanban";

type WorkspaceCollectionViewToggleProps = {
    value: WorkspaceCollectionDisplayView;
    onValueChange: (value: WorkspaceCollectionDisplayView) => void;
    className?: string;
};

export function WorkspaceCollectionViewToggle({
    value,
    onValueChange,
    className,
}: WorkspaceCollectionViewToggleProps) {
    return (
        <div className={cn("inline-flex shrink-0 items-center rounded-lg border border-border bg-card p-0.5 sm:rounded-xl sm:p-1", className)}>
            <Button
                type="button"
                size="sm"
                variant={value === "grid" ? "secondary" : "ghost"}
                className="h-6 rounded-md px-1.5 sm:h-7 sm:px-2 md:h-8 md:rounded-lg md:px-2.5"
                onClick={() => onValueChange("grid")}
                aria-pressed={value === "grid"}
            >
                <Grid3X3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
                type="button"
                size="sm"
                variant={value === "list" ? "secondary" : "ghost"}
                className="h-6 rounded-md px-1.5 sm:h-7 sm:px-2 md:h-8 md:rounded-lg md:px-2.5"
                onClick={() => onValueChange("list")}
                aria-pressed={value === "list"}
            >
                <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
                type="button"
                size="sm"
                variant={value === "kanban" ? "secondary" : "ghost"}
                className="h-6 rounded-md px-1.5 sm:h-7 sm:px-2 md:h-8 md:rounded-lg md:px-2.5"
                onClick={() => onValueChange("kanban")}
                aria-pressed={value === "kanban"}
            >
                <Columns3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
        </div>
    );
}
