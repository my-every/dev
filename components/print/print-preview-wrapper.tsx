"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

interface PrintPreviewWrapperProps {
  children: ReactNode;
  title?: string;
}

export function PrintPreviewWrapper({ children, title = "Print Preview" }: PrintPreviewWrapperProps) {
  const searchParams = useSearchParams();
  const [zoom, setZoom] = useState(50); // Start at 50% for better overview
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

  const handleFitWidth = useCallback(() => {
    setZoom(50);
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

  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white print:min-h-0">
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
        <Button onClick={handlePrint} size="icon" className="h-9 w-9 rounded-full" title="Print">
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {/* Content container - scrollable viewport */}
      <div className="overflow-auto print:overflow-visible">
        {/* 
          Scaling container: Uses CSS zoom for consistent scaling that respects layout.
          CSS zoom is widely supported and scales both visual appearance AND layout dimensions.
        */}
        <div 
          className="p-4 sm:p-6 print:p-0 print:!zoom-100"
          style={{
            zoom: scale,
            // Fallback for Firefox which doesn't support zoom
            // @ts-expect-error - MozTransform for Firefox fallback
            MozTransform: `scale(${scale})`,
            MozTransformOrigin: "top center",
          }}
        >
          {/* Center the content */}
          <div className="mx-auto print:mx-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
