"use client";

import Link from "next/link";

import { DetailSectionCard } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Button } from "@/components/ui/button";

import type { WorkspacePartRecord } from "./parts-types";
import { normalizePartLabel } from "./parts-types";

type PartPreviewAsideProps = {
    badgeNumber: string;
    record: WorkspacePartRecord | null;
};

export function PartPreviewAside({ badgeNumber, record }: PartPreviewAsideProps) {
    if (!record) {
        return (
            <div className="space-y-4 p-4">
                <DetailSectionCard title="Part Preview" description="Select a part to inspect its catalog details." />
            </div>
        );
    }

    const { part, catalog, title, photoCount, primaryImageUrl } = record;

    return (
        <div className="space-y-4 p-4">
            <DetailSectionCard title={title} description={part.partNumber}>
                <div className="space-y-4">
                    {primaryImageUrl ? (
                        <img
                            src={primaryImageUrl}
                            alt={title}
                            className="aspect-video w-full rounded-2xl border border-border object-cover"
                        />
                    ) : (
                        <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                            No reference image yet
                        </div>
                    )}
                    <div className="space-y-2 text-sm">
                        <PreviewRow label="Category" value={normalizePartLabel(part.category)} />
                        <PreviewRow label="Type" value={normalizePartLabel(part.type)} />
                        <PreviewRow label="Status" value={record.status} />
                        <PreviewRow label="Photos" value={`${photoCount}`} />
                        <PreviewRow label="Manufacturer" value={catalog?.manufacturer ?? part.manufacturer ?? "—"} />
                    </div>
                </div>
            </DetailSectionCard>

            <DetailSectionCard title="Reference" description="Catalog and installation context">
                <div className="space-y-3 text-sm text-muted-foreground">
                    <div>{part.description}</div>
                    <div>{catalog?.notes?.[0]?.text ?? "Add notes, wiring diagrams, or installed views from the detail route."}</div>
                </div>
            </DetailSectionCard>

            <Button asChild className="w-full">
                <Link href={`/${badgeNumber}/parts/${encodeURIComponent(part.partNumber)}`}>
                    Open Part Details
                </Link>
            </Button>
        </div>
    );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="text-right text-foreground">{value}</div>
        </div>
    );
}
