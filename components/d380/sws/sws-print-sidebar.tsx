'use client'

import { useState } from 'react'
import { Printer, Download, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { SwsTemplateId, SwsWorksheetOverrideState, SwsWorksheetContext } from '@/types/d380-sws'
import { SWS_TEMPLATE_REGISTRY } from '@/lib/sws/sws-template-registry'

interface SwsPrintSidebarProps {
  context: SwsWorksheetContext
  swsType: SwsTemplateId
  overrides: SwsWorksheetOverrideState
  onOverrideChange: (overrides: SwsWorksheetOverrideState) => void
  onSwsTypeChange: (type: SwsTemplateId) => void
  onPrint: () => void
  onExportPdf?: () => void
}

/**
 * Sidebar panel for print mode that allows overwriting worksheet metadata.
 * Used when printing SWS worksheets with manual corrections.
 */
export function SwsPrintSidebar({
  context,
  swsType,
  overrides,
  onOverrideChange,
  onSwsTypeChange,
  onPrint,
  onExportPdf,
}: SwsPrintSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const updateOverride = (field: keyof SwsWorksheetOverrideState, value: string) => {
    onOverrideChange({ ...overrides, [field]: value || undefined })
  }

  const resetOverrides = () => {
    onOverrideChange({})
  }

  const hasOverrides = Object.values(overrides).some(v => v !== undefined)

  if (!isExpanded) {
    return (
      <div className="fixed right-4 top-20 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsExpanded(true)}
          className="h-10 w-10 rounded-full shadow-lg bg-background"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed right-4 top-20 z-50 w-72 bg-background border border-border rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">Print Settings</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
          Collapse
        </Button>
      </div>

      <div className="p-3 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* SWS Type Selection */}
        <div className="space-y-2">
          <Label className="text-xs">SWS Type</Label>
          <Select value={swsType} onValueChange={v => onSwsTypeChange(v as SwsTemplateId)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SWS_TEMPLATE_REGISTRY).map(([type, template]) => (
                <SelectItem key={type} value={type} className="text-xs">
                  {template.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Override Fields */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Override Values</Label>
            {hasOverrides && (
              <Button variant="ghost" size="sm" onClick={resetOverrides} className="h-6 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <OverrideField
            label="PD#"
            value={overrides.pdNumber ?? ''}
            placeholder={context.pdNumber}
            onChange={v => updateOverride('pdNumber', v)}
          />

          <OverrideField
            label="Project Name"
            value={overrides.projectName ?? ''}
            placeholder={context.projectName}
            onChange={v => updateOverride('projectName', v)}
          />

          <OverrideField
            label="Unit"
            value={overrides.unitNumber ?? ''}
            placeholder={context.unitNumber ?? '—'}
            onChange={v => updateOverride('unitNumber', v)}
          />

          <OverrideField
            label="Panel / Box / Console"
            value={overrides.panelIdentifier ?? ''}
            placeholder={context.panelIdentifier ?? '—'}
            onChange={v => updateOverride('panelIdentifier', v)}
          />

          <OverrideField
            label="Revision"
            value={overrides.revision ?? ''}
            placeholder={context.revision ?? '—'}
            onChange={v => updateOverride('revision', v)}
          />

          <OverrideField
            label="Date"
            value={overrides.operatingDate ?? ''}
            placeholder={context.operatingDate}
            onChange={v => updateOverride('operatingDate', v)}
          />
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          <Button onClick={onPrint} className="w-full h-9 text-sm">
            <Printer className="h-4 w-4 mr-2" />
            Print Worksheet
          </Button>

          {onExportPdf && (
            <Button variant="outline" onClick={onExportPdf} className="w-full h-9 text-sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface OverrideFieldProps {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

function OverrideField({ label, value, placeholder, onChange }: OverrideFieldProps) {
  const isOverridden = value !== ''

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-7 text-xs ${isOverridden ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : ''}`}
      />
    </div>
  )
}
