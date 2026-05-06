"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Trash2,
    Package,
    ChevronRight,
    Link2,
} from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DynamicDetailsForm } from "./dynamic-details-form";
import { TrainingStepsViewer } from "./training-steps-viewer";
import { DetailsTemplatePicker } from "./template-picker";
import { TerminalSchemaEditor } from "./terminal-schema-editor";
import { GenericPartDetailsEditor } from "./generic-part-details-editor";
import { PartNumberSubheader } from "./part-number-subheader";
import { PartStacksDialog } from "./part-stacks-dialog";
import { buildPartFamilies } from "@/lib/parts/part-families";
import { getPartDisplayTitle } from "@/lib/parts/normalize-part-title";
import type {
    PartRecord,
    PartCategory,
    DetailSchema,
} from "@/types/parts-library";
import { PART_CATEGORY_INFO, DEFAULT_PART_TYPES } from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface PartDetailAsideProps {
    part: PartRecord;
    onClose: () => void;
    onUpdate?: (part: PartRecord) => void;
    onDelete?: () => void;
    canEdit?: boolean;
}

export function PartDetailAside({
    part: initialPart,
    onClose,
    onUpdate,
    onDelete,
    canEdit = true,
}: PartDetailAsideProps) {
    const params = useParams<{ badgeNumber: string }>();
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState("basic");
    const [editedPart, setEditedPart] = useState<PartRecord>(initialPart);
    const [isSaving, setIsSaving] = useState(false);
    const [isStacksOpen, setIsStacksOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = {
        basic: useRef<HTMLDivElement | null>(null),
        details: useRef<HTMLDivElement | null>(null),
        install: useRef<HTMLDivElement | null>(null),
    };
    
    // Fetch schema for the part's category/type
    const { data: schemaData } = useSWR<{ schema: DetailSchema }>(
        `/api/parts/${editedPart.category}/${editedPart.type}?schema=true`,
        fetcher
    );
    const { data: familySearchData } = useSWR<{ parts: PartRecord[] }>(
        `/api/parts?category=${encodeURIComponent(editedPart.category)}&type=${encodeURIComponent(editedPart.type)}&limit=500`,
        fetcher
    );
    
    const schema = schemaData?.schema;
    const filteredSchema = schema ? getApplicableDetailSchema(schema, editedPart) : undefined;
    const partFamily = useMemo(() => {
        const peers = familySearchData?.parts ?? [];
        return buildPartFamilies(peers).find((family) =>
            family.parts.some((part) => part.partNumber === editedPart.partNumber),
        ) ?? null;
    }, [editedPart.partNumber, familySearchData?.parts]);
    
    // Reset edited part when initial part changes
    useEffect(() => {
        setEditedPart(initialPart);
    }, [initialPart]);

    useEffect(() => {
        if (canEdit && activeTab === "details" && !isEditing) {
            setIsEditing(true);
        }
    }, [activeTab, canEdit, isEditing]);

    const sections = useMemo(
        () => [
            { id: "basic", label: "Basic", ref: sectionRefs.basic },
            { id: "details", label: "Details", ref: sectionRefs.details },
            { id: "install", label: "Install", ref: sectionRefs.install },
        ],
        [sectionRefs.basic, sectionRefs.details, sectionRefs.install],
    );

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const currentTop = container.scrollTop + 120;
            let nextActive = "basic";
            for (const section of sections) {
                const node = section.ref.current;
                if (!node) continue;
                if (node.offsetTop <= currentTop) {
                    nextActive = section.id;
                }
            }
            setActiveTab((prev) => (prev === nextActive ? prev : nextActive));
        };

        handleScroll();
        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [sections]);

    const scrollToSection = (sectionId: string) => {
        const container = scrollContainerRef.current;
        const target = sectionRefs[sectionId as keyof typeof sectionRefs].current;
        if (!container || !target) return;
        container.scrollTo({
            top: Math.max(target.offsetTop - 84, 0),
            behavior: "smooth",
        });
        setActiveTab(sectionId);
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(
                `/api/parts/${editedPart.category}/${editedPart.type}/${encodeURIComponent(editedPart.partNumber)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editedPart),
                }
            );
            
            if (res.ok) {
                const { part } = await res.json();
                setIsEditing(false);
                onUpdate?.(part);
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        const res = await fetch(
            `/api/parts/${editedPart.category}/${editedPart.type}/${encodeURIComponent(editedPart.partNumber)}`,
            { method: 'DELETE' }
        );
        
        if (res.ok) {
            onDelete?.();
            onClose();
        }
    };
    
    const handleCancel = () => {
        setEditedPart(initialPart);
        setIsEditing(false);
    };
    
    // Available types for the selected category
    const availableTypes = DEFAULT_PART_TYPES[editedPart.category] ?? [];
    const displayTitle = getPartDisplayTitle(editedPart);
    
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 p-4 pb-3">
                <PartNumberSubheader
                    part={editedPart}
                    familyName={partFamily?.familyName}
                    variantOptions={partFamily?.variants}
                    activeVariantPartNumber={editedPart.partNumber}
                    onSelectVariant={(partNumber) => {
                        const nextPart = partFamily?.parts.find((part) => part.partNumber === partNumber);
                        if (!nextPart) return;
                        setEditedPart(nextPart);
                        onUpdate?.(nextPart);
                    }}
                    isEditing={isEditing}
                    canEdit={canEdit}
                    onEdit={() => setIsEditing(true)}
                    onSave={() => void handleSave()}
                    onCancel={handleCancel}
                    onOpenStacks={() => setIsStacksOpen(true)}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{PART_CATEGORY_INFO[editedPart.category]?.label}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{editedPart.type.replace(/-/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit ? (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const params = new URLSearchParams();
                                        params.set("tab", "operations");
                                        params.set("targetType", "part-number");
                                        params.set("targetId", editedPart.partNumber);
                                        params.set("targetLabel", `${editedPart.partNumber} · ${displayTitle}`);
                                        router.push(`/profile/${params.badgeNumber}/sws?${params.toString()}`);
                                    }}
                                >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    SWS
                                </Button>
                                {partFamily ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const nextParams = new URLSearchParams();
                                            nextParams.set("tab", "operations");
                                            nextParams.set("targetType", "part-family");
                                            nextParams.set("targetId", partFamily.id);
                                            nextParams.set("targetLabel", partFamily.familyName);
                                            router.push(`/profile/${params.badgeNumber}/sws?${nextParams.toString()}`);
                                        }}
                                    >
                                        <Link2 className="mr-2 h-4 w-4" />
                                        Family SWS
                                    </Button>
                                ) : null}
                                <PartStacksDialog
                                    open={isStacksOpen}
                                    onOpenChange={setIsStacksOpen}
                                    trigger={
                                        <Button variant="outline" size="sm">
                                            <Package className="mr-2 h-4 w-4" />
                                            Stacks
                                        </Button>
                                    }
                                />
                            </div>
                        ) : null}
                        {!isEditing && canEdit ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Part?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete part {editedPart.partNumber}.
                                            This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : null}
                    </div>
                </div>
            </div>
            
            <Separator />
            
            {/* Content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                <div className="p-4">
                    <div className="sticky top-0 z-10 mb-4 rounded-2xl bg-background/95 pb-3 pt-1 backdrop-blur">
                        <div className="grid w-full grid-cols-3 rounded-full bg-muted p-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => scrollToSection(section.id)}
                                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                                        activeTab === section.id
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {section.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <section ref={sectionRefs.basic} id="basic" className="scroll-mt-24 space-y-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold">Basic</h4>
                                <p className="text-xs text-muted-foreground">
                                    Core product identity and shared metadata for {displayTitle}.
                                </p>
                            </div>
                            {isEditing ? (
                                <BasicInfoEdit
                                    part={editedPart}
                                    onChange={setEditedPart}
                                    availableTypes={availableTypes}
                                />
                            ) : (
                                <BasicInfoView part={editedPart} />
                            )}
                        </section>

                        <section ref={sectionRefs.details} id="details" className="scroll-mt-24 space-y-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold">Details</h4>
                                <p className="text-xs text-muted-foreground">
                                    Terminal intelligence, configurable fields, and normalized product attributes.
                                </p>
                            </div>
                            {schema ? (
                                <div className="space-y-4">
                                    {shouldShowTerminalEditor(editedPart) ? (
                                        <TerminalSchemaEditor
                                            value={editedPart.terminalSchema}
                                            onChange={(terminalSchema) => setEditedPart({ ...editedPart, terminalSchema })}
                                            disabled={!canEdit}
                                        />
                                    ) : null}
                                    {canEdit && (
                                        <div className="flex justify-end">
                                            <DetailsTemplatePicker
                                                category={editedPart.category}
                                                type={editedPart.type}
                                                currentValues={editedPart.details}
                                                schemaId={schema.id}
                                                onApplyTemplate={(values, templateId) => {
                                                    setEditedPart({
                                                        ...editedPart,
                                                        details: { ...editedPart.details, ...values },
                                                        detailsTemplateId: templateId,
                                                    });
                                                }}
                                            />
                                        </div>
                                    )}
                                    <DynamicDetailsForm
                                        schema={filteredSchema ?? schema}
                                        values={editedPart.details ?? {}}
                                        onChange={(details) => setEditedPart({ ...editedPart, details })}
                                        disabled={!canEdit}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {shouldShowTerminalEditor(editedPart) ? (
                                        <TerminalSchemaEditor
                                            value={editedPart.terminalSchema}
                                            onChange={(terminalSchema) => setEditedPart({ ...editedPart, terminalSchema })}
                                            disabled={!canEdit}
                                        />
                                    ) : null}
                                    <GenericPartDetailsEditor
                                        value={editedPart.details ?? {}}
                                        onChange={(details) => setEditedPart({ ...editedPart, details })}
                                        disabled={!canEdit}
                                    />
                                </div>
                            )}
                        </section>

                        <section ref={sectionRefs.install} id="install" className="scroll-mt-24 space-y-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold">Install</h4>
                                <p className="text-xs text-muted-foreground">
                                    Linked training content and installation guidance for this part.
                                </p>
                            </div>
                            <TrainingStepsViewer partNumber={editedPart.partNumber} />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function shouldShowTerminalEditor(part: PartRecord) {
    return part.category === "devices" || part.category === "terminals" || Boolean(part.terminalSchema?.terminals?.length);
}

function getApplicableDetailSchema(schema: DetailSchema, part: PartRecord): DetailSchema {
    if (part.category !== "terminals") {
        return schema;
    }

    const hiddenKeys = new Set<string>();

    if (["busbars", "din-rail-accessories"].includes(part.type)) {
        ["voltageRating", "currentRating", "operatingTemp", "ipRating", "barrelType", "insulationType", "crimpTool", "crimpDie"].forEach((key) => hiddenKeys.add(key));
    }

    if (["wire-ferrules", "ring-terminals", "fork-terminals", "splice-connectors"].includes(part.type)) {
        ["voltageRating", "currentRating", "operatingTemp", "ipRating"].forEach((key) => hiddenKeys.add(key));
    }

    if (hiddenKeys.size === 0) {
        return schema;
    }

    return {
        ...schema,
        fields: schema.fields.filter((field) => !hiddenKeys.has(field.key)),
        groups: schema.groups.filter((group) =>
            schema.fields.some((field) => field.group === group.key && !hiddenKeys.has(field.key)),
        ),
    };
}

// ============================================================================
// BASIC INFO VIEW
// ============================================================================

function BasicInfoView({ part }: { part: PartRecord }) {
    const displayTitle = getPartDisplayTitle(part);
    return (
        <div className="space-y-4">
            {/* Images */}
            {(part.images?.primary?.src || part.images?.icon?.src) && (
                <div className="flex justify-center p-4 bg-muted/30 rounded-lg">
                    <img
                        src={part.images.primary?.src ?? part.images.icon?.src}
                        alt={part.description}
                        className="max-h-32 object-contain"
                    />
                </div>
            )}
            
            {/* Description */}
            <div>
                <Label className="text-xs text-muted-foreground">Display Title</Label>
                <p className="text-sm mt-1">{displayTitle}</p>
            </div>

            <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm mt-1">{part.description}</p>
            </div>
            
            {/* Manufacturer */}
            {part.manufacturer && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs text-muted-foreground">Manufacturer</Label>
                        <p className="text-sm mt-1">{part.manufacturer}</p>
                    </div>
                    {part.manufacturerPartNumber && (
                        <div>
                            <Label className="text-xs text-muted-foreground">MPN</Label>
                            <p className="text-sm font-mono mt-1">{part.manufacturerPartNumber}</p>
                        </div>
                    )}
                </div>
            )}
            
            {/* Alternate Part Numbers */}
            {part.alternatePartNumbers && part.alternatePartNumbers.length > 0 && (
                <div>
                    <Label className="text-xs text-muted-foreground">Alternate Part Numbers</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {part.alternatePartNumbers.map((pn) => (
                            <Badge key={pn} variant="outline" className="font-mono text-[10px]">
                                {pn}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Associated Parts */}
            {part.associatedParts && part.associatedParts.length > 0 && (
                <div>
                    <Label className="text-xs text-muted-foreground">Associated Parts</Label>
                    <div className="space-y-1.5 mt-1.5">
                        {part.associatedParts.map((ap, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-2 rounded bg-muted/30"
                            >
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-mono text-sm">{ap.partNumber}</span>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                    {ap.operationship}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Tags */}
            {part.tags && part.tags.length > 0 && (
                <div>
                    <Label className="text-xs text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {part.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Metadata */}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                    <span>Source:</span>
                    <span className="ml-1 font-medium">{part.source}</span>
                </div>
                <div>
                    <span>Updated:</span>
                    <span className="ml-1 font-medium">
                        {new Date(part.updatedAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// BASIC INFO EDIT
// ============================================================================

function BasicInfoEdit({
    part,
    onChange,
    availableTypes,
}: {
    part: PartRecord;
    onChange: (part: PartRecord) => void;
    availableTypes: string[];
}) {
    return (
        <div className="space-y-4">
            {/* Category & Type */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs">Category</Label>
                    <Select
                        value={part.category}
                        onValueChange={(value) =>
                            onChange({
                                ...part,
                                category: value as PartCategory,
                                type: DEFAULT_PART_TYPES[value as PartCategory]?.[0] ?? 'uncategorized',
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(PART_CATEGORY_INFO).map(([key, info]) => (
                                <SelectItem key={key} value={key}>
                                    {info.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Type</Label>
                    <Select
                        value={part.type}
                        onValueChange={(value) => onChange({ ...part, type: value })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type.replace(/-/g, ' ')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {/* Description */}
            <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Textarea
                    value={part.description}
                    onChange={(e) => onChange({ ...part, description: e.target.value })}
                    rows={2}
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs">Display Title</Label>
                <Input
                    value={part.displayTitle ?? ""}
                    onChange={(e) => onChange({ ...part, displayTitle: e.target.value || undefined })}
                    placeholder="Normalized product title"
                />
            </div>
            
            {/* Manufacturer */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs">Manufacturer</Label>
                    <Input
                        value={part.manufacturer ?? ''}
                        onChange={(e) => onChange({ ...part, manufacturer: e.target.value || undefined })}
                        placeholder="e.g., Phoenix Contact"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Manufacturer Part Number</Label>
                    <Input
                        value={part.manufacturerPartNumber ?? ''}
                        onChange={(e) =>
                            onChange({ ...part, manufacturerPartNumber: e.target.value || undefined })
                        }
                        placeholder="MPN"
                    />
                </div>
            </div>
            
            {/* Alternate Part Numbers */}
            <div className="space-y-2">
                <Label className="text-xs">Alternate Part Numbers (comma separated)</Label>
                <Input
                    value={part.alternatePartNumbers?.join(', ') ?? ''}
                    onChange={(e) =>
                        onChange({
                            ...part,
                            alternatePartNumbers: e.target.value
                                .split(',')
                                .map(s => s.trim())
                                .filter(Boolean),
                        })
                    }
                    placeholder="e.g., ALT-001, ALT-002"
                />
            </div>
            
            {/* Tags */}
            <div className="space-y-2">
                <Label className="text-xs">Tags (comma separated)</Label>
                <Input
                    value={part.tags?.join(', ') ?? ''}
                    onChange={(e) =>
                        onChange({
                            ...part,
                            tags: e.target.value
                                .split(',')
                                .map(s => s.trim())
                                .filter(Boolean),
                        })
                    }
                    placeholder="e.g., relay, 24v, din-rail"
                />
            </div>
        </div>
    );
}
