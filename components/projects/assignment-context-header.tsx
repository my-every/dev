'use client'

/**
 * Assignment Context Header
 * 
 * Displays assignment context information in Build Up, Wiring, and other stage pages.
 * Shows SWS type, confidence, stage, and provides navigation back to assignment details.
 */

import Link from 'next/link'
import { ChevronRight, FileSpreadsheet, Info, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { AssignmentContextData } from '@/hooks/use-assignment-context'

interface AssignmentContextHeaderProps {
  context: AssignmentContextData
  sheetName: string
  showBackLink?: boolean
  className?: string
}

export function AssignmentContextHeader({
  context,
  sheetName,
  showBackLink = true,
  className = '',
}: AssignmentContextHeaderProps) {
  if (!context.hasAssignment) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 ${className}`}>
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          No assignment mapping found for this sheet. 
          <Link href="/projects" className="ml-1 underline hover:no-underline">
            Configure in Projects
          </Link>
        </span>
      </div>
    )
  }
  
  const confidenceColor = context.detectedConfidence
    ? context.detectedConfidence >= 70 ? 'bg-green-500' :
      context.detectedConfidence >= 50 ? 'bg-yellow-500' :
      'bg-red-500'
    : 'bg-gray-500'
  
  return (
    <div className={`flex items-center justify-between px-4 py-2 bg-muted/50 border-b ${className}`}>
      {/* Left: Breadcrumb and Sheet Info */}
      <div className="flex items-center gap-3">
        {showBackLink && context.projectId && (
          <>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Projects
              </Button>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Link href={`/projects/${context.projectId}/assignments/${context.assignment?.sheetSlug}`}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                {context.projectName}
              </Button>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        )}
        
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{sheetName}</span>
        </div>
      </div>
      
      {/* Right: SWS and Stage Info */}
      <div className="flex items-center gap-3">
        {/* SWS Type Badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {context.swsShortLabel}
                </Badge>
                <div 
                  className={`w-2 h-2 rounded-full ${confidenceColor}`}
                  title={`${context.detectedConfidence}% confidence`}
                />
                {context.isOverride && (
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <div><strong>SWS Type:</strong> {context.swsLabel}</div>
                <div><strong>Detected:</strong> {context.detectedConfidence}% confidence</div>
                {context.isOverride && (
                  <div><strong>Override:</strong> {context.overrideReason || 'Manual selection'}</div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Stage Badge */}
        <Badge variant="secondary" className="text-xs">
          {context.stageLabel}
        </Badge>
      </div>
    </div>
  )
}
