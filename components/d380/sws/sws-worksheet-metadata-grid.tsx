'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SwsExecutionMode, SwsWorksheetContext, SwsWorksheetOverrideState } from '@/types/d380-sws'

interface SwsWorksheetMetadataGridProps {
  context: SwsWorksheetContext
  mode: SwsExecutionMode
  overrides?: SwsWorksheetOverrideState
  onOverrideChange?: (field: keyof SwsWorksheetOverrideState, value: string) => void
}

/**
 * Renders the metadata grid section of an SWS worksheet.
 * In PRINT_MANUAL mode with sidebar enabled, fields become editable.
 * In TABLET_INTERACTIVE mode, fields are read-only computed values.
 */
export function SwsWorksheetMetadataGrid({
  context,
  mode,
  overrides,
  onOverrideChange,
}: SwsWorksheetMetadataGridProps) {
  const isPrintEditable = mode === 'PRINT_MANUAL' && onOverrideChange

  // Resolve display values - use override if present, otherwise computed
  const pdNumber = overrides?.pdNumber ?? context.pdNumber
  const projectName = overrides?.projectName ?? context.projectName
  const unitNumber = overrides?.unitNumber ?? context.unitNumber
  const panelIdentifier = overrides?.panelIdentifier ?? context.panelIdentifier
  const revision = overrides?.revision ?? context.revision
  const operatingDate = overrides?.operatingDate ?? context.operatingDate

  return (
    <div className="border border-foreground/20 rounded-sm">
      {/* Top row - PD#, Project Name, Unit */}
      <div className="grid grid-cols-3 border-b border-foreground/20">
        <MetadataCell
          label="PD#"
          value={pdNumber}
          editable={isPrintEditable}
          onChange={v => onOverrideChange?.('pdNumber', v)}
        />
        <MetadataCell
          label="Project Name"
          value={projectName}
          editable={isPrintEditable}
          onChange={v => onOverrideChange?.('projectName', v)}
          className="border-x border-foreground/20"
        />
        <MetadataCell
          label="Unit"
          value={unitNumber ?? '—'}
          editable={isPrintEditable}
          onChange={v => onOverrideChange?.('unitNumber', v)}
        />
      </div>

      {/* Bottom row - Panel/Box, Rev, Date */}
      <div className="grid grid-cols-3">
        <MetadataCell
          label="Panel / Box / Console"
          value={panelIdentifier ?? '—'}
          editable={isPrintEditable}
          onChange={v => onOverrideChange?.('panelIdentifier', v)}
        />
        <MetadataCell
          label="Rev"
          value={revision ?? '—'}
          editable={isPrintEditable}
          onChange={v => onOverrideChange?.('revision', v)}
          className="border-x border-foreground/20"
        />
        <MetadataCell
          label="Date"
          value={operatingDate}
          editable={isPrintEditable}
          onChange={v => onOverrideChange?.('operatingDate', v)}
        />
      </div>
    </div>
  )
}

interface MetadataCellProps {
  label: string
  value: string
  editable?: boolean
  onChange?: (value: string) => void
  className?: string
}

function MetadataCell({ label, value, editable, onChange, className }: MetadataCellProps) {
  return (
    <div className={`p-2 ${className ?? ''}`}>
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      {editable ? (
        <Input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          className="h-7 text-sm font-medium mt-1 border-dashed"
        />
      ) : (
        <div className="text-sm font-medium mt-1 min-h-[28px] flex items-center">{value}</div>
      )}
    </div>
  )
}
