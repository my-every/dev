"use client";

/**
 * Draggable Column Header Component
 * 
 * Enables drag-and-drop reordering of table columns within their groups (From/To).
 * Uses HTML5 Drag and Drop API for native drag behavior.
 */

import { useState, useRef } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableColumnHeaderProps {
  /** Column key/id */
  columnKey: string;
  /** Column group (from, to, length) */
  group: string;
  /** Header content */
  children: React.ReactNode;
  /** Whether column reordering is enabled */
  isDraggable?: boolean;
  /** Called when column is dropped to a new position */
  onReorder?: (draggedKey: string, targetKey: string, group: string) => void;
  /** Additional class names */
  className?: string;
}

export function DraggableColumnHeader({
  columnKey,
  group,
  children,
  isDraggable = true,
  onReorder,
  className,
}: DraggableColumnHeaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    if (!isDraggable) return;
    
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ columnKey, group }));
    
    // Add a small delay to set the drag image
    if (dragRef.current) {
      e.dataTransfer.setDragImage(dragRef.current, 0, 0);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      // Check if the dragged item is from the same group
      const data = e.dataTransfer.types.includes("text/plain");
      if (data) {
        setIsDragOver(true);
        e.dataTransfer.dropEffect = "move";
      }
    } catch {
      // Ignore errors during drag
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const draggedKey = data.columnKey;
      const draggedGroup = data.group;

      // Only allow reordering within the same group
      if (draggedGroup !== group) {
        return;
      }

      // Don't do anything if dropping on itself
      if (draggedKey === columnKey) {
        return;
      }

      onReorder?.(draggedKey, columnKey, group);
    } catch {
      // Ignore parse errors
    }
  };

  if (!isDraggable) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-1 cursor-grab select-none",
        isDragging && "opacity-50 cursor-grabbing",
        isDragOver && "bg-secondary/20 rounded",
        className
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </div>
  );
}
