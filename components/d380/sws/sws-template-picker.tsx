'use client'

import { useState } from 'react'
import { Check, FileText, AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { SwsTemplateId, SwsAutoDetectResult } from '@/types/d380-sws'
import { SWS_TEMPLATE_REGISTRY } from '@/lib/sws/sws-template-registry'

interface SwsTemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  autoDetectResult?: SwsAutoDetectResult
  onSelect: (swsType: SwsTemplateId, overrideReason?: string) => void
}

/**
 * Dialog for Team Lead to select SWS type during assignment creation.
 * Shows auto-detected recommendation with option to override.
 */
export function SwsTemplatePicker({
  open,
  onOpenChange,
  autoDetectResult,
  onSelect,
}: SwsTemplatePickerProps) {
  const [selectedType, setSelectedType] = useState<SwsTemplateId | null>(
    autoDetectResult?.detectedType ?? null
  )
  const [overrideReason, setOverrideReason] = useState('')
  const [showOverrideReason, setShowOverrideReason] = useState(false)

  const isOverride = autoDetectResult && selectedType !== autoDetectResult.detectedType

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType, isOverride ? overrideReason : undefined)
      onOpenChange(false)
    }
  }

  const handleTypeSelect = (type: SwsTemplateId) => {
    setSelectedType(type)
    if (autoDetectResult && type !== autoDetectResult.detectedType) {
      setShowOverrideReason(true)
    } else {
      setShowOverrideReason(false)
      setOverrideReason('')
    }
  }

  // Group templates by category
  const panelTemplates: SwsTemplateId[] = ['PANEL_BUILD_WIRE', 'PANEL_BUILD_WIRE', 'BASIC_BLANK_PANEL']
  const boxTemplates: SwsTemplateId[] = ['BOX_BUILD_UP', 'BOX_CROSS_WIRE']
  const consoleTemplates: SwsTemplateId[] = ['CONSOLE_BUILD_UP_PANEL_HANG', 'CONSOLE_CROSS_WIRE']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select SWS Type</DialogTitle>
          <DialogDescription>
            Choose the appropriate Standard Work Sheet for this assignment. The system has auto-detected a recommendation based on the drawing title and context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-detect result */}
          {autoDetectResult && (
            <div className="bg-muted/50 border rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'mt-0.5 rounded-full p-1',
                  autoDetectResult.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                    autoDetectResult.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                      'bg-muted text-muted-foreground'
                )}>
                  {autoDetectResult.confidence === 'HIGH' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Recommended: {SWS_TEMPLATE_REGISTRY[autoDetectResult.detectedType].title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Confidence: {autoDetectResult.confidence} • {autoDetectResult.reasons.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel Templates */}
          <TemplateGroup
            title="Panel Worksheets"
            types={panelTemplates}
            selectedType={selectedType}
            recommendedType={autoDetectResult?.detectedType}
            onSelect={handleTypeSelect}
          />

          {/* Box Templates */}
          <TemplateGroup
            title="Box Worksheets"
            types={boxTemplates}
            selectedType={selectedType}
            recommendedType={autoDetectResult?.detectedType}
            onSelect={handleTypeSelect}
          />

          {/* Console Templates */}
          <TemplateGroup
            title="Console Worksheets"
            types={consoleTemplates}
            selectedType={selectedType}
            recommendedType={autoDetectResult?.detectedType}
            onSelect={handleTypeSelect}
          />

          {/* Override reason */}
          {showOverrideReason && (
            <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
              <Label className="text-xs text-amber-700 dark:text-amber-300">
                Override Reason (optional)
              </Label>
              <Textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="Explain why you're selecting a different SWS type than recommended..."
                className="mt-2 text-sm min-h-[60px] border-amber-300 dark:border-amber-700"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedType}>
            {isOverride ? 'Override Selection' : 'Confirm Selection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface TemplateGroupProps {
  title: string
  types: SwsTemplateId[]
  selectedType: SwsTemplateId | null
  recommendedType?: SwsTemplateId
  onSelect: (type: SwsTemplateId) => void
}

function TemplateGroup({ title, types, selectedType, recommendedType, onSelect }: TemplateGroupProps) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {types.map(type => {
          const template = SWS_TEMPLATE_REGISTRY[type]
          const isSelected = selectedType === type
          const isRecommended = recommendedType === type

          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{template.title}</span>
                  {isRecommended && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 uppercase tracking-wide">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {template.swsId} • v{template.version}
                </div>
              </div>
              <ChevronRight className={cn(
                'h-4 w-4 flex-shrink-0 transition-opacity',
                isSelected ? 'opacity-100' : 'opacity-0'
              )} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
