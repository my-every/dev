'use client'

/**
 * Print Metadata Section Component
 * 
 * Renders project/document metadata in a consistent format.
 */

import type { PrintDocumentMetadata } from '@/lib/print/types'

interface PrintMetadataSectionProps {
  metadata: PrintDocumentMetadata
  overrides?: Partial<PrintDocumentMetadata>
  compact?: boolean
  className?: string
}

export function PrintMetadataSection({
  metadata,
  overrides = {},
  compact = false,
  className = '',
}: PrintMetadataSectionProps) {
  const merged = { ...metadata, ...overrides }
  
  if (compact) {
    return (
      <div className={`print-metadata-compact flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
        <span><strong>Project:</strong> {merged.projectName}</span>
        {merged.pdNumber && <span><strong>PD#:</strong> {merged.pdNumber}</span>}
        {merged.unit && <span><strong>Unit:</strong> {merged.unit}</span>}
        {merged.panel && <span><strong>Panel:</strong> {merged.panel}</span>}
        {merged.revision && <span><strong>Rev:</strong> {merged.revision}</span>}
        <span><strong>Date:</strong> {new Date(merged.createdAt).toLocaleDateString()}</span>
      </div>
    )
  }
  
  return (
    <div className={`print-metadata-section border rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Document Information
      </h3>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Project</span>
          <span className="font-medium">{merged.projectName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Document</span>
          <span className="font-medium">{merged.documentTitle}</span>
        </div>
        {merged.pdNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">PD#</span>
            <span className="font-medium">{merged.pdNumber}</span>
          </div>
        )}
        {merged.unit && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unit</span>
            <span className="font-medium">{merged.unit}</span>
          </div>
        )}
        {merged.panel && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Panel</span>
            <span className="font-medium">{merged.panel}</span>
          </div>
        )}
        {merged.revision && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Revision</span>
            <span className="font-medium">{merged.revision}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Date</span>
          <span className="font-medium">
            {new Date(merged.createdAt).toLocaleDateString()}
          </span>
        </div>
        {merged.createdBy && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created By</span>
            <span className="font-medium">{merged.createdBy}</span>
          </div>
        )}
      </div>
    </div>
  )
}
