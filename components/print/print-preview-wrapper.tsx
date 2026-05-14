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
    window.close();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white print:min-h-0">
      {/* Toolbar - hidden during print */}
      <div className="print:hidden sticky top-0 z-50 flex items-center gap-2 px-4 py-2 border-b bg-white shadow-sm">
        {/* Close Button */}
        <Button variant="ghost" size="sm" onClick={handleClose} className="gap-1.5">
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Close</span>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Title */}
        <span className="text-sm font-medium text-muted-foreground hidden md:block">{title}</span>

        <Separator orientation="vertical" className="h-6 hidden md:block" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-24 px-2 hidden sm:block">
            <Slider
              value={[zoom]}
              min={25}
              max={200}
              step={5}
              onValueChange={([value]) => setZoom(value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom} title="Reset to 100%">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleFitWidth} className="text-xs hidden sm:flex">
            Fit
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Print Button */}
        <Button onClick={handlePrint} size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">Print</span>
        </Button>
      </div>

      {/* Content container - handles overflow and centering */}
      <div className="overflow-auto print:overflow-visible py-6 print:py-0">
        {/* Inner wrapper that scales content */}
        <div 
          className="mx-auto print:transform-none print:mx-0"
          style={{
            width: `${100 / (zoom / 100)}%`,
            maxWidth: "none",
          }}
        >
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
