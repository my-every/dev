"use client";

/**
 * Layout preview component for wire list detail pages.
 * 
 * Displays the matched layout page preview above/beside the wire list table.
 * Clicking opens the full layout preview modal.
 */

import { useState } from "react";
import { FileImage, Eye, LayoutTemplate } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LayoutPagePreview, SheetLayoutMatch } from "@/lib/layout-matching";
import { LayoutPreviewModal } from "@/components/projects/layout-preview-modal";

interface WireListLayoutPreviewProps {
  page: LayoutPagePreview;
  match: SheetLayoutMatch;
  workspaceEndpoint?: string | null;
  className?: string;
}

export function WireListLayoutPreview({
  page,
  match,
  workspaceEndpoint = null,
  className = "",
}: WireListLayoutPreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  if (!page || !workspaceEndpoint) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <FileImage className="h-8 w-8" />
            <span className="text-sm">Layout preview unavailable</span>
            <span className="text-xs text-muted-foreground/70">
              Please re-upload the layout PDF
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className={`overflow-hidden  pt-0 pb-6 ${className}`}>
        <div 
          className="relative cursor-pointer group"
          onClick={() => setIsModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsModalOpen(true);
            }
          }}
        >
          <div className="flex h-48 flex-col justify-between bg-muted px-4 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Layout Workspace
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                {page.title || `Page ${page.pageNumber}`}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the PDF workspace to search, inspect, and highlight this matched layout page.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                Page {page.pageNumber}
              </Badge>
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          {/* Info Bar */}
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileImage className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{page.title || `Page ${page.pageNumber}`}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Page {page.pageNumber}
              </Badge>
              {match.confidence === "high" && (
                <Badge variant="default" className="text-xs">Matched</Badge>
              )}
              {match.confidence === "medium" && (
                <Badge variant="secondary" className="text-xs">Likely</Badge>
              )}
            </div>
          </CardContent>
        </div>
        
        {/* Alternative matches hint */}
        {match.alternativeMatches && match.alternativeMatches.length > 0 && (
          <div className="px-3 pb-3 pt-0">
            <p className="text-xs text-muted-foreground">
              {match.alternativeMatches.length} alternative page{match.alternativeMatches.length !== 1 ? "s" : ""} available
            </p>
          </div>
        )}
      </Card>
      
      {/* Layout Preview Modal */}
      <LayoutPreviewModal
        endpoint={workspaceEndpoint}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

/**
 * Compact inline layout preview button.
 */
export function WireListLayoutPreviewButton({
  page,
  workspaceEndpoint = null,
}: {
  page: LayoutPagePreview;
  workspaceEndpoint?: string | null;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="gap-2"
      >
        <Eye className="h-4 w-4" />
        View Layout
        <Badge variant="secondary" className="text-xs ml-1">
          Page {page.pageNumber}
        </Badge>
      </Button>
      
      <LayoutPreviewModal
        endpoint={workspaceEndpoint}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

/**
 * Placeholder when no layout is available.
 */
export function WireListLayoutPlaceholder({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Card className={`bg-muted/30 border-dashed ${className}`}>
      <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
        <div className="flex flex-col items-center gap-2 text-center">
          <FileImage className="h-6 w-6" />
          <span className="text-xs">No layout preview available</span>
          <span className="text-xs text-muted-foreground/70">
            Upload a layout PDF to see the matched drawing
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
