'use client'

/**
 * Print Toolbar Component
 * 
 * Provides print controls, zoom, and configuration options.
 */

import { useState } from 'react'
import { 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Settings2, 
  Download,
  X,
  FileText,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { PrintConfig } from '@/lib/print/types'

interface PrintToolbarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  config: PrintConfig
  onConfigChange: (config: PrintConfig) => void
  onPrint: () => void
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

export function PrintToolbar({
  zoom,
  onZoomChange,
  config,
  onConfigChange,
  onPrint,
  onClose,
  showCloseButton = true,
  className = '',
}: PrintToolbarProps) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 10, 200))
  }
  
  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 10, 25))
  }
  
  const handleResetZoom = () => {
    onZoomChange(100)
  }
  
  return (
    <div className={`print-toolbar flex items-center gap-2 px-4 py-2 border-b bg-card ${className}`}>
      {/* Close Button */}
      {showCloseButton && onClose && (
        <>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" />
            Close
          </Button>
          <Separator orientation="vertical" className="h-6" />
        </>
      )}
      
      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="w-20 px-2">
          <Slider
            value={[zoom]}
            min={25}
            max={200}
            step={5}
            onValueChange={([value]) => onZoomChange(value)}
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      {/* Page Options */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Options
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-4">
            <div className="text-sm font-medium">Print Options</div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showCover"
                  checked={config.showCoverPage}
                  onCheckedChange={(checked) => 
                    onConfigChange({ ...config, showCoverPage: !!checked })
                  }
                />
                <Label htmlFor="showCover" className="text-sm cursor-pointer">
                  Include Cover Page
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showToc"
                  checked={config.showTableOfContents}
                  onCheckedChange={(checked) => 
                    onConfigChange({ ...config, showTableOfContents: !!checked })
                  }
                />
                <Label htmlFor="showToc" className="text-sm cursor-pointer">
                  Include Table of Contents
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showPageNumbers"
                  checked={config.showPageNumbers}
                  onCheckedChange={(checked) => 
                    onConfigChange({ ...config, showPageNumbers: !!checked })
                  }
                />
                <Label htmlFor="showPageNumbers" className="text-sm cursor-pointer">
                  Show Page Numbers
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showFooter"
                  checked={config.showFooter}
                  onCheckedChange={(checked) => 
                    onConfigChange({ ...config, showFooter: !!checked })
                  }
                />
                <Label htmlFor="showFooter" className="text-sm cursor-pointer">
                  Show Footer
                </Label>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Print Button */}
      <Button onClick={onPrint} className="gap-2">
        <Printer className="h-4 w-4" />
        Print
      </Button>
    </div>
  )
}
