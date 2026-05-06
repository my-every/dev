"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import type { SwsTemplateRecord } from "@/types/sws-library";
import type {
  TrainingCompetencyTargets,
  TrainingModuleV2,
  TrainingProgressTrackingConfig,
  TrainingTriggerRules,
} from "@/types/training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const STAGE_OPTIONS: Array<NonNullable<TrainingCompetencyTargets["stages"]>[number]> = [
  "BUILD_UP",
  "WIRING",
  "BOX_BUILD",
  "CROSS_WIRING",
  "TEST",
  "BIQ",
];

interface CompetencyEditorProps {
  competencyTargets: TrainingCompetencyTargets;
  trainingTriggerRules: TrainingTriggerRules;
  progressTracking: TrainingProgressTrackingConfig;
  partNumbers: string[];
  swsTemplates: SwsTemplateRecord[];
  disabled?: boolean;
  onChange: (updates: {
    competencyTargets: TrainingCompetencyTargets;
    trainingTriggerRules: TrainingTriggerRules;
    progressTracking: TrainingProgressTrackingConfig;
    partNumbers: string[];
  }) => void;
}

export function CompetencyEditor({
  competencyTargets,
  trainingTriggerRules,
  progressTracking,
  partNumbers,
  swsTemplates,
  disabled,
  onChange,
}: CompetencyEditorProps) {
  const [partNumberInput, setPartNumberInput] = useState("");
  const [deviceFamilyInput, setDeviceFamilyInput] = useState("");

  const intakeTemplates = useMemo(
    () => swsTemplates.filter((template) => template.kind === "competency-intake"),
    [swsTemplates],
  );

  const update = (updates: Partial<{
    competencyTargets: TrainingCompetencyTargets;
    trainingTriggerRules: TrainingTriggerRules;
    progressTracking: TrainingProgressTrackingConfig;
    partNumbers: string[];
  }>) => {
    onChange({
      competencyTargets,
      trainingTriggerRules,
      progressTracking,
      partNumbers,
      ...updates,
    });
  };

  const addPartNumber = () => {
    const normalized = partNumberInput.trim().toUpperCase();
    if (!normalized || partNumbers.includes(normalized)) return;
    update({
      partNumbers: [...partNumbers, normalized],
      competencyTargets: {
        ...competencyTargets,
        partNumbers: Array.from(new Set([...(competencyTargets.partNumbers ?? []), normalized])),
      },
      trainingTriggerRules: {
        ...trainingTriggerRules,
        requiredForPartNumbers: Array.from(new Set([...(trainingTriggerRules.requiredForPartNumbers ?? []), normalized])),
      },
    });
    setPartNumberInput("");
  };

  const removePartNumber = (partNumber: string) => {
    update({
      partNumbers: partNumbers.filter((value) => value !== partNumber),
      competencyTargets: {
        ...competencyTargets,
        partNumbers: (competencyTargets.partNumbers ?? []).filter((value) => value !== partNumber),
      },
      trainingTriggerRules: {
        ...trainingTriggerRules,
        requiredForPartNumbers: (trainingTriggerRules.requiredForPartNumbers ?? []).filter((value) => value !== partNumber),
      },
    });
  };

  const addDeviceFamily = () => {
    const normalized = deviceFamilyInput.trim();
    if (!normalized || competencyTargets.deviceFamilies.includes(normalized)) return;
    update({
      competencyTargets: {
        ...competencyTargets,
        deviceFamilies: [...competencyTargets.deviceFamilies, normalized],
      },
    });
    setDeviceFamilyInput("");
  };

  const removeDeviceFamily = (value: string) => {
    update({
      competencyTargets: {
        ...competencyTargets,
        deviceFamilies: competencyTargets.deviceFamilies.filter((entry) => entry !== value),
      },
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">Competency Targets</div>
        <p className="text-xs text-muted-foreground">
          Connect this training module to stages, device part numbers, intake templates, and review rules.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Target Stages</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {STAGE_OPTIONS.map((stage) => {
            const checked = competencyTargets.stages.includes(stage);
            return (
              <label key={stage} className="flex items-center gap-2 rounded border px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    update({
                      competencyTargets: {
                        ...competencyTargets,
                        stages: event.target.checked
                          ? [...competencyTargets.stages, stage]
                          : competencyTargets.stages.filter((value) => value !== stage),
                      },
                      trainingTriggerRules: {
                        ...trainingTriggerRules,
                        requiredForStages: event.target.checked
                          ? Array.from(new Set([...(trainingTriggerRules.requiredForStages ?? []), stage]))
                          : (trainingTriggerRules.requiredForStages ?? []).filter((value) => value !== stage),
                      },
                    })
                  }
                />
                <span>{stage.replace(/_/g, " ")}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Qualification Target</Label>
          <Select
            value={competencyTargets.qualificationLevel || "trainee"}
            onValueChange={(value: NonNullable<TrainingCompetencyTargets["qualificationLevel"]>) =>
              update({
                competencyTargets: {
                  ...competencyTargets,
                  qualificationLevel: value,
                },
              })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trainee">Trainee</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="trainer">Trainer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Linked Competency Intake Template</Label>
          <Select
            value=""
            onValueChange={(value) => {
              if (!value) return;
              update({
                competencyTargets: {
                  ...competencyTargets,
                  relatedIntakeTemplateIds: Array.from(
                    new Set([...(competencyTargets.relatedIntakeTemplateIds ?? []), value]),
                  ),
                },
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Link intake template" />
            </SelectTrigger>
            <SelectContent>
              {intakeTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {(competencyTargets.relatedIntakeTemplateIds ?? []).map((templateId) => (
              <Badge key={templateId} variant="outline" className="gap-1">
                {intakeTemplates.find((template) => template.id === templateId)?.name ?? templateId}
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        competencyTargets: {
                          ...competencyTargets,
                          relatedIntakeTemplateIds: (competencyTargets.relatedIntakeTemplateIds ?? []).filter(
                            (value) => value !== templateId,
                          ),
                        },
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Required Part Numbers</Label>
        <div className="flex gap-2">
          <Input
            value={partNumberInput}
            onChange={(event) => setPartNumberInput(event.target.value)}
            placeholder="e.g. 1492A-N57"
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addPartNumber();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" disabled={disabled} onClick={addPartNumber}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {partNumbers.map((partNumber) => (
            <Badge key={partNumber} variant="secondary" className="gap-1">
              {partNumber}
              {!disabled ? (
                <button type="button" onClick={() => removePartNumber(partNumber)}>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Device Families</Label>
        <div className="flex gap-2">
          <Input
            value={deviceFamilyInput}
            onChange={(event) => setDeviceFamilyInput(event.target.value)}
            placeholder="e.g. Terminal Blocks"
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDeviceFamily();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" disabled={disabled} onClick={addDeviceFamily}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {competencyTargets.deviceFamilies.map((deviceFamily) => (
            <Badge key={deviceFamily} variant="outline" className="gap-1">
              {deviceFamily}
              {!disabled ? (
                <button type="button" onClick={() => removeDeviceFamily(deviceFamily)}>
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <Label className="text-xs">Training Trigger & Review Rules</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(trainingTriggerRules.autoAssignOnMissingCompetency)}
            disabled={disabled}
            onChange={(event) =>
              update({
                trainingTriggerRules: {
                  ...trainingTriggerRules,
                  autoAssignOnMissingCompetency: event.target.checked,
                },
              })
            }
          />
          Auto-assign this training when competency is missing
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(progressTracking.requireAssessment)}
            disabled={disabled}
            onChange={(event) =>
              update({
                progressTracking: {
                  ...progressTracking,
                  requireAssessment: event.target.checked,
                },
              })
            }
          />
          Require assessment before completion
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(progressTracking.requireLeadReview)}
            disabled={disabled}
            onChange={(event) =>
              update({
                progressTracking: {
                  ...progressTracking,
                  requireLeadReview: event.target.checked,
                },
              })
            }
          />
          Require lead review / sign-off
        </label>
      </div>
    </div>
  );
}
