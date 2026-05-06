'use client'

/**
 * SWS Worksheet Header
 * 
 * Renders the header section of the SWS worksheet including:
 * - SWS-IPV ID
 * - Process Description
 * - Revision Level and Date
 * - Caterpillar Production System branding
 */

import { cn } from '@/lib/utils'
import type { SwsTemplateDefinition, SwsExecutionMode } from '@/types/d380-sws'

export interface SwsWorksheetHeaderProps {
  template: SwsTemplateDefinition
  executionMode: SwsExecutionMode
  className?: string
}

export function SwsWorksheetHeader({
  template,
  executionMode,
  className,
}: SwsWorksheetHeaderProps) {
  const isPrintMode = executionMode === 'PRINT_MANUAL'
  
  return (
    <div className={cn(
      'border-b border-border',
      isPrintMode && 'print:border-black',
      className
    )}>
      {/* Top Row - CPS Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-1.5 bg-muted/50',
        isPrintMode && 'print:bg-gray-100',
      )}>
        <div className="text-xs font-medium">
          Caterpillar Production System
        </div>
        <div className="text-xs text-muted-foreground">
          SWS-IPV Panel Build Up/Wire
        </div>
      </div>
      
      {/* Main Header */}
      <div className="flex items-stretch">
        {/* Left Side - Title Block */}
        <div className="flex-1 p-3 border-r border-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
            Standard Work Sheet - In-Process Validation
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] text-muted-foreground">SWS - IPV ID</span>
          </div>
          
          <div className={cn(
            'text-sm font-medium mt-1',
            isPrintMode && 'print:text-xs',
          )}>
            {template.swsIpvId}
          </div>
          
          <div className="mt-2">
            <div className="text-[10px] text-muted-foreground">Process Description:</div>
            <div className={cn(
              'text-sm font-medium',
              isPrintMode && 'print:text-xs',
            )}>
              {template.processDescription}
            </div>
          </div>
        </div>
        
        {/* Right Side - Revision Block */}
        <div className="w-48 p-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Rev Level</div>
              <div className="font-medium">{template.revisionLevel}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Date</div>
              <div className="font-medium">{template.revisionDate}</div>
            </div>
          </div>
          
          {/* References */}
          <div className="mt-3">
            <div className="text-[10px] text-muted-foreground">References:</div>
            <div className="text-[10px]">
              {template.references.join(', ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
