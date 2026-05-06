"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BookOpen,
    ChevronRight,
    Image as ImageIcon,
    Package,
    Pencil,
    Save,
    Tag,
    Trash2,
    Wrench,
    X,
    Zap,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PartCatalogRecord } from "@/types/d380-catalog";

import { PhotoUploadGallery, type PhotoGalleryItem } from "@/components/activity/photo-upload-gallery";
import { PartUsageList } from "./part-usage-list";
import type { WorkspacePartRecord } from "./parts-types";
import {
    buildCatalogImageSetFromGallery,
    buildPartUsageData,
    buildPhotoGalleryItems,
    createCatalogRecordFromPart,
    normalizePartLabel,
} from "./parts-types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PartDetailModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    part: WorkspacePartRecord | null;
    onSave?: (partNumber: string, catalog: PartCatalogRecord) => Promise<void>;
    onDelete?: (partNumber: string) => Promise<void>;
};

type SectionId = "details" | "images" | "manufacturer" | "specs" | "usage";

interface Section {
    id: SectionId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PartDetailModal({
    open,
    onOpenChange,
    part,
    onSave,
    onDelete,
}: PartDetailModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState<PartCatalogRecord | null>(null);
    const [saveState, setSaveState] = useState<"idle" | "saving">("idle");
    const [activeSection, setActiveSection] = useState<SectionId>("details");
    const [galleryImages, setGalleryImages] = useState<PhotoGalleryItem[]>([]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});

    // Derive which sections are available for this part
    const availableSections = useMemo<Section[]>(() => {
        if (!part) return [];
        const sections: Section[] = [
            { id: "details", label: "Details", icon: BookOpen },
            { id: "images", label: "Images", icon: ImageIcon },
        ];
        const hasManufacturer = Boolean(
            part.catalog?.manufacturer || part.part.manufacturer ||
            part.catalog?.manufacturerPartNumber || part.part.manufacturerPartNumber,
        );
        if (hasManufacturer) {
            sections.push({ id: "manufacturer", label: "Manufacturer", icon: Tag });
        }
        const hasSpecs = Boolean(
            part.catalog?.mountType || part.catalog?.voltageRating ||
            part.catalog?.currentRating || (part.catalog?.wireGauges?.length ?? 0) > 0 ||
            Object.keys(part.part.details ?? {}).length > 0,
        );
        if (hasSpecs) {
            sections.push({ id: "specs", label: "Specs", icon: Zap });
        }
        const hasUsage = (part.part.associatedParts?.length ?? 0) > 0;
        if (hasUsage) {
            sections.push({ id: "usage", label: "Usage", icon: Wrench });
        }
        return sections;
    }, [part]);

    // Reset state whenever the part changes
    useEffect(() => {
        if (part) {
            setEditDraft(createCatalogRecordFromPart(part.part, part.catalog));
            setGalleryImages(buildPhotoGalleryItems(part.part, part.catalog));
            setIsEditing(false);
            setActiveSection("details");
        }
    }, [part?.part.partNumber]);

    // Scrollspy — uses container-relative offsets so it stays accurate as you scroll.
    // Converts each section's viewport position back to a scroll-origin offset:
    //   sectionOffset = el.getBoundingClientRect().top
    //                   - container.getBoundingClientRect().top
    //                   + container.scrollTop
    // Then the section is "active" whenever scrollTop has reached that offset
    // minus a small look-ahead threshold (ACTIVE_OFFSET).
    useEffect(() => {
        if (!open) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        const ACTIVE_OFFSET = 80; // px from the top of the container to consider "reached"

        const handleScroll = () => {
            const containerRect = container.getBoundingClientRect();
            const scrollTop = container.scrollTop;
            let current: SectionId = availableSections[0]?.id ?? "details";

            for (const section of availableSections) {
                const el = sectionRefs.current[section.id];
                if (el) {
                    // Distance from top of scroll content (not viewport)
                    const sectionOffset =
                        el.getBoundingClientRect().top - containerRect.top + scrollTop;
                    if (scrollTop >= sectionOffset - ACTIVE_OFFSET) {
                        current = section.id;
                    }
                }
            }
            setActiveSection(current);
        };

        // Run once immediately so the initial active state is correct
        handleScroll();
        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [open, availableSections]);

    const scrollToSection = useCallback((id: SectionId) => {
        const el = sectionRefs.current[id];
        const container = scrollContainerRef.current;
        if (el && container) {
            // Convert to scroll-origin offset, then subtract a small top gap
            const sectionOffset =
                el.getBoundingClientRect().top -
                container.getBoundingClientRect().top +
                container.scrollTop;
            container.scrollTo({ top: sectionOffset - 24, behavior: "smooth" });
        }
    }, []);

    const handleGalleryChange = useCallback((next: PhotoGalleryItem[]) => {
        setGalleryImages(next);
        if (editDraft && part) {
            setEditDraft({
                ...editDraft,
                images: buildCatalogImageSetFromGallery(next, editDraft.images, part.part),
            });
        }
    }, [editDraft, part]);

    const handleSave = async () => {
        if (!part || !editDraft || !onSave) return;
        setSaveState("saving");
        try {
            await onSave(part.part.partNumber, editDraft);
            setIsEditing(false);
        } finally {
            setSaveState("idle");
        }
    };

    const handleDelete = async () => {
        if (!part || !onDelete) return;
        setSaveState("saving");
        try {
            await onDelete(part.part.partNumber);
            setEditDraft(createCatalogRecordFromPart(part.part, null));
        } finally {
            setSaveState("idle");
        }
    };

    const handleCancelEdit = () => {
        if (part) setEditDraft(createCatalogRecordFromPart(part.part, part.catalog));
        setIsEditing(false);
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setIsEditing(false);
            setActiveSection("details");
        }
        onOpenChange(next);
    };

    const usageData = useMemo(() => (part ? buildPartUsageData(part.part) : []), [part]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="!max-w-[860px] flex h-[82vh] max-h-[82vh] w-full flex-col gap-0 overflow-hidden p-0 sm:!max-w-[860px]"
                showCloseButton
            >
                {/* ── Header ── */}
                <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4">
                    {part?.primaryImageUrl ? (
                        <img
                            src={part.primaryImageUrl}
                            alt={part.title}
                            className="h-11 w-11 shrink-0 rounded-xl border border-border object-cover"
                        />
                    ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                            <Package className="h-5 w-5" />
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <DialogTitle className="truncate text-base font-semibold">
                            {part?.title ?? "Part Details"}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Part details for {part?.part.partNumber ?? "selected part"}
                        </DialogDescription>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{part?.part.partNumber}</span>
                            {part?.status && (
                                <>
                                    <span className="opacity-30">·</span>
                                    <Badge variant="secondary" className="h-5 text-[10px]">
                                        {part.status}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {isEditing ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={saveState === "saving"}
                                >
                                    <X className="mr-1 h-4 w-4" />
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={saveState === "saving"}
                                >
                                    <Save className="mr-1 h-4 w-4" />
                                    {saveState === "saving" ? "Saving…" : "Save"}
                                </Button>
                            </>
                        ) : onSave ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                            >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                            </Button>
                        ) : null}
                    </div>
                </div>

                {/* ── Body: nav + scrollable content ── */}
                <div className="flex min-h-0 flex-1">
                    {/* Scrollspy navigation */}
                    <nav className="w-44 shrink-0 space-y-0.5 border-r bg-muted/30 p-3">
                        {!part
                            ? Array.from({ length: 3 }).map((_, i) => (
                                  <Skeleton key={i} className="h-8 rounded-lg" />
                              ))
                            : availableSections.map((section) => {
                                  const Icon = section.icon;
                                  const isActive = activeSection === section.id;
                                  return (
                                      <button
                                          key={section.id}
                                          type="button"
                                          onClick={() => scrollToSection(section.id)}
                                          className={cn(
                                              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                                              isActive
                                                  ? "bg-background text-foreground shadow-sm"
                                                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                                          )}
                                      >
                                          <Icon className="h-4 w-4 shrink-0" />
                                          <span className="flex-1 truncate">{section.label}</span>
                                          {isActive && <ChevronRight className="ml-auto h-3 w-3 shrink-0" />}
                                      </button>
                                  );
                              })}
                    </nav>

                    {/* Scrollable main content */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto"
                    >
                        {!part ? (
                            <PartDetailSkeleton />
                        ) : (
                            <div className="space-y-8 p-6 pb-[55vh]">

                                {/* ── Details ── */}
                                <section ref={(el) => { sectionRefs.current.details = el; }}>
                                    <SectionHeader icon={BookOpen} title="Details" description="Core part information" />
                                    <div className="mt-4 space-y-3">
                                        <DetailRow label="Part Number" icon={Package}>
                                            <span className="font-mono text-sm">{part.part.partNumber}</span>
                                        </DetailRow>

                                        <DetailRow label="Description" icon={BookOpen}>
                                            {isEditing ? (
                                                <Input
                                                    value={editDraft?.description ?? ""}
                                                    onChange={(e) => editDraft && setEditDraft({ ...editDraft, description: e.target.value })}
                                                    placeholder="Enter a description…"
                                                />
                                            ) : (
                                                <DisplayValue value={editDraft?.description ?? part.catalog?.description ?? part.part.description} />
                                            )}
                                        </DetailRow>

                                        <DetailRow label="Name" icon={Tag}>
                                            {isEditing ? (
                                                <Input
                                                    value={editDraft?.name ?? ""}
                                                    onChange={(e) => editDraft && setEditDraft({ ...editDraft, name: e.target.value })}
                                                    placeholder="Short display name…"
                                                />
                                            ) : (
                                                <DisplayValue value={editDraft?.name ?? part.catalog?.name} />
                                            )}
                                        </DetailRow>

                                        <DetailRow label="Category" icon={Tag}>
                                            <DisplayValue value={normalizePartLabel(part.part.category)} />
                                        </DetailRow>

                                        <DetailRow label="Type" icon={Tag}>
                                            <DisplayValue value={normalizePartLabel(part.part.type)} />
                                        </DetailRow>

                                        <DetailRow label="Source" icon={Tag}>
                                            <DisplayValue value={normalizePartLabel(part.part.source)} />
                                        </DetailRow>

                                        {(part.part.tags?.length ?? 0) > 0 && (
                                            <DetailRow label="Tags" icon={Tag}>
                                                <div className="flex flex-wrap gap-1 py-1">
                                                    {(part.part.tags ?? []).map((tag) => (
                                                        <Badge key={tag} variant="outline" className="text-[11px]">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </DetailRow>
                                        )}

                                        {/* Notes — always editable */}
                                        <DetailRow label="Notes" icon={BookOpen}>
                                            {isEditing ? (
                                                <Textarea
                                                    className="min-h-[72px] text-sm"
                                                    placeholder="Add installation or QA notes…"
                                                    value={editDraft?.notes?.[0]?.text ?? ""}
                                                    onChange={(e) => editDraft && setEditDraft({
                                                        ...editDraft,
                                                        notes: e.target.value
                                                            ? [{ type: "INFO", stages: ["GENERAL"], text: e.target.value }]
                                                            : [],
                                                    })}
                                                />
                                            ) : (
                                                <DisplayValue value={part.catalog?.notes?.[0]?.text} />
                                            )}
                                        </DetailRow>
                                    </div>
                                </section>

                                {/* ── Images ── */}
                                <section ref={(el) => { sectionRefs.current.images = el; }}>
                                    <SectionHeader icon={ImageIcon} title="Reference Images" description="Photos and reference material" />
                                    <div className="mt-4">
                                        {galleryImages.length > 0 ? (
                                            <PhotoUploadGallery
                                                images={galleryImages}
                                                onChange={handleGalleryChange}
                                                variant="preview"
                                                allowUpload={isEditing}
                                                allowUrlImport={isEditing}
                                                maxPreviewCards={4}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
                                                <ImageIcon className="mb-2 h-7 w-7 text-muted-foreground/40" />
                                                <p className="text-sm text-muted-foreground">No images available</p>
                                                {isEditing && (
                                                    <div className="mt-3">
                                                        <PhotoUploadGallery
                                                            images={[]}
                                                            onChange={handleGalleryChange}
                                                            variant="grid"
                                                            allowUpload
                                                            allowUrlImport
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* ── Manufacturer (conditional) ── */}
                                {availableSections.some((s) => s.id === "manufacturer") && (
                                    <section ref={(el) => { sectionRefs.current.manufacturer = el; }}>
                                        <SectionHeader icon={Tag} title="Manufacturer" description="Vendor and part number details" />
                                        <div className="mt-4 space-y-3">
                                            <DetailRow label="Manufacturer" icon={Tag}>
                                                {isEditing ? (
                                                    <Input
                                                        value={editDraft?.manufacturer ?? ""}
                                                        onChange={(e) => editDraft && setEditDraft({ ...editDraft, manufacturer: e.target.value || undefined })}
                                                        placeholder="e.g., Eaton Bussmann"
                                                    />
                                                ) : (
                                                    <DisplayValue value={part.catalog?.manufacturer ?? part.part.manufacturer} />
                                                )}
                                            </DetailRow>

                                            <DetailRow label="MPN" icon={Tag}>
                                                {isEditing ? (
                                                    <Input
                                                        value={editDraft?.manufacturerPartNumber ?? ""}
                                                        onChange={(e) => editDraft && setEditDraft({ ...editDraft, manufacturerPartNumber: e.target.value || undefined })}
                                                        placeholder="e.g., LP-CC-10"
                                                    />
                                                ) : (
                                                    <DisplayValue value={part.catalog?.manufacturerPartNumber ?? part.part.manufacturerPartNumber} />
                                                )}
                                            </DetailRow>

                                            {(part.part.alternatePartNumbers?.length ?? 0) > 0 && (
                                                <DetailRow label="Alternate Part Numbers" icon={Tag}>
                                                    <div className="flex flex-wrap gap-1 py-1">
                                                        {(part.part.alternatePartNumbers ?? []).map((pn) => (
                                                            <Badge key={pn} variant="outline" className="font-mono text-[11px]">
                                                                {pn}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </DetailRow>
                                            )}
                                        </div>
                                    </section>
                                )}

                                {/* ── Specs (conditional) ── */}
                                {availableSections.some((s) => s.id === "specs") && (
                                    <section ref={(el) => { sectionRefs.current.specs = el; }}>
                                        <SectionHeader icon={Zap} title="Specifications" description="Electrical and physical properties" />
                                        <div className="mt-4 space-y-3">
                                            {part.catalog?.mountType && (
                                                <DetailRow label="Mount Type" icon={Zap}>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDraft?.mountType ?? ""}
                                                            onChange={(e) => editDraft && setEditDraft({ ...editDraft, mountType: (e.target.value || undefined) as PartCatalogRecord["mountType"] })}
                                                            placeholder="e.g., DIN_RAIL"
                                                        />
                                                    ) : (
                                                        <DisplayValue value={part.catalog.mountType} />
                                                    )}
                                                </DetailRow>
                                            )}
                                            {part.catalog?.voltageRating && (
                                                <DetailRow label="Voltage Rating" icon={Zap}>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDraft?.voltageRating ?? ""}
                                                            onChange={(e) => editDraft && setEditDraft({ ...editDraft, voltageRating: e.target.value || undefined })}
                                                            placeholder="e.g., 600VAC"
                                                        />
                                                    ) : (
                                                        <DisplayValue value={part.catalog.voltageRating} />
                                                    )}
                                                </DetailRow>
                                            )}
                                            {part.catalog?.currentRating && (
                                                <DetailRow label="Current Rating" icon={Zap}>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDraft?.currentRating ?? ""}
                                                            onChange={(e) => editDraft && setEditDraft({ ...editDraft, currentRating: e.target.value || undefined })}
                                                            placeholder="e.g., 10A"
                                                        />
                                                    ) : (
                                                        <DisplayValue value={part.catalog.currentRating} />
                                                    )}
                                                </DetailRow>
                                            )}
                                            {(part.catalog?.wireGauges?.length ?? 0) > 0 && (
                                                <DetailRow label="Wire Gauges" icon={Zap}>
                                                    {isEditing ? (
                                                        <Input
                                                            value={(editDraft?.wireGauges ?? []).join(", ")}
                                                            onChange={(e) => editDraft && setEditDraft({
                                                                ...editDraft,
                                                                wireGauges: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                                                            })}
                                                            placeholder="e.g., 14, 16, 18"
                                                        />
                                                    ) : (
                                                        <DisplayValue value={(part.catalog?.wireGauges ?? []).join(", ")} />
                                                    )}
                                                </DetailRow>
                                            )}
                                            {/* Dynamic details from part record */}
                                            {Object.entries(part.part.details ?? {})
                                                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                                                .slice(0, 8)
                                                .map(([key, value]) => (
                                                    <DetailRow key={key} label={normalizePartLabel(key)} icon={Zap}>
                                                        <DisplayValue value={String(value)} />
                                                    </DetailRow>
                                                ))}
                                        </div>
                                    </section>
                                )}

                                {/* ── Usage (conditional) ── */}
                                {availableSections.some((s) => s.id === "usage") && (
                                    <section ref={(el) => { sectionRefs.current.usage = el; }}>
                                        <SectionHeader icon={Wrench} title="Usage" description="Where this part appears across active work" />
                                        <div className="mt-4">
                                            <PartUsageList mode="dynamic" data={usageData} />
                                        </div>
                                    </section>
                                )}

                                {/* Footer delete action */}
                                {isEditing && onDelete && (
                                    <div className="flex items-center justify-between border-t border-border/60 pt-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={handleDelete}
                                            disabled={saveState === "saving"}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                            Clear Catalog Record
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Changes apply when you click Save
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (matching user-details-modal style)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3 border-b pb-3">
            <div className="rounded-lg bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function DetailRow({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[180px_1fr] items-start gap-4">
            <div className="flex items-center gap-2 py-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Label className="text-sm text-muted-foreground">{label}</Label>
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function DisplayValue({ value }: { value: string | null | undefined }) {
    if (!value || value === "—") {
        return (
            <span className="block py-2 text-sm italic text-muted-foreground/50">
                Not set
            </span>
        );
    }
    return <span className="block py-2 text-sm text-foreground">{value}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PartDetailSkeleton() {
    return (
        <div className="space-y-6 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[180px_1fr] gap-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-full" />
                </div>
            ))}
        </div>
    );
}
