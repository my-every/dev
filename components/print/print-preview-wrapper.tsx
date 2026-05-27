"use client";

import { useEffect, useState, useCallback, type ReactNode, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintPreviewWrapperProps {
  children: ReactNode;
  title?: string;
}

// Inner component that uses useSearchParams (requires Suspense)
function PrintPreviewContent({ children, title = "Print Preview" }: PrintPreviewWrapperProps) {
  const searchParams = useSearchParams();
  const [zoom, setZoom] = useState(100); // Start at 100% for full-size preview
  const [mounted, setMounted] = useState(false);

  // Auto-print if ?print=1 is in the URL
  const shouldAutoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && shouldAutoPrint) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, shouldAutoPrint]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 10, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 10, 25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(100);
  }, []);

  const handleClose = useCallback(() => {
    // Try to close the window, fallback to going back in history
    if (window.opener) {
      window.close();
    } else {
      window.history.back();
    }
  }, []);

  // Calculate the scale factor
  const scale = zoom / 100;
  
  // Fixed page width in pixels (matches print width for letter size content)
  const PAGE_WIDTH = 860;

  return (
    <div className="min-h-screen bg-neutral-400 print:bg-white print:min-h-0">
      {/* Toolbar - hidden during print */}
      <div className="print:hidden sticky top-0 z-50 flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 border-b bg-white shadow-sm">
        {/* Close Button */}
        <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8" title="Close">
          <X className="h-4 w-4" />
        </Button>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground w-10 text-center tabular-nums">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom} title="Reset zoom">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Print Button */}
        <Button type="button" onClick={handlePrint} size="icon" className="h-9 w-9 rounded-full" title="Print">
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable viewport */}
      <div className="overflow-auto print:overflow-visible min-h-[calc(100vh-52px)]">
        {/* 
          Transform-based scaling: The page content has a fixed width and layout.
          CSS transform scales the visual appearance without affecting internal layout.
          This works like a PDF viewer - zoom changes the visual size, not the page layout.
        */}
        <div 
          className="flex justify-center py-8 print:py-0 print:block"
          style={{
            // Ensure container is wide enough for scaled content + padding
            minWidth: PAGE_WIDTH * scale + 48,
          }}
        >
          {/* Fixed-width page container that gets visually scaled */}
          <div
            className="print:transform-none"
            style={{
              // Fixed page width - internal layout is always the same
              width: PAGE_WIDTH,
              minWidth: PAGE_WIDTH,
              // Visual scaling via CSS transform
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that provides Suspense boundary for useSearchParams
export function PrintPreviewWrapper(props: PrintPreviewWrapperProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading print preview...</div>}>
      <PrintPreviewContent {...props} />
    </Suspense>
  );
}
