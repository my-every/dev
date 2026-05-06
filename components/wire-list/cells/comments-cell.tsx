"use client";

/**
 * Comments Cell
 * 
 * An expandable textarea for row-level comments.
 * Uses a popover for editing to prevent table layout disruption.
 * Supports a printVariant mode that renders a static text box for print output.
 */

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CommentsCellProps {
  /** Row ID for state tracking */
  rowId: string;
  /** Current comment value */
  value: string;
  /** Callback when comment changes */
  onChange: (rowId: string, comment: string) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Print variant renders a static text box for paper printing */
  printVariant?: boolean;
}

export function CommentsCell({
  rowId,
  value,
  onChange,
  disabled = false,
  printVariant = false,
}: CommentsCellProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Print variant: static text box for paper printing
  if (printVariant) {
    return (
      <div className="min-w-[80px]">
        <div className="min-h-[20px] border-b border-foreground/20 text-xs text-muted-foreground">
          {value || ""}
        </div>
      </div>
    );
  }
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value with prop when popover opens
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value);
      // Focus textarea on open
      focusTimeoutRef.current = setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }

    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [isOpen, value]);

  const handleSave = () => {
    onChange(rowId, localValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsOpen(false);
  };

  const hasComment = value && value.trim().length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`
            h-7 w-7 p-0
            ${hasComment ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground hover:text-foreground"}
          `}
          aria-label={hasComment ? "Edit comment" : "Add comment"}
        >
          <MessageSquare className={`h-4 w-4 ${hasComment ? "fill-current" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Comment</span>
            <span className="text-xs text-muted-foreground">
              {localValue.length} characters
            </span>
          </div>
          
          <Textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder="Add a comment for this wire..."
            className="min-h-20 resize-none"
            disabled={disabled}
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-8 gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Compact display-only version of comments cell.
 * Shows indicator only, no editing capability.
 */
export function CommentsIndicator({ hasComment }: { hasComment: boolean }) {
  if (!hasComment) return null;
  
  return (
    <div className="flex items-center justify-center">
      <MessageSquare className="h-4 w-4 fill-amber-500 text-amber-500" />
    </div>
  );
}
