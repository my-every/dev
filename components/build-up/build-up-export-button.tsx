'use client'

/**
 * BuildUpExportButton
 * 
 * Button component that triggers print/export of Build Up SWS worksheet.
 * Supports both blank and execution-data modes.
 */

import { useRef, useState, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer, FileText, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { BuildUpPrintView } from './build-up-print-view'
import type { BuildUpExecutionSession } from '@/types/d380-build-up-execution'

interface BuildUpExportButtonProps {
  assignmentName: string
  swsType: string
  projectName?: string
  pdNumber?: string
  session?: BuildUpExecutionSession | null
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function BuildUpExportButton({
  assignmentName,
  swsType,
  projectName,
  pdNumber,
  session,
  variant = 'outline',
  size = 'sm',
}: BuildUpExportButtonProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [printMode, setPrintMode] = useState<'blank' | 'with_execution'>('blank')
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Build_Up_SWS_${assignmentName.replace(/\s+/g, '_')}`,
    onBeforePrint: () => {
      setIsPrinting(true)
      return Promise.resolve()
    },
    onAfterPrint: () => {
      setIsPrinting(false)
    },
  })

  const handlePrintBlank = useCallback(() => {
    setPrintMode('blank')
    // Small delay to ensure state updates before print
    setTimeout(() => {
      handlePrint()
    }, 100)
  }, [handlePrint])

  const handlePrintWithExecution = useCallback(() => {
    setPrintMode('with_execution')
    setTimeout(() => {
      handlePrint()
    }, 100)
  }, [handlePrint])

  const hasSession = session && session.status !== 'not_started'

  return (
    <>
      {/* Hidden print content */}
      <div className="hidden print:block">
        <BuildUpPrintView
          ref={printRef}
          assignmentName={assignmentName}
          swsType={swsType}
          projectName={projectName}
          pdNumber={pdNumber}
          session={printMode === 'with_execution' ? session : null}
          mode={printMode}
        />
      </div>

      {/* Visible button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            <span className="ml-1.5">Print</span>
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Print Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handlePrintBlank}>
            <FileText className="h-4 w-4 mr-2" />
            <div>
              <div className="font-medium">Print Blank SWS</div>
              <div className="text-xs text-muted-foreground">
                Empty worksheet for manual tracking
              </div>
            </div>
          </DropdownMenuItem>
          
          {hasSession && (
            <DropdownMenuItem onClick={handlePrintWithExecution}>
              <Printer className="h-4 w-4 mr-2" />
              <div>
                <div className="font-medium">Print with Execution Data</div>
                <div className="text-xs text-muted-foreground">
                  Include timestamps and badge info
                </div>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
