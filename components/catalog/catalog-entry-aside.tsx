"use client";

import {
    Edit,
    Trash2,
    Package,
    Zap,
    Wrench,
    Tag,
    ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PartCatalogRecord } from "@/types/d380-catalog";

interface CatalogEntryAsideProps {
    entry: PartCatalogRecord;
    onEdit: () => void;
    onDelete: () => void;
}

export function CatalogEntryAside({
    entry,
    onEdit,
    onDelete,
}: CatalogEntryAsideProps) {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="font-mono text-base font-bold truncate">
                            {entry.partNumber}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {entry.description}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={onDelete}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                        {entry.category}
                    </Badge>
                    {entry.subcategory && (
                        <Badge variant="secondary" className="text-[10px]">
                            {entry.subcategory}
                        </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                        {entry.source}
                    </Badge>
                </div>
            </div>

            <Separator />

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {/* Manufacturer */}
                    {entry.manufacturer && (
                        <DetailSection title="Manufacturer">
                            <p className="text-sm">{entry.manufacturer}</p>
                            {entry.manufacturerPartNumber && (
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                    MPN: {entry.manufacturerPartNumber}
                                </p>
                            )}
                        </DetailSection>
                    )}

                    {/* Electrical specs */}
                    {(entry.voltageRating || entry.currentRating) && (
                        <DetailSection title="Electrical Specs">
                            <div className="flex flex-wrap gap-2">
                                {entry.voltageRating && (
                                    <Badge variant="outline" className="gap-1 text-xs">
                                        <Zap className="h-3 w-3" />
                                        {entry.voltageRating}
                                    </Badge>
                                )}
                                {entry.currentRating && (
                                    <Badge variant="outline" className="gap-1 text-xs">
                                        <Zap className="h-3 w-3" />
                                        {entry.currentRating}
                                    </Badge>
                                )}
                            </div>
                        </DetailSection>
                    )}

                    {/* Wire gauges */}
                    {entry.wireGauges && entry.wireGauges.length > 0 && (
                        <DetailSection title="Wire Gauges">
                            <div className="flex flex-wrap gap-1">
                                {entry.wireGauges.map((g) => (
                                    <Badge key={g} variant="secondary" className="text-[10px]">
                                        {g} AWG
                                    </Badge>
                                ))}
                            </div>
                        </DetailSection>
                    )}

                    {/* Mount type */}
                    {entry.mountType && (
                        <DetailSection title="Mount Type">
                            <Badge variant="outline" className="gap-1 text-xs">
                                <Wrench className="h-3 w-3" />
                                {entry.mountType}
                            </Badge>
                        </DetailSection>
                    )}

                    {/* Alternate part numbers */}
                    {entry.alternatePartNumbers && entry.alternatePartNumbers.length > 0 && (
                        <DetailSection title="Alternates">
                            <div className="flex flex-wrap gap-1">
                                {entry.alternatePartNumbers.map((pn) => (
                                    <Badge key={pn} variant="outline" className="font-mono text-[10px]">
                                        {pn}
                                    </Badge>
                                ))}
                            </div>
                        </DetailSection>
                    )}

                    {/* Device prefixes */}
                    {entry.devicePrefixes && entry.devicePrefixes.length > 0 && (
                        <DetailSection title="Device Prefixes">
                            <div className="flex flex-wrap gap-1">
                                {entry.devicePrefixes.map((p) => (
                                    <Badge key={p} variant="secondary" className="font-mono text-[10px]">
                                        {p}
                                    </Badge>
                                ))}
                            </div>
                        </DetailSection>
                    )}

                    {/* Associated Parts */}
                    {entry.associatedParts && entry.associatedParts.length > 0 && (
                        <DetailSection title="Associated Parts">
                            <div className="space-y-1.5">
                                {entry.associatedParts.map((ap, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs rounded-md border px-2 py-1.5"
                                    >
                                        <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="font-mono font-medium">{ap.partNumber}</span>
                                        <span className="text-muted-foreground truncate">
                                            {ap.operationship}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </DetailSection>
                    )}

                    {/* Tools */}
                    {entry.tools && entry.tools.length > 0 && (
                        <DetailSection title="Tools Required">
                            <div className="space-y-1.5">
                                {entry.tools.map((tool, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs rounded-md border px-2 py-1.5"
                                    >
                                        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="font-medium">{tool.name}</span>
                                        {tool.specification && (
                                            <span className="text-muted-foreground font-mono">
                                                {tool.specification}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </DetailSection>
                    )}

                    {/* Notes */}
                    {entry.notes && entry.notes.length > 0 && (
                        <DetailSection title="Notes">
                            <div className="space-y-2">
                                {entry.notes.map((note, i) => (
                                    <div
                                        key={i}
                                        className="text-xs rounded-md border bg-muted/30 px-3 py-2"
                                    >
                                        <p className="font-semibold mb-0.5">{note.type}</p>
                                        <p className="text-muted-foreground">{note.text}</p>
                                    </div>
                                ))}
                            </div>
                        </DetailSection>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function DetailSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {title}
            </h4>
            {children}
        </div>
    );
}
