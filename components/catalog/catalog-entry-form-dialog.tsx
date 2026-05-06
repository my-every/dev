"use client";

import { useState, useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { PartCatalogRecord, PartCategory, MountType } from "@/types/d380-catalog";

interface CatalogEntryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** If provided, form pre-fills for editing; otherwise creates new. */
    entry: PartCatalogRecord | null;
    onSave: (entry: PartCatalogRecord) => Promise<void>;
}

const CATEGORIES: PartCategory[] = [
    "Terminal Blocks & Accessories",
    "Ring Terminals",
    "Fork Terminals",
    "Wire Ferrules",
    "Grounding & Busbars",
    "DIN Rail & Mounting",
    "Control Relays",
    "Relay Sockets",
    "Timing Relays",
    "Protection Relays",
    "Circuit Protection",
    "Control Power",
    "Power Conversion",
    "Cable Management",
    "Wire Management",
    "Wire Duct & Panduit",
    "Panel Hardware",
    "PLC Control Platform",
    "PLC Rack Hardware",
    "PLC Communication Modules",
    "Safety Control System",
    "Unknown",
];

const MOUNT_TYPES: { value: MountType; label: string }[] = [
    { value: "DIN_RAIL", label: "DIN Rail" },
    { value: "PANEL_MOUNT", label: "Panel Mount" },
    { value: "RACK_MOUNT", label: "Rack Mount" },
    { value: "SURFACE_MOUNT", label: "Surface Mount" },
    { value: "SNAP_IN", label: "Snap In" },
    { value: "ADHESIVE", label: "Adhesive" },
    { value: "OTHER", label: "Other" },
];

function TagInput({ value, onChange, placeholder }: {
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
}) {
    const [input, setInput] = useState("");

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === ",") && input.trim()) {
            e.preventDefault();
            if (!value.includes(input.trim())) {
                onChange([...value, input.trim()]);
            }
            setInput("");
        }
        if (e.key === "Backspace" && !input && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-background min-h-[38px]">
            {value.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
            <input
                className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={value.length === 0 ? placeholder : ""}
            />
        </div>
    );
}

export function CatalogEntryFormDialog({
    open,
    onOpenChange,
    entry,
    onSave,
}: CatalogEntryFormDialogProps) {
    const isEdit = !!entry;
    const [partNumber, setPartNumber] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<PartCategory>("Unknown");
    const [subcategory, setSubcategory] = useState("");
    const [manufacturer, setManufacturer] = useState("");
    const [manufacturerPartNumber, setManufacturerPartNumber] = useState("");
    const [mountType, setMountType] = useState<MountType | "">("");
    const [voltageRating, setVoltageRating] = useState("");
    const [currentRating, setCurrentRating] = useState("");
    const [wireGauges, setWireGauges] = useState<string[]>([]);
    const [alternatePartNumbers, setAlternatePartNumbers] = useState<string[]>([]);
    const [devicePrefixes, setDevicePrefixes] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (entry) {
            setPartNumber(entry.partNumber);
            setDescription(entry.description);
            setCategory(entry.category);
            setSubcategory(entry.subcategory ?? "");
            setManufacturer(entry.manufacturer ?? "");
            setManufacturerPartNumber(entry.manufacturerPartNumber ?? "");
            setMountType(entry.mountType ?? "");
            setVoltageRating(entry.voltageRating ?? "");
            setCurrentRating(entry.currentRating ?? "");
            setWireGauges(entry.wireGauges ?? []);
            setAlternatePartNumbers(entry.alternatePartNumbers ?? []);
            setDevicePrefixes(entry.devicePrefixes ?? []);
        } else {
            setPartNumber("");
            setDescription("");
            setCategory("Unknown");
            setSubcategory("");
            setManufacturer("");
            setManufacturerPartNumber("");
            setMountType("");
            setVoltageRating("");
            setCurrentRating("");
            setWireGauges([]);
            setAlternatePartNumbers([]);
            setDevicePrefixes([]);
        }
    }, [entry, open]);

    const handleSubmit = useCallback(async () => {
        if (!partNumber.trim() || !description.trim()) return;
        setSaving(true);
        try {
            await onSave({
                ...(entry ?? {
                    images: {},
                    source: "MANUAL_ENTRY" as const,
                }),
                partNumber: partNumber.trim(),
                description: description.trim(),
                category,
                subcategory: subcategory.trim() || undefined,
                manufacturer: manufacturer.trim() || undefined,
                manufacturerPartNumber: manufacturerPartNumber.trim() || undefined,
                mountType: mountType || undefined,
                voltageRating: voltageRating.trim() || undefined,
                currentRating: currentRating.trim() || undefined,
                wireGauges: wireGauges.length > 0 ? wireGauges : undefined,
                alternatePartNumbers: alternatePartNumbers.length > 0 ? alternatePartNumbers : undefined,
                devicePrefixes: devicePrefixes.length > 0 ? devicePrefixes : undefined,
            } as PartCatalogRecord);
        } finally {
            setSaving(false);
        }
    }, [partNumber, description, category, subcategory, manufacturer, manufacturerPartNumber, mountType, voltageRating, currentRating, wireGauges, alternatePartNumbers, devicePrefixes, entry, onSave]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Part" : "Add Part"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `Update details for ${entry?.partNumber}`
                            : "Add a new part to the catalog library."}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="electrical">Electrical</TabsTrigger>
                        <TabsTrigger value="references">References</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="partNumber">Part Number</Label>
                                <Input
                                    id="partNumber"
                                    value={partNumber}
                                    onChange={(e) => setPartNumber(e.target.value)}
                                    placeholder="e.g. 1492-J4"
                                    disabled={isEdit}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="manufacturer">Manufacturer</Label>
                                <Input
                                    id="manufacturer"
                                    value={manufacturer}
                                    onChange={(e) => setManufacturer(e.target.value)}
                                    placeholder="e.g. Allen-Bradley"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Terminal block, 4mm, screw type"
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select
                                    value={category}
                                    onValueChange={(v) => setCategory(v as PartCategory)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subcategory">Subcategory</Label>
                                <Input
                                    id="subcategory"
                                    value={subcategory}
                                    onChange={(e) => setSubcategory(e.target.value)}
                                    placeholder="e.g. Screw Type"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="mfrPartNumber">Manufacturer Part #</Label>
                                <Input
                                    id="mfrPartNumber"
                                    value={manufacturerPartNumber}
                                    onChange={(e) => setManufacturerPartNumber(e.target.value)}
                                    placeholder="e.g. 1492-J4"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Mount Type</Label>
                                <Select
                                    value={mountType}
                                    onValueChange={(v) => setMountType(v as MountType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select mount type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MOUNT_TYPES.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="electrical" className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="voltageRating">Voltage Rating</Label>
                                <Input
                                    id="voltageRating"
                                    value={voltageRating}
                                    onChange={(e) => setVoltageRating(e.target.value)}
                                    placeholder="e.g. 600V"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currentRating">Current Rating</Label>
                                <Input
                                    id="currentRating"
                                    value={currentRating}
                                    onChange={(e) => setCurrentRating(e.target.value)}
                                    placeholder="e.g. 30A"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Wire Gauges (AWG)</Label>
                            <TagInput
                                value={wireGauges}
                                onChange={setWireGauges}
                                placeholder="Type gauge and press Enter (e.g. 14, 16, 18)"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="references" className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Alternate Part Numbers</Label>
                            <TagInput
                                value={alternatePartNumbers}
                                onChange={setAlternatePartNumbers}
                                placeholder="Type alternate P/N and press Enter"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Device Prefixes</Label>
                            <TagInput
                                value={devicePrefixes}
                                onChange={setDevicePrefixes}
                                placeholder="Type device prefix and press Enter (e.g. TB, CR)"
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!partNumber.trim() || !description.trim() || saving}
                    >
                        {saving ? "Saving…" : isEdit ? "Update" : "Create"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
