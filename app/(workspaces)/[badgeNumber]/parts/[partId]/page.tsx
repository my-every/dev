"use client";

import { use, useEffect, useMemo, useState } from "react";

import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import { PageContent } from "@/components/layout/page-content";
import type { PhotoGalleryItem } from "@/components/activity/photo-upload-gallery";
import { Button } from "@/components/ui/button";
import {
    DetailSectionCard,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import {
    PartImageGallery,
    PartInstructionList,
    PartNumberEditorDialog,
    PartOverviewCard,
    PartSpecificationGroup,
    PartSubheader,
    PartUsageList,
    buildCatalogImageSetFromGallery,
    buildPartInstructionCardData,
    buildPartOverviewCardData,
    buildPartSpecificationSections,
    buildPartUsageData,
    buildPhotoGalleryItems,
    createCatalogRecordFromPart,
    getPartLifecycleStatus,
    normalizePartLabel,
} from "@/app/(workspaces)/[badgeNumber]/parts/_components";
import type { PartCatalogRecord } from "@/types/d380-catalog";
import type { PartRecord } from "@/types/parts-library";

type PartDetailsPageProps = {
    params: Promise<{
        badgeNumber: string;
        partId: string;
    }>;
};

type PartsResponse = {
    parts?: PartRecord[];
};

type CatalogEntryResponse = {
    record?: PartCatalogRecord;
    error?: string;
};

export default function PartDetailsPage({ params: paramsPromise }: PartDetailsPageProps) {
    const params = use(paramsPromise);
    const [part, setPart] = useState<PartRecord | null>(null);
    const [catalog, setCatalog] = useState<PartCatalogRecord | null>(null);
    const [catalogDraft, setCatalogDraft] = useState<PartCatalogRecord | null>(null);
    const [mode, setMode] = useState<ViewMode>("skeleton");
    const [saveState, setSaveState] = useState<"idle" | "saving">("idle");
    const [editorOpen, setEditorOpen] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function loadPart() {
            setMode("skeleton");

            const decodedPartId = decodeURIComponent(params.partId);
            const [partResponse, catalogResponse] = await Promise.all([
                fetch(`/api/parts?query=${encodeURIComponent(decodedPartId)}&limit=200`, { cache: "no-store" }),
                fetch(`/api/parts/catalog/${encodeURIComponent(decodedPartId)}`, { cache: "no-store" }),
            ]);

            const [partPayload, catalogPayload] = await Promise.all([
                partResponse.ok ? partResponse.json() : Promise.resolve({ parts: [] }),
                catalogResponse.status === 404 ? Promise.resolve({ record: null }) : catalogResponse.json(),
            ]);

            if (!mounted) {
                return;
            }

            const parts = (partPayload as PartsResponse).parts ?? [];
            const matchedPart =
                parts.find((entry) => entry.partNumber.toLowerCase() === decodedPartId.toLowerCase()) ?? null;

            setPart(matchedPart);
            const nextCatalog = ((catalogPayload as CatalogEntryResponse).record ?? null) as PartCatalogRecord | null;
            setCatalog(nextCatalog);
            setCatalogDraft(matchedPart ? createCatalogRecordFromPart(matchedPart, nextCatalog) : null);
            setMode("dynamic");
        }

        void loadPart();

        return () => {
            mounted = false;
        };
    }, [params.partId]);

    const title = part ? `${part.partNumber} · ${normalizePartLabel(part.type)}` : decodeURIComponent(params.partId);
    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Parts",
                items: [
                    {
                        id: "parts-root",
                        label: "Parts Workspace",
                        href: `/${params.badgeNumber}/parts`,
                        keywords: ["parts", "workspace", "catalog"],
                    },
                    {
                        id: "part-detail",
                        label: title,
                        href: `/${params.badgeNumber}/parts/${encodeURIComponent(params.partId)}`,
                        keywords: [params.partId, title, part?.description ?? "", part?.type ?? "", part?.category ?? ""],
                    },
                ],
            },
        ],
        [params.badgeNumber, params.partId, part?.category, part?.description, part?.type, title],
    );

    const overviewData = useMemo(() => (part ? buildPartOverviewCardData(part, catalog) : undefined), [catalog, part]);
    const specificationData = useMemo(() => (part ? buildPartSpecificationSections(part, catalog) : undefined), [catalog, part]);
    const instructionData = useMemo(() => (part ? buildPartInstructionCardData(part, catalog) : undefined), [catalog, part]);
    const usageData = useMemo(() => (part ? buildPartUsageData(part) : undefined), [part]);
    const galleryImages = useMemo(() => (part ? buildPhotoGalleryItems(part, catalog) : []), [catalog, part]);

    const saveCatalogDraft = async () => {
        if (!part || !catalogDraft) {
            return;
        }

        setSaveState("saving");
        try {
            const response = await fetch(`/api/parts/catalog/${encodeURIComponent(part.partNumber)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(catalogDraft),
            });
            if (!response.ok) {
                throw new Error("Failed to save catalog details.");
            }
            const payload = (await response.json()) as { record?: PartCatalogRecord };
            setCatalog(payload.record ?? catalogDraft);
            setCatalogDraft(payload.record ?? catalogDraft);
        } finally {
            setSaveState("idle");
        }
    };

    const deleteCatalogDraft = async () => {
        if (!part) {
            return;
        }
        setSaveState("saving");
        try {
            await fetch(`/api/parts/catalog/${encodeURIComponent(part.partNumber)}`, { method: "DELETE" });
            setCatalog(null);
            setCatalogDraft(createCatalogRecordFromPart(part, null));
        } finally {
            setSaveState("idle");
        }
    };

    const handleGalleryChange = async (nextImages: PhotoGalleryItem[]) => {
        if (!part) {
            return;
        }

        setSaveState("saving");
        try {
            const baseRecord = createCatalogRecordFromPart(part, catalog);
            const nextRecord: PartCatalogRecord = {
                ...baseRecord,
                images: buildCatalogImageSetFromGallery(nextImages, baseRecord.images, part),
            };

            const response = await fetch(`/api/parts/catalog/${encodeURIComponent(part.partNumber)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nextRecord),
            });

            if (!response.ok) {
                throw new Error("Failed to save part images.");
            }

            const payload = (await response.json()) as { record?: PartCatalogRecord };
            setCatalog(payload.record ?? nextRecord);
        } finally {
            setSaveState("idle");
        }
    };

    return (
        <PageContent
            title="Part Details"
            subtitle={part?.partNumber ?? decodeURIComponent(params.partId)}
            variant="compact"
            showPanel={false}
            showAside={false}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search part details"
        >
            <div className="space-y-4 p-4 sm:p-5 lg:p-6">
                <PartSubheader
                    mode={mode}
                    data={
                        part
                            ? {
                                  title: part.partNumber,
                                  description: part.description,
                                  metadata: [
                                      { label: "Category", value: normalizePartLabel(part.category) },
                                      {
                                          label: "Status",
                                          value: getPartLifecycleStatus(part, catalog),
                                      },
                                  ],
                              }
                            : undefined
                    }
                />

                
            </div>
            {part && catalogDraft ? (
                <PartNumberEditorDialog
                    open={editorOpen}
                    onOpenChange={setEditorOpen}
                    part={part}
                    draft={catalogDraft}
                    saveState={saveState}
                    onChange={setCatalogDraft}
                    onSave={saveCatalogDraft}
                    onDelete={deleteCatalogDraft}
                />
            ) : null}
        </PageContent>
    );
}

function PartCatalogEditorCard({
    mode,
    catalog,
    saveState,
    onOpenEditor,
}: {
    mode: ViewMode;
    catalog: PartCatalogRecord | null;
    saveState: "idle" | "saving";
    onOpenEditor: () => void;
}) {
    return (
        <DetailSectionCard
            title="Catalog Details"
            description="Manage part number details used by workspace cards and downstream reference flows."
            action={
                mode === "skeleton" ? null : (
                    <Button size="sm" onClick={onOpenEditor} disabled={saveState === "saving"}>
                        {saveState === "saving" ? "Saving..." : "Edit Catalog"}
                    </Button>
                )
            }
        >
            {mode === "skeleton" ? (
                <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="h-11 rounded-xl bg-muted/50" />
                    ))}
                </div>
            ) : catalog ? (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <ReadOnlyField label="Description" value={catalog.description} />
                        <ReadOnlyField label="Mount Type" value={catalog.mountType ?? "—"} />
                        <ReadOnlyField label="Voltage" value={catalog.voltageRating ?? "—"} />
                        <ReadOnlyField label="Current" value={catalog.currentRating ?? "—"} />
                    </div>
                    <div>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Wire Gauges</div>
                        <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                            {(catalog.wireGauges ?? []).join(", ") || "—"}
                        </div>
                    </div>
                    <div>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Primary Note</div>
                        <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                            {catalog.notes?.[0]?.text || "—"}
                        </div>
                    </div>
                </div>
            ) : null}
        </DetailSectionCard>
    );
}

function ReadOnlyField({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">{value || "—"}</div>
        </div>
    );
}
