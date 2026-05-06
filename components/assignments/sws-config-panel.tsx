"use client";

import { useState } from "react";
import {
    Settings2,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    Save,
    RotateCcw,
    FileCheck,
    FileX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAssignmentSwsConfig } from "@/hooks/use-assignment-sws-config";
import { ExportReviewCard } from "@/components/assignments/export-review-card";
import type { SwsTemplateId } from "@/types/d380-sws";
import type {
    SwsSectionOverride,
    ExportReviewEntry,
    SwsReviewStatus,
} from "@/types/d380-assignment-sws";

// ============================================================================
// Props
// ============================================================================

interface SwsConfigPanelProps {
    projectId: string;
    sheetSlug: string;
    /** Section IDs available in the template for overrides */
    sectionIds?: string[];
}

// ============================================================================
// Template options
// ============================================================================

const TEMPLATE_OPTIONS: { id: SwsTemplateId; label: string }[] = [
    { id: "PANEL_BUILD_WIRE", label: "Panel Build & Wire" },
    { id: "PANEL_BUILD_WIRE", label: "Digital Panel Build & Wire" },
    { id: "BASIC_BLANK_PANEL", label: "Basic Blank Panel" },
    { id: "BOX_BUILD_UP", label: "Box Build Up" },
    { id: "BOX_CROSS_WIRE", label: "Box Cross Wire" },
    { id: "CONSOLE_BUILD_UP_PANEL_HANG", label: "Console Build Up & Panel Hang" },
    { id: "CONSOLE_CROSS_WIRE", label: "Console Cross Wire" },
];

const REVIEW_STATUS_OPTIONS: { id: SwsReviewStatus; label: string; color: string }[] = [
    { id: "pending", label: "Pending", color: "text-amber-600" },
    { id: "reviewed", label: "Reviewed", color: "text-blue-600" },
    { id: "finalized", label: "Finalized", color: "text-emerald-600" },
];

// ============================================================================
// Component
// ============================================================================

export function SwsConfigPanel({
    projectId,
    sheetSlug,
    sectionIds = [],
}: SwsConfigPanelProps) {
    const sws = useAssignmentSwsConfig({ projectId, sheetSlug });
    const [sectionsOpen, setSectionsOpen] = useState(false);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-4 pt-4 pb-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        SWS Configuration
                    </h3>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => sws.reload()}
                            title="Reload"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant={sws.isDirty ? "default" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => sws.save()}
                            disabled={!sws.isDirty}
                            title="Save"
                        >
                            <Save className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                {sws.isDirty && (
                    <Badge variant="outline" className="text-[10px] mt-1 text-amber-600 border-amber-300">
                        Unsaved changes
                    </Badge>
                )}
            </div>

            <Separator />

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {/* Template selector */}
                    <div className="space-y-2">
                        <Label className="text-xs">SWS Template</Label>
                        <Select
                            value={sws.config.templateId}
                            onValueChange={(v) => sws.setTemplateId(v)}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TEMPLATE_OPTIONS.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Manual override toggle */}
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Manual Override</Label>
                        <Switch
                            checked={sws.config.isManualOverride}
                            onCheckedChange={sws.setManualOverride}
                        />
                    </div>

                    {/* Review status */}
                    <div className="space-y-2">
                        <Label className="text-xs">Review Status</Label>
                        <Select
                            value={sws.config.reviewStatus}
                            onValueChange={(v) =>
                                sws.setReviewStatus(v as SwsReviewStatus)
                            }
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {REVIEW_STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        <span className={s.color}>{s.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator />

                    {/* Section overrides */}
                    {sectionIds.length > 0 && (
                        <Collapsible open={sectionsOpen} onOpenChange={setSectionsOpen}>
                            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold w-full py-1">
                                {sectionsOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                Section Overrides ({sectionIds.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-3 pt-2">
                                {sectionIds.map((sectionId) => {
                                    const override =
                                        sws.config.sectionOverrides[sectionId] ?? {};
                                    return (
                                        <SectionOverrideEditor
                                            key={sectionId}
                                            sectionId={sectionId}
                                            override={override}
                                            onChange={(patch) =>
                                                sws.setSectionOverride(sectionId, patch)
                                            }
                                        />
                                    );
                                })}
                            </CollapsibleContent>
                        </Collapsible>
                    )}

                    <Separator />

                    {/* Export Reviews */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground">
                            Export Reviews
                        </h4>
                        <ExportReviewCard
                            exportType="wire_list"
                            review={sws.config.exportReviews.find(
                                (r) => r.exportType === "wire_list",
                            )}
                            onUpdate={(review) => sws.upsertExportReview(review)}
                            onRemove={() => sws.removeExportReview("wire_list")}
                        />
                        <ExportReviewCard
                            exportType="branding_list"
                            review={sws.config.exportReviews.find(
                                (r) => r.exportType === "branding_list",
                            )}
                            onUpdate={(review) => sws.upsertExportReview(review)}
                            onRemove={() => sws.removeExportReview("branding_list")}
                        />
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

// ============================================================================
// Section Override Editor
// ============================================================================

function SectionOverrideEditor({
    sectionId,
    override,
    onChange,
}: {
    sectionId: string;
    override: Partial<SwsSectionOverride>;
    onChange: (patch: Partial<SwsSectionOverride>) => void;
}) {
    return (
        <div className="rounded-md border bg-card/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{sectionId}</span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onChange({ hidden: !override.hidden })}
                    title={override.hidden ? "Show section" : "Hide section"}
                >
                    {override.hidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                        <Eye className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>

            {!override.hidden && (
                <>
                    <div className="space-y-1">
                        <Label className="text-[10px]">Cycle Time Override</Label>
                        <Input
                            className="h-7 text-xs"
                            placeholder="H:MM"
                            value={override.cycleTimeOverride ?? ""}
                            onChange={(e) =>
                                onChange({ cycleTimeOverride: e.target.value || undefined })
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px]">Notes</Label>
                        <Textarea
                            className="text-xs min-h-[48px]"
                            placeholder="Section notes..."
                            value={override.notes ?? ""}
                            onChange={(e) =>
                                onChange({ notes: e.target.value || undefined })
                            }
                            rows={2}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
