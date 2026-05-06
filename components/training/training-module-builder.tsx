"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangle,
    BadgeCheck,
    CheckSquare,
    ChevronRight,
    Cpu,
    Eye,
    EyeOff,
    FileEdit,
    FileText,
    GripVertical,
    Image,
    Images,
    Loader2,
    Package,
    PanelRight,
    PanelRightClose,
    Save,
    Trash2,
    Video,
    Wrench,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProfileCoverImageUploader } from "@/components/profile/profile-cover-image-uploader";
import { SectionPalette } from "@/components/training/section-palette";
import { StageTabs } from "@/components/training/stage-tabs";
import { TrainingPreview } from "@/components/training/training-preview";
import {
    ChecklistEditor,
    CompetencyEditor,
    DetailsEditor,
    DosAndDontsEditor,
    HardwareEditor,
    PhotosEditor,
    RelatedDevicesEditor,
    ToolsEditor,
} from "@/components/training/editors";
import {
    SECTION_TYPE_INFO,
    createEmptySection,
    createEmptyTrainingModuleV2,
    type TrainingModuleV2,
    type TrainingSection,
    type TrainingSectionType,
    type TrainingStage,
} from "@/types/training";
import { USER_ROLE_LABELS, type UserRole } from "@/types/d380-user-session";
import type { SwsTemplateRecord } from "@/types/sws-library";

interface TrainingModuleBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    initialModule?: TrainingModuleV2 | null;
    onSave: (module: TrainingModuleV2) => Promise<void> | void;
}

const ALL_ROLES: UserRole[] = [
    "DEVELOPER",
    "MANAGER",
    "SUPERVISOR",
    "TEAM_LEAD",
    "QA",
    "BRANDER",
    "ASSEMBLER",
];

const SECTION_ICONS: Record<TrainingSectionType, React.ComponentType<{ className?: string }>> = {
    details: FileText,
    "cover-image": Image,
    photos: Images,
    "required-tools": Wrench,
    "related-devices": Cpu,
    "required-hardware": Package,
    "dos-and-donts": AlertTriangle,
    video: Video,
    checklist: CheckSquare,
    custom: FileEdit,
};

function createDefaultModule(): TrainingModuleV2 {
    return createEmptyTrainingModuleV2(`training-${Date.now()}`, "Untitled Training");
}

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const fetcher = (url: string) => fetch(url).then((response) => response.json());

function normalizeModule(module: TrainingModuleV2): TrainingModuleV2 {
    const normalizedSections = (module.sections || []).map((section, index) => ({
        ...section,
        id: section.id || `section-${index}-${section.type || "custom"}`,
        visible: section.visible ?? true,
        stage: section.stage ?? null,
        order: Number.isFinite(section.order) ? section.order : index,
    }));

    return {
        ...module,
        name: module.name || "Untitled Training",
        slug: module.slug || slugify(module.name || "untitled-training"),
        coverImage: {
            imageUrl: module.coverImage?.imageUrl || "",
            alt: module.coverImage?.alt || "",
            caption: module.coverImage?.caption || "",
        },
        visibility: module.visibility || "everyone",
        visibleRoles: module.visibleRoles && module.visibleRoles.length > 0 ? module.visibleRoles : ALL_ROLES,
        sections: normalizedSections,
        enabledStages: module.enabledStages || [],
        swsTemplateIds: module.swsTemplateIds || [],
        competencyTargets: {
            stages: module.competencyTargets?.stages || [],
            partNumbers: module.competencyTargets?.partNumbers || [],
            deviceFamilies: module.competencyTargets?.deviceFamilies || [],
            qualificationLevel: module.competencyTargets?.qualificationLevel || "trainee",
            relatedIntakeTemplateIds: module.competencyTargets?.relatedIntakeTemplateIds || [],
        },
        trainingTriggerRules: {
            requiredForStages: module.trainingTriggerRules?.requiredForStages || [],
            requiredForPartNumbers: module.trainingTriggerRules?.requiredForPartNumbers || [],
            autoAssignOnMissingCompetency: Boolean(module.trainingTriggerRules?.autoAssignOnMissingCompetency),
        },
        progressTracking: {
            requireAssessment: Boolean(module.progressTracking?.requireAssessment),
            requireLeadReview: Boolean(module.progressTracking?.requireLeadReview),
            milestoneLabels: module.progressTracking?.milestoneLabels || [],
        },
    };
}

export function TrainingModuleBuilder({
    isOpen,
    onClose,
    initialModule,
    onSave,
}: TrainingModuleBuilderProps) {
    const [mounted, setMounted] = useState(false);
    const [module, setModule] = useState<TrainingModuleV2>(() =>
        normalizeModule(initialModule || createDefaultModule())
    );
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
    const [activeStage, setActiveStage] = useState<TrainingStage | null>(null);
    const [showPreview, setShowPreview] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingCover, setIsEditingCover] = useState(false);
    const { data: swsPayload } = useSWR<{ templates: SwsTemplateRecord[] }>("/api/sws/templates", fetcher);
    const swsTemplates = swsPayload?.templates ?? [];

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const nextModule = normalizeModule(initialModule || createDefaultModule());
        setModule(nextModule);
        setSelectedSectionId(nextModule.sections[0]?.id || null);
        setExpandedSectionIds(nextModule.sections[0]?.id ? [nextModule.sections[0].id] : []);
        setActiveStage(null);
    }, [initialModule, isOpen]);

    const handleAddSection = (type: TrainingSectionType, stage?: TrainingStage) => {
        const order = module.sections.filter((s) => (stage ?? null) === (s.stage ?? null)).length;
        const newSection = createEmptySection(type, order, stage);

        setModule((prev) => ({
            ...prev,
            sections: [...prev.sections, newSection],
        }));
        setSelectedSectionId(newSection.id);
        setExpandedSectionIds((prev) => (prev.includes(newSection.id) ? prev : [...prev, newSection.id]));
    };

    const handleUpdateSection = (sectionId: string, updates: Partial<TrainingSection>) => {
        setModule((prev) => ({
            ...prev,
            sections: prev.sections.map((section) =>
                section.id === sectionId ? { ...section, ...updates } : section
            ),
        }));
    };

    const handleUpdateSectionContent = (sectionId: string, content: TrainingSection["content"]) => {
        setModule((prev) => ({
            ...prev,
            sections: prev.sections.map((section) =>
                section.id === sectionId ? { ...section, content } : section
            ),
        }));
    };

    const handleToggleSectionVisibility = (sectionId: string) => {
        setModule((prev) => ({
            ...prev,
            sections: prev.sections.map((section) =>
                section.id === sectionId ? { ...section, visible: !section.visible } : section
            ),
        }));
    };

    const handleRemoveSection = (sectionId: string) => {
        setModule((prev) => ({
            ...prev,
            sections: prev.sections
                .filter((section) => section.id !== sectionId)
                .map((section, index) => ({ ...section, order: index })),
        }));
        setExpandedSectionIds((prev) => prev.filter((id) => id !== sectionId));

        if (selectedSectionId === sectionId) {
            setSelectedSectionId(null);
        }
    };

    const handleCoverImageChange = (file: File) => {
        if (!file.type.startsWith("image/")) {
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            setModule((prev) => ({
                ...prev,
                coverImage: {
                    imageUrl: dataUrl,
                    alt: prev.coverImage?.alt || "",
                    caption: prev.coverImage?.caption || "",
                },
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const now = new Date().toISOString();
            const normalized = normalizeModule(module);
            await onSave({
                ...normalized,
                slug: slugify(normalized.name || "untitled-training"),
                updatedAt: now,
            });
            onClose();
        } catch (error) {
            console.error("Failed to save training module:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredSections = module.sections
        .filter((section) => (activeStage === null ? section.stage === null : section.stage === activeStage))
        .sort((a, b) => a.order - b.order);

    const toggleSectionExpanded = (sectionId: string) => {
        setExpandedSectionIds((prev) =>
            prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
        );
        setSelectedSectionId(sectionId);
    };

    const renderSectionEditor = (section: TrainingSection) => {
        const content = section.content;

        switch (section.type) {
            case "details":
                return (
                    <DetailsEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "cover-image":
                return (
                    <div className="rounded-md border border-amber-300/50 bg-amber-50/40 p-3 text-xs text-amber-800">
                        Cover image now lives in Training Details at the top of the builder.
                    </div>
                );
            case "photos":
                return (
                    <PhotosEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "required-tools":
                return (
                    <ToolsEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "required-hardware":
                return (
                    <HardwareEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "related-devices":
                return (
                    <RelatedDevicesEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "dos-and-donts":
                return (
                    <DosAndDontsEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "checklist":
                return (
                    <ChecklistEditor
                        content={content as any}
                        onChange={(c) => handleUpdateSectionContent(section.id, c)}
                    />
                );
            case "custom":
                return (
                    <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                            value={(content as any).markdown || ""}
                            onChange={(e) => handleUpdateSectionContent(section.id, { markdown: e.target.value } as any)}
                            placeholder="Enter your content..."
                            rows={8}
                        />
                    </div>
                );
            default:
                return <p className="text-muted-foreground">Unknown section type</p>;
        }
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-background"
                >
                    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="h-5 w-5" />
                            </Button>
                            <div>
                                <Input
                                    value={module.name}
                                    onChange={(e) => setModule((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Training Module Name"
                                    className="h-8 text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPreview(!showPreview)}
                                className="gap-2"
                            >
                                {showPreview ? (
                                    <>
                                        <PanelRightClose className="h-4 w-4" />
                                        Hide Preview
                                    </>
                                ) : (
                                    <>
                                        <PanelRight className="h-4 w-4" />
                                        Show Preview
                                    </>
                                )}
                            </Button>
                            <Select
                                value={module.status}
                                onValueChange={(value: "draft" | "published" | "archived") =>
                                    setModule((prev) => ({ ...prev, status: value }))
                                }
                            >
                                <SelectTrigger className="w-28 h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-1" />
                                )}
                                Save
                            </Button>
                        </div>
                    </header>

                    <div className="flex h-[calc(100vh-3.5rem)]">
                        <div className={cn("flex flex-col border-r overflow-hidden", showPreview ? "w-1/2" : "w-full")}>
                            <ScrollArea className="flex-1">
                                <div className="p-4 border-b space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Difficulty</Label>
                                            <Select
                                                value={module.difficulty}
                                                onValueChange={(value: "beginner" | "intermediate" | "advanced") =>
                                                    setModule((prev) => ({ ...prev, difficulty: value }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="beginner">Beginner</SelectItem>
                                                    <SelectItem value="intermediate">Intermediate</SelectItem>
                                                    <SelectItem value="advanced">Advanced</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Estimated Time (min)</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={module.totalEstimatedMinutes || ""}
                                                onChange={(e) =>
                                                    setModule((prev) => ({
                                                        ...prev,
                                                        totalEstimatedMinutes: parseInt(e.target.value, 10) || undefined,
                                                    }))
                                                }
                                                placeholder="30"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-3 space-y-2">
                                            <Label>Cover Image</Label>
                                            <div className="relative overflow-hidden rounded-lg border bg-muted/20">
                                                {module.coverImage?.imageUrl ? (
                                                    <img
                                                        src={module.coverImage.imageUrl}
                                                        alt={module.coverImage.alt || "Training cover"}
                                                        className="h-40 w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                                        No cover image selected
                                                    </div>
                                                )}

                                                <ProfileCoverImageUploader
                                                    onImageChange={handleCoverImageChange}
                                                    onRemove={() =>
                                                        setModule((prev) => ({
                                                            ...prev,
                                                            coverImage: {
                                                                imageUrl: "",
                                                                alt: prev.coverImage?.alt || "",
                                                                caption: prev.coverImage?.caption || "",
                                                            },
                                                        }))
                                                    }
                                                    isOpen={isEditingCover}
                                                    onOpenChange={setIsEditingCover}
                                                    className="right-2 top-2"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Cover Alt Text</Label>
                                            <Input
                                                value={module.coverImage?.alt || ""}
                                                onChange={(e) =>
                                                    setModule((prev) => ({
                                                        ...prev,
                                                        coverImage: {
                                                            imageUrl: prev.coverImage?.imageUrl || "",
                                                            alt: e.target.value,
                                                            caption: prev.coverImage?.caption || "",
                                                        },
                                                    }))
                                                }
                                                placeholder="Describe the image"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>Cover Caption</Label>
                                            <Input
                                                value={module.coverImage?.caption || ""}
                                                onChange={(e) =>
                                                    setModule((prev) => ({
                                                        ...prev,
                                                        coverImage: {
                                                            imageUrl: prev.coverImage?.imageUrl || "",
                                                            alt: prev.coverImage?.alt || "",
                                                            caption: e.target.value,
                                                        },
                                                    }))
                                                }
                                                placeholder="Optional caption"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={module.description || ""}
                                            onChange={(e) => setModule((prev) => ({ ...prev, description: e.target.value }))}
                                            placeholder="Brief description of this training..."
                                            rows={2}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Linked SWS Templates</Label>
                                        <Select
                                            value=""
                                            onValueChange={(value) => {
                                                if (!value) return;
                                                setModule((prev) => ({
                                                    ...prev,
                                                    swsTemplateIds: Array.from(new Set([...(prev.swsTemplateIds ?? []), value])),
                                                }));
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Link reusable SWS template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {swsTemplates.map((template) => (
                                                    <SelectItem key={template.id} value={template.id}>
                                                        {template.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2">
                                            {(module.swsTemplateIds ?? []).map((templateId) => {
                                                const templateName = swsTemplates.find((template) => template.id === templateId)?.name ?? templateId;
                                                return (
                                                    <button
                                                        key={templateId}
                                                        type="button"
                                                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                                                        onClick={() =>
                                                            setModule((prev) => ({
                                                                ...prev,
                                                                swsTemplateIds: (prev.swsTemplateIds ?? []).filter((id) => id !== templateId),
                                                            }))
                                                        }
                                                    >
                                                        {templateName}
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                );
                                            })}
                                            {(module.swsTemplateIds?.length ?? 0) === 0 ? (
                                                <p className="text-xs text-muted-foreground">
                                                    Link one or more reusable SWS templates so this training stays connected to the SWS library.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    <CompetencyEditor
                                        competencyTargets={module.competencyTargets ?? {
                                            stages: [],
                                            partNumbers: [],
                                            deviceFamilies: [],
                                            qualificationLevel: "trainee",
                                            relatedIntakeTemplateIds: [],
                                        }}
                                        trainingTriggerRules={module.trainingTriggerRules ?? {
                                            requiredForStages: [],
                                            requiredForPartNumbers: [],
                                            autoAssignOnMissingCompetency: false,
                                        }}
                                        progressTracking={module.progressTracking ?? {
                                            requireAssessment: false,
                                            requireLeadReview: false,
                                            milestoneLabels: [],
                                        }}
                                        partNumbers={module.partNumbers ?? []}
                                        swsTemplates={swsTemplates}
                                        onChange={(updates) =>
                                            setModule((prev) => ({
                                                ...prev,
                                                competencyTargets: updates.competencyTargets,
                                                trainingTriggerRules: updates.trainingTriggerRules,
                                                progressTracking: updates.progressTracking,
                                                partNumbers: updates.partNumbers,
                                            }))
                                        }
                                    />

                                    <div className="space-y-2">
                                        <Label>Visibility</Label>
                                        <Select
                                            value={module.visibility || "everyone"}
                                            onValueChange={(value: "everyone" | "restricted") =>
                                                setModule((prev) => ({
                                                    ...prev,
                                                    visibility: value,
                                                    visibleRoles:
                                                        value === "restricted"
                                                            ? prev.visibleRoles && prev.visibleRoles.length > 0
                                                                ? prev.visibleRoles
                                                                : ["DEVELOPER"]
                                                            : ALL_ROLES,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="everyone">Everyone</SelectItem>
                                                <SelectItem value="restricted">Restricted by role</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {module.visibility === "restricted" && (
                                        <div className="space-y-2 rounded-lg border p-3">
                                            <Label className="text-xs">Allowed Roles</Label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {ALL_ROLES.map((role) => {
                                                    const checked = (module.visibleRoles || []).includes(role);
                                                    return (
                                                        <label
                                                            key={role}
                                                            className="flex items-center gap-2 rounded border px-2 py-1 text-xs cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(event) => {
                                                                    setModule((prev) => {
                                                                        const current = new Set(prev.visibleRoles || []);
                                                                        if (event.target.checked) current.add(role);
                                                                        else current.delete(role);
                                                                        const next = Array.from(current);
                                                                        return {
                                                                            ...prev,
                                                                            visibleRoles: next.length > 0 ? next : [role],
                                                                        };
                                                                    });
                                                                }}
                                                            />
                                                            <span>{USER_ROLE_LABELS[role]}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 pt-4">
                                    <StageTabs
                                        activeStage={activeStage}
                                        onStageChange={setActiveStage}
                                        enabledStages={module.enabledStages}
                                        onEnabledStagesChange={(stages) =>
                                            setModule((prev) => ({ ...prev, enabledStages: stages }))
                                        }
                                        sections={module.sections}
                                    />
                                </div>

                                <div className="space-y-2 px-3 pb-4 md:px-4">
                                    <AnimatePresence initial={false}>
                                        {filteredSections.map((section, index) => {
                                        const Icon = SECTION_ICONS[section.type];
                                        const info = SECTION_TYPE_INFO[section.type];
                                        const isExpanded = expandedSectionIds.includes(section.id);

                                        return (
                                            <motion.div
                                                key={section.id}
                                                layout
                                                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                                transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.7, delay: index * 0.02 }}
                                            >
                                                <Card
                                                    className={cn(
                                                        "transition-all",
                                                        selectedSectionId === section.id && "ring-2 ring-primary",
                                                        !section.visible && "opacity-65"
                                                    )}
                                                >
                                                <CardHeader
                                                    className="p-3 cursor-pointer"
                                                    onClick={() => toggleSectionExpanded(section.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                                        <div className="p-1.5 bg-muted rounded">
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <CardTitle className="text-sm font-medium truncate mb-1">
                                                                {section.title || info.label}
                                                            </CardTitle>
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                    {info.label}
                                                                </span>
                                                                {section.visible ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                                                        <BadgeCheck className="h-2.5 w-2.5" />
                                                                        Visible
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                                                        Hidden
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleSectionVisibility(section.id);
                                                                }}
                                                            >
                                                                {section.visible ? (
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <EyeOff className="h-3.5 w-3.5" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveSection(section.id);
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <motion.div
                                                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                                                transition={{ type: "spring", stiffness: 340, damping: 24 }}
                                                            >
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <AnimatePresence initial={false}>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ type: "spring", stiffness: 240, damping: 24 }}
                                                            style={{ overflow: "hidden" }}
                                                        >
                                                            <CardContent className="pt-0 pb-3 px-3">
                                                                <Separator className="mb-3" />
                                                                <div className="space-y-3">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-xs">Section Title</Label>
                                                                        <Input
                                                                            value={section.title || ""}
                                                                            onChange={(e) =>
                                                                                handleUpdateSection(section.id, { title: e.target.value })
                                                                            }
                                                                            placeholder={info.defaultTitle}
                                                                            className="h-8"
                                                                        />
                                                                    </div>
                                                                    {renderSectionEditor(section)}
                                                                </div>
                                                            </CardContent>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                    </AnimatePresence>

                                    {filteredSections.length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                            <p className="text-muted-foreground mb-3">
                                                No sections in {activeStage ? "this stage" : "overview"}
                                            </p>
                                            <SectionPalette
                                                onAddSection={handleAddSection}
                                                currentStage={activeStage}
                                            />
                                        </div>
                                    )}

                                    {filteredSections.length > 0 && (
                                        <div className="border-t pt-4">
                                            <SectionPalette
                                                onAddSection={handleAddSection}
                                                currentStage={activeStage}
                                            />
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {showPreview && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "50%", opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="bg-muted/30 overflow-hidden"
                            >
                                <div className="h-full flex flex-col">
                                    <div className="p-3 border-b bg-background flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Live Preview</span>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <TrainingPreview
                                            module={module}
                                            highlightedSectionId={selectedSectionId || undefined}
                                        />
                                    </ScrollArea>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
