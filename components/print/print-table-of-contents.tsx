'use client'

/**
 * Print Table of Contents Component
 * 
 * Renders a table of contents for multi-section print documents.
 */

import type { TableOfContentsData, TocEntry } from '@/lib/print/types'

interface PrintTableOfContentsProps {
  data: TableOfContentsData
  className?: string
}

export function PrintTableOfContents({ data, className = '' }: PrintTableOfContentsProps) {
  return (
    <div 
      className={`print-toc p-8 ${className}`}
      style={{ pageBreakAfter: 'always' }}
    >
      <h2 className="text-2xl font-bold text-foreground mb-6">{data.title}</h2>
      
      <div className="space-y-1">
        {data.entries.map((entry, index) => (
          <TocEntryRow key={`${entry.sectionId || index}-${entry.title}`} entry={entry} />
        ))}
      </div>
      
      <div className="mt-8 text-xs text-muted-foreground">
        Generated: {new Date(data.generatedAt).toLocaleString()}
      </div>
    </div>
  )
}

interface TocEntryRowProps {
  entry: TocEntry
}

function TocEntryRow({ entry }: TocEntryRowProps) {
  const indentClass = entry.level > 1 ? `pl-${(entry.level - 1) * 4}` : ''
  const fontClass = entry.level === 1 ? 'font-medium' : 'text-sm'
  
  return (
    <div 
      className={`flex items-center justify-between py-1 ${indentClass}`}
      style={{ paddingLeft: entry.level > 1 ? `${(entry.level - 1) * 16}px` : undefined }}
    >
      <span className={`${fontClass} text-foreground`}>{entry.title}</span>
      <span className="text-muted-foreground text-sm">{entry.pageNumber}</span>
    </div>
  )
}
