'use client'

/**
 * Print Preview Shell
 * 
 * A reusable shell component for print preview layouts.
 * Provides consistent structure for all printable documents.
 */

import { forwardRef, type ReactNode } from 'react'
import type { PrintConfig, PrintDocumentMetadata } from '@/lib/print/types'

interface PrintPreviewShellProps {
  metadata: PrintDocumentMetadata
  config: PrintConfig
  children: ReactNode
  className?: string
}

export const PrintPreviewShell = forwardRef<HTMLDivElement, PrintPreviewShellProps>(
  function PrintPreviewShell({ metadata, config, children, className = '' }, ref) {
    const pageClass = `
      print-page
      bg-white
      ${config.orientation === 'landscape' ? 'print:landscape' : ''}
      ${className}
    `
    
    return (
      <div
        ref={ref}
        className={pageClass}
        style={{
          minHeight: config.pageSize === 'letter' ? '11in' : '14in',
          padding: `${config.margins.top}in ${config.margins.right}in ${config.margins.bottom}in ${config.margins.left}in`,
        }}
      >
        {children}
        
        {/* Footer */}
        {config.showFooter && (
          <div className="print-footer fixed bottom-0 left-0 right-0 px-4 py-2 text-xs text-center text-muted-foreground border-t print:block hidden">
            {config.footerText || 'Caterpillar: Confidential Green'}
          </div>
        )}
      </div>
    )
  }
)
