'use client'

/**
 * Print Cover Page Component
 * 
 * Renders a professional cover page for printed documents.
 */

import type { CoverPageData } from '@/lib/print/types'

interface PrintCoverPageProps {
  data: CoverPageData
  className?: string
}

export function PrintCoverPage({ data, className = '' }: PrintCoverPageProps) {
  const confidentialityColors = {
    green: 'text-green-600 border-green-600 bg-green-50',
    yellow: 'text-yellow-600 border-yellow-600 bg-yellow-50',
    red: 'text-red-600 border-red-600 bg-red-50',
  }

  const confidentialityClass = data.confidentialityLevel
    ? confidentialityColors[data.confidentialityLevel]
    : confidentialityColors.green

  return (
    <div
      className={`print-cover-page flex flex-col items-center justify-center min-h-[10in] p-8 ${className}`}
      style={{ pageBreakAfter: 'always' }}
    >
      {/* Company Logo/Name */}
      {(data.logoUrl || data.companyName) && (
        <div className="mb-6 text-center">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt={data.companyName || 'Logo'} className="h-16 mx-auto" />
          ) : (
            <div className="text-2xl font-bold text-foreground">{data.companyName}</div>
          )}
        </div>
      )}

      {/* Document Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">{data.documentTitle}</h1>
        <p className="text-lg text-muted-foreground">{data.documentType}</p>
      </div>

      {/* Project Info */}
      <div className="border rounded-lg p-6 w-full max-w-md mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Project Information
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Project</dt>
            <dd className="font-medium">{data.projectName}</dd>
          </div>
          {data.pdNumber && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">PD#</dt>
              <dd className="font-medium">{data.pdNumber}</dd>
            </div>
          )}
          {data.unit && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Unit</dt>
              <dd className="font-medium">{data.unit}</dd>
            </div>
          )}
          {data.panel && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Panel</dt>
              <dd className="font-medium">{data.panel}</dd>
            </div>
          )}
          {data.revision && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Revision</dt>
              <dd className="font-medium">{data.revision}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Prepared/Approved By */}
      <div className="grid grid-cols-2 gap-8 w-full max-w-md mb-8">
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Prepared By
          </div>
          <div className="border-b border-dashed pb-1 mb-1">
            {data.preparedBy || <span className="invisible">_</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {data.preparedDate || 'Date'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Approved By
          </div>
          <div className="border-b border-dashed pb-1 mb-1">
            {data.approvedBy || <span className="invisible">_</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {data.approvedDate || 'Date'}
          </div>
        </div>
      </div>

      {/* Confidentiality Badge */}
      <div className={`px-4 py-2 rounded border text-sm font-medium ${confidentialityClass}`}>
        Caterpillar: Confidential {data.confidentialityLevel?.charAt(0).toUpperCase()}{data.confidentialityLevel?.slice(1) || 'Green'}
      </div>
    </div>
  )
}
