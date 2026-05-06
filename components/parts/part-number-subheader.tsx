"use client";

import Image from "next/image";
import { Edit, Layers, Package, Save, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPartDisplayTitle } from "@/lib/parts/normalize-part-title";
import type { PartRecord } from "@/types/parts-library";
import { PART_CATEGORY_INFO } from "@/types/parts-library";

interface PartNumberSubheaderProps {
    part: PartRecord;
    familyName?: string;
    variantOptions?: Array<{ partNumber: string; label: string }>;
    activeVariantPartNumber?: string;
    onSelectVariant?: (partNumber: string) => void;
    isEditing?: boolean;
    canEdit?: boolean;
    onEdit?: () => void;
    onSave?: () => void;
    onCancel?: () => void;
    onOpenStacks?: () => void;
}

export function PartNumberSubheader({
    part,
    familyName,
    variantOptions = [],
    activeVariantPartNumber,
    onSelectVariant,
    isEditing = false,
    canEdit = false,
    onEdit,
    onSave,
    onCancel,
    onOpenStacks,
}: PartNumberSubheaderProps) {
    const coverSrc = part.images?.primary?.src || part.images?.icon?.src || part.photo;
    const categoryLabel = PART_CATEGORY_INFO[part.category]?.label ?? part.category;
    const typeLabel = part.type.replace(/-/g, " ");
    const displayTitle = getPartDisplayTitle(part);

    return (
        <div className="relative overflow-hidden rounded-3xl border bg-card">
            <div className="relative h-36 w-full bg-muted">
                {coverSrc ? (
                    <>
                        <Image
                            src={coverSrc}
                            alt={part.description || part.partNumber}
                            fill
                            className="object-cover object-center"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-white" />
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[11px]">
                                {part.partNumber}
                            </Badge>
                            <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm">
                                {categoryLabel}
                            </Badge>
                            <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm">
                                {typeLabel}
                            </Badge>
                        </div>
                        <h3 className="line-clamp-2 text-xl font-semibold text-white">{displayTitle}</h3>
                        {familyName && familyName !== displayTitle ? (
                            <p className="mt-1 text-sm text-white/80">{familyName}</p>
                        ) : null}
                        {part.manufacturer ? (
                            <p className="mt-1 text-sm text-white/70">{part.manufacturer}</p>
                        ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {onOpenStacks ? (
                            <Button variant="secondary" size="sm" onClick={onOpenStacks}>
                                <Layers className="mr-2 h-4 w-4" />
                                Stacks
                            </Button>
                        ) : null}
                        {canEdit ? (
                            isEditing ? (
                                <>
                                    <Button variant="secondary" size="icon" onClick={onCancel}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" onClick={onSave}>
                                        <Save className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <Button variant="secondary" size="sm" onClick={onEdit}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                            )
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t bg-background/90 px-4 py-3">
                <div className="flex flex-1 flex-wrap gap-2">
                    {part.alternatePartNumbers?.slice(0, 3).map((pn) => (
                        <Badge key={pn} variant="outline" className="font-mono text-[10px]">
                            {pn}
                        </Badge>
                    ))}
                    {part.associatedParts?.length ? (
                        <Badge variant="secondary" className="text-[10px]">
                            <Package className="mr-1 h-3.5 w-3.5" />
                            {part.associatedParts.length} related
                        </Badge>
                    ) : null}
                    {part.terminalSchema?.terminals?.length ? (
                        <Badge variant="secondary" className="text-[10px]">
                            {part.terminalSchema.terminals.length} terminals
                        </Badge>
                    ) : null}
                    {variantOptions.length > 1 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {variantOptions.map((variant) => {
                                const active = variant.partNumber === activeVariantPartNumber;
                                return (
                                    <button
                                        key={variant.partNumber}
                                        type="button"
                                        onClick={() => onSelectVariant?.(variant.partNumber)}
                                        className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                                            active
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {variant.label}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                    Updated {new Date(part.updatedAt).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}
