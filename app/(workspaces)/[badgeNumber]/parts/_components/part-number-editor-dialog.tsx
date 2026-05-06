"use client";

import { useMemo } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { PartCatalogRecord } from "@/types/d380-catalog";
import type { PartRecord } from "@/types/parts-library";

import { PartOverviewCard } from "./part-overview-card";
import { buildPartOverviewCardData } from "./parts-types";

type PartNumberEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: PartRecord;
  draft: PartCatalogRecord;
  saveState: "idle" | "saving";
  onChange: (next: PartCatalogRecord) => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
};

export function PartNumberEditorDialog({
  open,
  onOpenChange,
  part,
  draft,
  saveState,
  onChange,
  onSave,
  onDelete,
}: PartNumberEditorDialogProps) {
  const previewData = useMemo(() => buildPartOverviewCardData(part, draft), [draft, part]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-hidden p-0 sm:max-w-320">
        <DialogHeader className="border-b border-border/60 px-5 py-3">
          <DialogTitle>Edit Part Number</DialogTitle>
        </DialogHeader>
        <div className="grid h-[78vh] min-h-0 gap-0 xl:grid-cols-[1.15fr_1fr]">
          <ScrollArea className="h-full border-b border-border/60 xl:border-b-0 xl:border-r">
            <div className="space-y-4 p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Identity</div>
              <EditableField
                label="Description"
                hint="Human readable part name shown on cards."
                placeholder="Example: 10A Low-Peak Fuse"
                value={draft.description}
                onChange={(value) => onChange({ ...draft, description: value })}
              />
              <EditableField
                label="Manufacturer"
                hint="Vendor or manufacturer name."
                placeholder="Example: Eaton Bussmann"
                value={draft.manufacturer ?? ""}
                onChange={(value) => onChange({ ...draft, manufacturer: value || undefined })}
              />
              <EditableField
                label="Manufacturer Part Number"
                hint="Official supplier part number."
                placeholder="Example: LP-CC-10"
                value={draft.manufacturerPartNumber ?? ""}
                onChange={(value) => onChange({ ...draft, manufacturerPartNumber: value || undefined })}
              />
              <div className="pt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Electrical & Mounting</div>
              <EditableField
                label="Mount Type"
                hint="DIN rail, panel mount, etc."
                placeholder="Example: DIN_RAIL"
                value={draft.mountType ?? ""}
                onChange={(value) => onChange({ ...draft, mountType: (value || undefined) as PartCatalogRecord["mountType"] })}
              />
              <EditableField
                label="Voltage Rating"
                hint="Include units when possible."
                placeholder="Example: 600VAC"
                value={draft.voltageRating ?? ""}
                onChange={(value) => onChange({ ...draft, voltageRating: value || undefined })}
              />
              <EditableField
                label="Current Rating"
                hint="Include units when possible."
                placeholder="Example: 10A"
                value={draft.currentRating ?? ""}
                onChange={(value) => onChange({ ...draft, currentRating: value || undefined })}
              />
              <EditableField
                label="Wire Gauges"
                hint="Comma-separated values."
                placeholder="Example: 14, 16, 18"
                value={(draft.wireGauges ?? []).join(", ")}
                onChange={(value) =>
                  onChange({
                    ...draft,
                    wireGauges: value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
              <EditableField
                label="Related Parts"
                hint="Comma-separated part numbers."
                placeholder="Example: FUSE-HOLDER-10A, TB-1492-J4"
                value={(draft.associatedParts ?? []).map((item) => item.partNumber).join(", ")}
                onChange={(value) =>
                  onChange({
                    ...draft,
                    associatedParts: value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .map((partNumber) => ({ partNumber, quantity: 1, operationship: "REFERENCE" })),
                  })
                }
              />
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Primary Note</div>
                <div className="mb-2 text-xs text-muted-foreground">Installation or QA notes shown to downstream users.</div>
                <Textarea
                  className="min-h-24"
                  placeholder="Example: Verify fuse orientation before energizing panel."
                  value={draft.notes?.[0]?.text ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      notes: [
                        {
                          type: "INFO",
                          stages: ["GENERAL"],
                          text: event.target.value,
                        },
                      ],
                    })
                  }
                />
              </div>
            </div>
          </ScrollArea>
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Live Preview</div>
                <div className="mt-1 text-sm text-muted-foreground">Preview updates as you edit the part number metadata.</div>
              </div>
              <PartOverviewCard mode="dynamic" data={previewData} />
            </div>
          </ScrollArea>
        </div>
        <Separator />
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="outline" onClick={() => void onDelete()} disabled={saveState === "saving"}>
            Clear Record
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveState === "saving"}>
            Close
          </Button>
          <Button onClick={() => void onSave()} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving..." : "Save Catalog"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditableField({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      {hint ? <div className="mb-2 text-xs text-muted-foreground">{hint}</div> : null}
      <Input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
