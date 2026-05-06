"use client";

import { Battery, Box, ChevronDown, Check, Cpu, HardDrive, Monitor, Wifi, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { normalizePartLabel, type WorkspacePartRecord } from "./parts-types";

type SpecValue = string | boolean;

type SpecRow = { label: string; value: SpecValue; highlight?: boolean };
type SpecGroup = { id: string; name: string; icon: ReactNode; rows: SpecRow[] };

const GROUP_ICON: Record<string, ReactNode> = {
  identity: <Monitor className="h-4 w-4" />,
  electrical: <Battery className="h-4 w-4" />,
  compatibility: <Cpu className="h-4 w-4" />,
  storage: <HardDrive className="h-4 w-4" />,
  connectivity: <Wifi className="h-4 w-4" />,
  physical: <Box className="h-4 w-4" />,
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  return "-";
}

function row(label: string, value: unknown, highlight = false): SpecRow {
  if (typeof value === "boolean") return { label, value, highlight };
  return { label, value: toText(value), highlight };
}

function buildSpecGroups(partRecord: WorkspacePartRecord): SpecGroup[] {
  const part = partRecord.part;
  const catalog = partRecord.catalog;
  const details = (part.details ?? {}) as Record<string, unknown>;

  return [
    {
      id: "identity",
      name: "Identity",
      icon: GROUP_ICON.identity,
      rows: [
        row("Part Number", part.partNumber, true),
        row("Title", partRecord.title, true),
        row("Description", part.description),
        row("Category", normalizePartLabel(part.category), true),
        row("Type", normalizePartLabel(part.type)),
        row("Status", partRecord.status),
      ],
    },
    {
      id: "electrical",
      name: "Electrical",
      icon: GROUP_ICON.electrical,
      rows: [
        row("Voltage", catalog?.voltageRating ?? details.voltage),
        row("Current", catalog?.currentRating ?? details.current),
        row("Wire Gauges", catalog?.wireGauges ?? details.wireGauges),
        row("Power", details.power),
        row("Ground", details.ground),
      ],
    },
    {
      id: "physical",
      name: "Physical",
      icon: GROUP_ICON.physical,
      rows: [
        row("Length", details.length),
        row("Width", details.width),
        row("Height", details.height),
        row("Weight", details.weight),
        row("Material", details.material),
      ],
    },
  ].map((group) => ({
    ...group,
    rows: group.rows.filter((spec) => spec.value !== "-" && spec.value !== ""),
  }));
}

function renderSpecValue(value: SpecValue) {
  if (typeof value === "boolean") {
    return value ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />;
  }
  return <span>{value}</span>;
}

export function PartSpecExplorer({
  partRecord,
  className,
}: {
  partRecord: WorkspacePartRecord | null;
  className?: string;
}) {
  const groups = useMemo(() => (partRecord ? buildSpecGroups(partRecord) : []), [partRecord]);
  const [activeGroup, setActiveGroup] = useState<string>(groups[0]?.id ?? "identity");
  const [openGroups, setOpenGroups] = useState<string[]>(groups.map((group) => group.id));

  if (!partRecord) return null;

  const visibleGroups = groups.filter((group) => group.rows.length > 0);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Technical Specifications</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => setOpenGroups(visibleGroups.map((group) => group.id))}
          >
            Expand all
          </button>
          <span>·</span>
          <button type="button" className="hover:text-foreground" onClick={() => setOpenGroups([])}>
            Collapse all
          </button>
        </div>
      </div>

      <Tabs value={activeGroup} onValueChange={setActiveGroup}>
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-10 w-auto rounded-xl bg-muted/35 p-1">
            {visibleGroups.map((group) => (
              <TabsTrigger key={group.id} value={group.id} className="h-8 rounded-lg px-3 text-xs">
                {group.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {visibleGroups.map((group) => (
          <TabsContent key={group.id} value={group.id} className="mt-3">
            <div className="rounded-lg border border-border/70">
              <Table>
                <TableBody>
                  {group.rows.map((spec) => (
                    <TableRow key={`${group.id}-${spec.label}`}>
                      <TableCell className="w-1/2 text-muted-foreground">{spec.label}</TableCell>
                      <TableCell className={cn("font-medium", spec.highlight && "text-foreground")}>{renderSpecValue(spec.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-2">
        {visibleGroups.map((group) => (
          <Collapsible
            key={`collapse-${group.id}`}
            open={openGroups.includes(group.id)}
            onOpenChange={(open) =>
              setOpenGroups((prev) =>
                open ? [...new Set([...prev, group.id])] : prev.filter((entry) => entry !== group.id),
              )
            }
          >
            <div className="rounded-lg border border-border/70">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted/60">{group.icon}</span>
                  {group.name}
                  <Badge variant="secondary" className="text-[10px]">
                    {group.rows.length}
                  </Badge>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openGroups.includes(group.id) && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/60">
                  <Table>
                    <TableBody>
                      {group.rows.map((spec) => (
                        <TableRow key={`collapse-row-${group.id}-${spec.label}`}>
                          <TableCell className="w-1/2 text-muted-foreground">{spec.label}</TableCell>
                          <TableCell className="font-medium">{renderSpecValue(spec.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
