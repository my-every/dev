"use client";

import type { PhotoGalleryItem } from "@/components/activity/photo-upload-gallery";
import { getPartDisplayTitle } from "@/lib/parts/normalize-part-title";
import type {
    CatalogImage,
    CatalogImageSet,
    CatalogInstructionNote,
    ImageViewType as CatalogImageViewType,
    PartCatalogRecord,
} from "@/types/d380-catalog";
import type {
    ImageViewType as PartImageViewType,
    PartImage,
    PartRecord,
} from "@/types/parts-library";

export type WorkspacePartRecord = {
    part: PartRecord;
    catalog: PartCatalogRecord | null;
    title: string;
    status: string;
    hasPhotos: boolean;
    photoCount: number;
    primaryImageUrl: string | null;
};

export type PartOverviewCardData = {
    overview: {
        partNumber: string;
        description: string;
        note: string;
        badges: string[];
        summary: Array<{ label: string; value: string }>;
    };
    properties: Array<{ label: string; value: string }>;
};

export type PartInstructionCardData = {
    instructions: Array<{ type: string; stage: string; text: string }>;
    alternates: Array<{ label: string; value: string }>;
    notes: Array<{ type: string; stage: string; text: string }>;
};

export type PartImageGalleryData = {
    images: PhotoGalleryItem[];
    allowUpload?: boolean;
    onChange?: (images: PhotoGalleryItem[]) => void;
};

export const PARTS_LIBRARY_CATEGORY_MAP: Record<PartRecord["category"], PartCatalogRecord["category"]> = {
    devices: "Control Modules",
    terminals: "Terminal Blocks & Accessories",
    wiring: "Wire Management",
    hardware: "Panel Hardware",
    tools: "Panel Hardware",
    consumables: "Wire Management",
    unknown: "Unknown",
};

export function normalizePartLabel(value: string | null | undefined) {
    if (!value) {
        return "Unknown";
    }

    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getPartLifecycleStatus(part: PartRecord, catalog: PartCatalogRecord | null) {
    if (part.lifecycle?.status) {
        return normalizePartLabel(part.lifecycle.status);
    }
    if (catalog?.source === "MANUAL_ENTRY") {
        return "Catalog";
    }
    return "Ready";
}

export function buildWorkspacePartRecord(part: PartRecord, catalog: PartCatalogRecord | null): WorkspacePartRecord {
    const images = buildPhotoGalleryItems(part, catalog);
    return {
        part,
        catalog,
        title: getPartDisplayTitle(part),
        status: getPartLifecycleStatus(part, catalog),
        hasPhotos: images.length > 0,
        photoCount: images.length,
        primaryImageUrl: images[0]?.url ?? null,
    };
}

export function createCatalogRecordFromPart(part: PartRecord, existing: PartCatalogRecord | null): PartCatalogRecord {
    if (existing) {
        return {
            ...existing,
            partNumber: part.partNumber,
            description: existing.description || part.description,
            manufacturer: existing.manufacturer ?? part.manufacturer,
            manufacturerPartNumber: existing.manufacturerPartNumber ?? part.manufacturerPartNumber,
        };
    }

    return {
        partNumber: part.partNumber,
        description: part.description,
        category: PARTS_LIBRARY_CATEGORY_MAP[part.category],
        alternatePartNumbers: part.alternatePartNumbers ?? [],
        associatedParts: [],
        images: buildCatalogImageSetFromGallery(buildPhotoGalleryItems(part, null), undefined, part),
        source: "PROJECT_REFERENCE",
        manufacturer: part.manufacturer,
        manufacturerPartNumber: part.manufacturerPartNumber,
        notes: [],
        tools: [],
    };
}

export function buildPartOverviewCardData(part: PartRecord, catalog: PartCatalogRecord | null): PartOverviewCardData {
    return {
        overview: {
            partNumber: part.partNumber,
            description: getPartDisplayTitle(part),
            note: part.description,
            badges: [
                normalizePartLabel(part.category),
                normalizePartLabel(part.type),
                getPartLifecycleStatus(part, catalog),
            ],
            summary: [
            
                { label: "Source", value: normalizePartLabel(part.source) },
                { label: "Photos", value: `${buildPhotoGalleryItems(part, catalog).length}` },
            ],
        },
        properties: [
            { label: "Category", value: normalizePartLabel(part.category) },
            { label: "Type", value: normalizePartLabel(part.type) },
            { label: "Tags", value: `${part.tags?.length ?? 0}` },
        ],
    };
}

export function buildPartSpecificationSections(part: PartRecord, catalog: PartCatalogRecord | null) {
    const detailRows = Object.entries(part.details ?? {})
        .filter(([, value]) => isDisplayableDetail(value))
        .slice(0, 10)
        .map(([label, value]) => ({
            label: normalizePartLabel(label),
            value: formatDetailValue(value),
        }));


    return [
        {
            title: "Catalog",
           
        },
        {
            title: "Details",
            rows: detailRows.length
                ? detailRows
                : [
                      { label: "Description", value: part.description },
                      { label: "Updated", value: new Date(part.updatedAt).toLocaleDateString() },
                  ],
        },
    ];
}

export function buildPartInstructionCardData(part: PartRecord, catalog: PartCatalogRecord | null): PartInstructionCardData {
    const installationInstructions = (part.installationSteps ?? []).map((step) => ({
        type: "STEP",
        stage: `Step ${step.step}`,
        text: `${step.title}: ${step.description}`,
    }));

    const instructionNotes = (catalog?.notes ?? []).map((note) => mapCatalogNote(note));
    const warningNotes = (part.installationSteps ?? []).flatMap((step) =>
        (step.warnings ?? []).map((warning) => ({
            type: "WARNING",
            stage: step.title,
            text: warning,
        })),
    );

    return {
        instructions: installationInstructions.length
            ? installationInstructions
            : instructionNotes.slice(0, 4),
        alternates: (part.alternatePartNumbers ?? []).map((partNumber) => ({
            label: partNumber,
            value: "Alternate",
        })),
        notes: [...instructionNotes, ...warningNotes],
    };
}

export function buildPartUsageData(part: PartRecord) {
    return (part.associatedParts ?? []).map((related) => ({
        title: related.partNumber,
        location: `${normalizePartLabel(related.operationship)}${related.notes ? ` • ${related.notes}` : ""}`,
        quantity: `x${related.quantity ?? 1}`,
    }));
}

export function buildPhotoGalleryItems(part: PartRecord, catalog: PartCatalogRecord | null): PhotoGalleryItem[] {
    const items: PhotoGalleryItem[] = [];
    const seen = new Set<string>();

    const addImage = (
        source: Pick<CatalogImage, "src" | "label" | "alt" | "viewType"> | Pick<PartImage, "src" | "caption" | "alt" | "viewType">,
        uploadedAt: string,
    ) => {
        if (!source.src || seen.has(source.src)) {
            return;
        }

        seen.add(source.src);
        const name = "label" in source ? source.label : "caption" in source ? source.caption : undefined;
        items.push({
            id: `${part.partNumber}-${items.length + 1}`,
            url: source.src,
            name: name || source.alt || `${part.partNumber} image`,
            uploadedAt,
            tags: source.viewType ? [source.viewType] : [],
        });
    };

    const catalogImages = catalog?.images;
    const timestamp = catalog ? new Date().toISOString() : part.updatedAt;

    if (catalogImages) {
        addImage(catalogImages.primary ?? { src: "" }, timestamp);
        addImage(catalogImages.icon ?? { src: "" }, timestamp);
        catalogImages.images.forEach((image) => addImage(image, timestamp));
        catalogImages.diagrams.forEach((image) => addImage(image, timestamp));
    }

    const libraryImages = [
        part.images?.primary,
        part.images?.icon,
        ...(part.images?.gallery ?? []),
        part.images?.layoutSymbol,
        part.images?.blueLabel,
    ].filter(Boolean) as PartImage[];

    libraryImages.forEach((image) => addImage(image, part.updatedAt));

    return items;
}

export function buildCatalogImageSetFromGallery(
    images: PhotoGalleryItem[],
    existing: CatalogImageSet | undefined,
    part: PartRecord,
): CatalogImageSet {
    const nextImages: CatalogImage[] = images.map((image) => {
        const tagViewType = image.tags.find((tag) => isCatalogImageViewType(tag));
        return {
            src: image.url,
            label: image.name,
            alt: image.name || `${part.partNumber} reference image`,
            viewType: tagViewType ?? "installed",
        };
    });

    return {
        primary: nextImages[0] ?? existing?.primary,
        icon: existing?.icon,
        images: nextImages,
        diagrams: existing?.diagrams ?? [],
    };
}

function isDisplayableDetail(value: unknown) {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function formatDetailValue(value: unknown) {
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }
    return String(value);
}

function mapCatalogNote(note: CatalogInstructionNote) {
    return {
        type: note.type,
        stage: note.stages?.join(", ") || "Catalog",
        text: note.text,
    };
}

function isCatalogImageViewType(value: string): value is CatalogImageViewType {
    return [
        "front",
        "back",
        "top",
        "bottom",
        "left",
        "right",
        "installed",
        "wiring_diagram",
        "schematic",
        "icon",
    ].includes(value);
}
