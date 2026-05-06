'use client'

import type { SwsDiscrepancyEntry, SwsIpvCodeMapping, SwsTemplateDefinition } from '@/types/d380-sws'

interface SwsWorksheetFooterProps {
  template: SwsTemplateDefinition
  discrepancies?: SwsDiscrepancyEntry[]
  ipvCodes?: SwsIpvCodeMapping[]
  operatorBadge?: string
  auditorBadge?: string
  completedAt?: string
}

/**
 * Renders the footer section of an SWS worksheet.
 * Includes discrepancy codes, IPV mappings, signature areas, and confidentiality notice.
 */
export function SwsWorksheetFooter({
  template,
  discrepancies = [],
  ipvCodes = [],
  operatorBadge,
  auditorBadge,
  completedAt,
}: SwsWorksheetFooterProps) {
  return (
    <div className="space-y-4 mt-6">
      {/* Discrepancy Codes Section */}
      {template.discrepancyCodes && template.discrepancyCodes.length > 0 && (
        <div className="border border-foreground/20 rounded-sm p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Discrepancy Codes
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {template.discrepancyCodes.map(code => {
              const isActive = discrepancies.some(d => d.code === code.code)
              return (
                <div
                  key={code.code}
                  className={`flex items-start gap-2 p-1.5 rounded ${
                    isActive ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                  }`}
                >
                  <span className="font-mono font-medium text-muted-foreground w-6">{code.code}</span>
                  <span className="text-muted-foreground">{code.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Discrepancies */}
      {discrepancies.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-sm p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
            Recorded Discrepancies
          </div>
          <div className="space-y-2">
            {discrepancies.map((d, i) => (
              <div key={i} className="text-xs flex items-start gap-2">
                <span className="font-mono font-medium text-amber-700 dark:text-amber-300 w-6">{d.code}</span>
                <span className="text-foreground flex-1">{d.notes}</span>
                <span className="text-muted-foreground">{d.badge}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IPV Codes Section */}
      {ipvCodes.length > 0 && (
        <div className="border border-foreground/20 rounded-sm p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            IPV Code Mappings
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ipvCodes.map((mapping, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">{mapping.ipvCode}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground">{mapping.sectionId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature / Completion Area */}
      <div className="border border-foreground/20 rounded-sm">
        <div className="grid grid-cols-2 divide-x divide-foreground/20">
          {/* Operator Signature */}
          <div className="p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Operator
            </div>
            {operatorBadge ? (
              <div className="space-y-1">
                <div className="text-sm font-medium font-mono">{operatorBadge}</div>
                {completedAt && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(completedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-12 border border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                  Signature / Badge
                </span>
              </div>
            )}
          </div>

          {/* Auditor Signature */}
          <div className="p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Auditor / QA
            </div>
            {auditorBadge ? (
              <div className="space-y-1">
                <div className="text-sm font-medium font-mono">{auditorBadge}</div>
              </div>
            ) : (
              <div className="h-12 border border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                  QA Stamp
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments Area */}
      <div className="border border-foreground/20 rounded-sm p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Comments / Notes
        </div>
        <div className="min-h-[60px] border border-dashed border-muted-foreground/20 rounded p-2">
          <span className="text-[10px] text-muted-foreground/40">
            Record any additional notes, observations, or follow-up items here.
          </span>
        </div>
      </div>

      {/* Confidentiality Notice */}
      <div className="text-center py-2 border-t border-foreground/10">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
          Caterpillar: Confidential Green
        </span>
      </div>
    </div>
  )
}
