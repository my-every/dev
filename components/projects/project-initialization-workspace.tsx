"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  FileSpreadsheet,
  LayoutGrid,
  Orbit,
  PanelRight,
  Save,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadialFlow, type Topic } from "@/components/loaders/radial-flow";
import { resolveUnitTypeIcon } from "@/lib/project-units/icon-resolver";
import type { ProjectManifest } from "@/types/project-manifest";
import type { ProjectUnit, ProjectUnitsPayload, ProjectUnitVisualState, SheetUnitBinding } from "@/lib/project-units/types";
import { cn } from "@/lib/utils";
import type { SlimLayoutPage } from "@/lib/layout-matching/types";

type WorkspaceViewMode = "board" | "orbit";

interface ProjectInitializationWorkspaceProps {
  project: ProjectManifest;
  unitsPayload: ProjectUnitsPayload;
  onSaveUnits: (units: ProjectUnit[]) => Promise<void>;
  onGenerateWorkflow: (units: ProjectUnit[]) => Promise<void>;
  onContinueToProject: () => void;
  layoutPages: SlimLayoutPage[];
  isSaving?: boolean;
  isGeneratingWorkflow?: boolean;
}

function readinessLabel(unit: ProjectUnit): string {
  const completed = Object.values(unit.readiness).filter(Boolean).length;
  return `${completed}/6 ready`;
}

function toneForMatchLevel(matchLevel?: string) {
  if (matchLevel === "exact") return "bg-emerald-500/10 text-emerald-700 border-emerald-300/70";
  if (matchLevel === "family") return "bg-amber-500/10 text-amber-700 border-amber-300/70";
  return "bg-muted text-muted-foreground border-border";
}

function buildOrbitTopics(unit: ProjectUnit): Topic[] {
  const sheetTopics: Topic[] = unit.sheetSlugs.slice(0, 5).map((slug, index) => ({
    id: `sheet-${slug}`,
    name: slug,
    position: { x: 18 + ((index % 2) * 18), y: 22 + index * 12 },
    color: "#60A5FA",
    highlighted: true,
  }))

  const layoutTopics: Topic[] = unit.layoutPageNumbers.slice(0, 5).map((pageNumber, index) => ({
    id: `layout-${pageNumber}`,
    name: `Layout ${pageNumber}`,
    position: { x: 80 - ((index % 2) * 18), y: 22 + index * 12 },
    color: "#F59E0B",
    highlighted: true,
  }))

  const readinessTopics: Topic[] = [
    { key: "Build Up", value: unit.readiness.buildUp, x: 50, y: 14 },
    { key: "Wire", value: unit.readiness.wire, x: 18, y: 72 },
    { key: "Box Build", value: unit.readiness.boxBuild, x: 82, y: 72 },
    { key: "Cross Wire", value: unit.readiness.crossWire, x: 50, y: 86 },
  ].map((entry) => ({
    id: `readiness-${entry.key}`,
    name: entry.key,
    position: { x: entry.x, y: entry.y },
    color: entry.value ? "#34D399" : "#A1A1AA",
    highlighted: entry.value,
  }))

  return [...sheetTopics, ...layoutTopics, ...readinessTopics]
}

export function ProjectInitializationWorkspace({
  project,
  unitsPayload,
  onSaveUnits,
  onGenerateWorkflow,
  onContinueToProject,
  layoutPages,
  isSaving = false,
  isGeneratingWorkflow = false,
}: ProjectInitializationWorkspaceProps) {
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("board");
  const [units, setUnits] = useState<ProjectUnit[]>(unitsPayload.document.units);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unitsPayload.document.units[0]?.id ?? null);

  useEffect(() => {
    setUnits(unitsPayload.document.units);
    setSelectedUnitId((current) => {
      if (current && unitsPayload.document.units.some((unit) => unit.id === current)) {
        return current;
      }
      return unitsPayload.document.units[0]?.id ?? null;
    });
  }, [unitsPayload]);

  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? units[0] ?? null;
  const detectionSummary = unitsPayload.summary;
  const isDetected = unitsPayload.source === "detected";

  const totalLinkedSheets = useMemo(
    () => units.reduce((sum, unit) => sum + unit.sheetSlugs.length, 0),
    [units],
  );

  const totalLinkedPages = useMemo(
    () => units.reduce((sum, unit) => sum + unit.layoutPageNumbers.length, 0),
    [units],
  );

  const allOperationalSheets = useMemo(
    () => project.sheets.filter((sheet) => sheet.kind === "operational"),
    [project.sheets],
  );

  const assignedSheetSlugs = useMemo(
    () => new Set(units.flatMap((unit) => unit.sheetSlugs)),
    [units],
  );

  const assignedLayoutPages = useMemo(
    () => new Set(units.flatMap((unit) => unit.layoutPageNumbers)),
    [units],
  );

  const unassignedSheets = useMemo(
    () => allOperationalSheets.filter((sheet) => !assignedSheetSlugs.has(sheet.slug)),
    [allOperationalSheets, assignedSheetSlugs],
  );

  const unassignedLayoutPages = useMemo(
    () => layoutPages.filter((page) => !assignedLayoutPages.has(page.pageNumber)),
    [assignedLayoutPages, layoutPages],
  );

  function updateUnit(unitId: string, updater: (unit: ProjectUnit) => ProjectUnit) {
    setUnits((current) =>
      current.map((unit) => {
        if (unit.id !== unitId) {
          return unit;
        }

        const updated = updater(unit);
        const icon = resolveUnitTypeIcon({
          unitType: updated.unitType,
          lwc: updated.lwc ?? (project.lwcType ? String(project.lwcType) : null),
          state: updated.visualState ?? "closed",
          doorCount: updated.doorCount ?? null,
        });

        return {
          ...updated,
          lwc: updated.lwc ?? icon.lwc,
          visualState: updated.visualState ?? icon.state,
          doorCount: updated.doorCount ?? icon.doors,
          icon,
        };
      }),
    );
  }

  function createDefaultBinding(unitId: string, sheetSlug: string) {
    const sheet = allOperationalSheets.find((entry) => entry.slug === sheetSlug)
    const haystack = `${sheetSlug} ${sheet?.name ?? ""}`.toUpperCase()
    if (haystack.includes("RAIL")) {
      return { unitId, roleInUnit: "rail" as const, workType: "build-up" as const }
    }
    if (haystack.includes("COMP")) {
      return { unitId, roleInUnit: "component" as const, workType: "build-up" as const }
    }
    if (haystack.includes("BOX") || haystack.includes("DOOR") || haystack.includes("JB")) {
      return { unitId, roleInUnit: "box" as const, workType: sheet?.rowCount ? "wire" as const : "build-up" as const }
    }
    return { unitId, roleInUnit: "panel" as const, workType: sheet?.rowCount ? "wire" as const : "build-up" as const }
  }

  function moveSheetToUnit(sheetSlug: string, targetUnitId: string) {
    setUnits((current) => {
      let preservedBinding: SheetUnitBinding | undefined
      const next = current.map((unit) => {
        const hasSheet = unit.sheetSlugs.includes(sheetSlug)
        if (!hasSheet) {
          return unit
        }
        preservedBinding = unit.sheetBindings?.[sheetSlug]
        const nextBindings = { ...(unit.sheetBindings ?? {}) }
        delete nextBindings[sheetSlug]
        return {
          ...unit,
          sheetSlugs: unit.sheetSlugs.filter((slug) => slug !== sheetSlug),
          sheetBindings: nextBindings,
          primaryBoxSheetSlug: unit.primaryBoxSheetSlug === sheetSlug ? undefined : unit.primaryBoxSheetSlug,
        }
      }).map((unit) => {
        if (unit.id !== targetUnitId) {
          return unit
        }
        return {
          ...unit,
          sheetSlugs: Array.from(new Set([...unit.sheetSlugs, sheetSlug])),
          sheetBindings: {
            ...(unit.sheetBindings ?? {}),
            [sheetSlug]: {
              ...(preservedBinding ?? createDefaultBinding(unit.id, sheetSlug)),
              unitId: unit.id,
            },
          },
        }
      })
      return next
    })
  }

  function moveLayoutToUnit(pageNumber: number, targetUnitId: string) {
    setUnits((current) =>
      current.map((unit) => ({
        ...unit,
        layoutPageNumbers: unit.id === targetUnitId
          ? Array.from(new Set([...unit.layoutPageNumbers.filter((value) => value !== pageNumber), pageNumber])).sort((a, b) => a - b)
          : unit.layoutPageNumbers.filter((value) => value !== pageNumber),
      })),
    )
  }

  function splitSheetIntoNewUnit(unitId: string, sheetSlug: string) {
    const sourceUnit = units.find((unit) => unit.id === unitId)
    if (!sourceUnit) return
    const binding = sourceUnit.sheetBindings?.[sheetSlug] ?? createDefaultBinding(unitId, sheetSlug)
    const newUnitType = `${sourceUnit.unitType}-${sourceUnit.sheetSlugs.filter((slug) => slug !== sheetSlug).length + 1}`
    const icon = resolveUnitTypeIcon({
      unitType: newUnitType,
      lwc: sourceUnit.lwc ?? (project.lwcType ? String(project.lwcType) : null),
      state: sourceUnit.visualState ?? "closed",
      doorCount: sourceUnit.doorCount ?? null,
    })

    setUnits((current) => {
      const next = current.map((unit) => {
        if (unit.id !== unitId) return unit
        const nextBindings = { ...(unit.sheetBindings ?? {}) }
        delete nextBindings[sheetSlug]
        return {
          ...unit,
          sheetSlugs: unit.sheetSlugs.filter((slug) => slug !== sheetSlug),
          sheetBindings: nextBindings,
          primaryBoxSheetSlug: unit.primaryBoxSheetSlug === sheetSlug ? undefined : unit.primaryBoxSheetSlug,
        }
      })
      next.push({
        id: `unit-${newUnitType.toLowerCase()}`,
        unitType: newUnitType,
        label: newUnitType,
        lwc: icon.lwc,
        doorCount: icon.doors,
        visualState: icon.state,
        layoutPageNumbers: [],
        sheetSlugs: [sheetSlug],
        sheetBindings: {
          [sheetSlug]: {
            unitId: `unit-${newUnitType.toLowerCase()}`,
            roleInUnit: binding.roleInUnit,
            workType: binding.workType,
          },
        },
        primaryBoxSheetSlug: binding.roleInUnit === "box" ? sheetSlug : undefined,
        status: "draft",
        readiness: {
          buildUp: false,
          wire: false,
          boxBuild: false,
          hang: false,
          crossWire: false,
          brandingMeasure: false,
        },
        buildSequence: ["build-up", "wire", "box-build", "hang", "cross-wire", "branding-measure"],
        icon,
        source: "manual",
      })
      return next
    })
    setSelectedUnitId(`unit-${newUnitType.toLowerCase()}`)
  }

  function mergeSelectedInto(targetUnitId: string) {
    if (!selectedUnit || selectedUnit.id === targetUnitId) return
    const targetUnit = units.find((unit) => unit.id === targetUnitId)
    if (!targetUnit) return

    const mergedBindings = {
      ...(targetUnit.sheetBindings ?? {}),
      ...Object.fromEntries(
        Object.entries(selectedUnit.sheetBindings ?? {}).map(([sheetSlug, binding]) => [
          sheetSlug,
          {
            ...binding,
            unitId: targetUnitId,
          },
        ]),
      ),
    }

    setUnits((current) =>
      current
        .filter((unit) => unit.id !== selectedUnit.id)
        .map((unit) => {
          if (unit.id !== targetUnitId) {
            return unit
          }
          return {
            ...unit,
            sheetSlugs: Array.from(new Set([...unit.sheetSlugs, ...selectedUnit.sheetSlugs])).sort((a, b) => a.localeCompare(b)),
            layoutPageNumbers: Array.from(new Set([...unit.layoutPageNumbers, ...selectedUnit.layoutPageNumbers])).sort((a, b) => a - b),
            sheetBindings: mergedBindings,
            primaryBoxSheetSlug: unit.primaryBoxSheetSlug ?? selectedUnit.primaryBoxSheetSlug,
          }
        }),
    )
    setSelectedUnitId(targetUnitId)
  }

  async function handleSave() {
    await onSaveUnits(units);
  }

  async function handleGenerateWorkflow() {
    await onGenerateWorkflow(units);
  }

  function handleDragStart(kind: "sheet" | "layout", value: string) {
    return {
      draggable: true,
      onDragStart: (event: React.DragEvent) => {
        event.dataTransfer.setData("application/json", JSON.stringify({ kind, value }));
      },
    }
  }

  function handleUnitDrop(unitId: string, event: React.DragEvent) {
    event.preventDefault();
    try {
      const raw = event.dataTransfer.getData("application/json");
      const payload = JSON.parse(raw) as { kind?: "sheet" | "layout"; value?: string };
      if (payload.kind === "sheet" && payload.value) {
        moveSheetToUnit(payload.value, unitId);
      }
      if (payload.kind === "layout" && payload.value) {
        moveLayoutToUnit(Number(payload.value), unitId);
      }
    } catch {
      // Ignore invalid drags
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-3xl border bg-card/90 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-700 hover:bg-amber-500/15">
                  Project Initialization
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {project.pdNumber ?? project.id}
                </Badge>
                {project.lwcType ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {String(project.lwcType)}
                  </Badge>
                ) : null}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">
                  Start with detected unit cards, lightly adjust anything ambiguous, then generate the unit-first workflow.
                  The layout and measurement flow can grow from this without bringing back the old sheet-by-sheet setup modal.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => {
                  if (value === "board" || value === "orbit") {
                    setViewMode(value);
                  }
                }}
                className="rounded-2xl border bg-background/70 p-1"
              >
                <ToggleGroupItem value="board" className="gap-2 rounded-xl px-4">
                  <LayoutGrid className="h-4 w-4" />
                  Board
                </ToggleGroupItem>
                <ToggleGroupItem value="orbit" className="gap-2 rounded-xl px-4">
                  <Orbit className="h-4 w-4" />
                  Orbit
                </ToggleGroupItem>
              </ToggleGroup>

              <Button variant="outline" className="rounded-2xl" onClick={onContinueToProject}>
                Open Project
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl gap-2"
                onClick={handleGenerateWorkflow}
                disabled={isGeneratingWorkflow}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isGeneratingWorkflow ? "Generating..." : "Generate Workflow"}
              </Button>
              <Button className="rounded-2xl gap-2" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Save className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                Save Units
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card className="rounded-2xl border-border/70 py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <Boxes className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Units</p>
                  <p className="text-xl font-semibold">{units.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/70 py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <FileSpreadsheet className="h-5 w-5 text-sky-600" />
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Linked Sheets</p>
                  <p className="text-xl font-semibold">{totalLinkedSheets}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/70 py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <PanelRight className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Layout Pages</p>
                  <p className="text-xl font-semibold">{totalLinkedPages}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/70 py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Detection</p>
                  <p className="text-sm font-medium">
                    {isDetected ? "Draft suggestions ready" : "Saved unit model"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === "board" ? (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]"
            >
              <Card className="rounded-3xl border-border/70 py-0">
                <CardHeader className="border-b pb-4">
                  <CardTitle>Unit Cards</CardTitle>
                  <CardDescription>
                    Start here. Select a unit, confirm the icon and labeling, then move on if it looks right.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {units.map((unit) => (
                    <motion.button
                      key={unit.id}
                      type="button"
                      layout
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedUnitId(unit.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleUnitDrop(unit.id, event)}
                      className={cn(
                        "w-full rounded-2xl border bg-background/70 p-4 text-left transition-all",
                        selectedUnit?.id === unit.id
                          ? "border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                          : "border-border/70 hover:border-amber-300/50 hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted/40">
                          {unit.icon?.iconPath ? (
                            <img src={unit.icon.iconPath} alt={unit.unitType} className="max-h-16 max-w-16 object-contain" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold">{unit.label}</p>
                            <Badge variant="outline" className="rounded-full px-2 py-0.5">
                              {unit.unitType}
                            </Badge>
                            <Badge className={cn("rounded-full border px-2 py-0.5 text-xs", toneForMatchLevel(unit.icon?.matchLevel))}>
                              {unit.icon?.matchLevel ?? "generic"} icon
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>{unit.sheetSlugs.length} sheets</div>
                            <div>{unit.layoutPageNumbers.length} layouts</div>
                            <div>{unit.visualState}</div>
                            <div>{unit.doorCount ?? 0} doors</div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{readinessLabel(unit)}</span>
                            {unit.primaryBoxSheetSlug ? (
                              <Badge variant="secondary" className="rounded-full px-2 py-0.5">
                                Primary: {unit.primaryBoxSheetSlug}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}

                  {(detectionSummary.unmatchedSheetSlugs.length > 0 || detectionSummary.unmatchedPageNumbers.length > 0) ? (
                    <div className="rounded-2xl border border-dashed border-amber-300/80 bg-amber-500/5 p-4 text-sm">
                      <div className="flex items-center gap-2 font-medium text-amber-700">
                        <Sparkles className="h-4 w-4" />
                        Review queue
                      </div>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>{detectionSummary.unmatchedSheetSlugs.length} unmatched sheets</p>
                        <p>{detectionSummary.unmatchedPageNumbers.length} unmatched layout pages</p>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card className="rounded-3xl border-border/70 py-0">
                  <CardHeader className="border-b pb-4">
                    <CardTitle>Selected Unit</CardTitle>
                    <CardDescription>
                      Keep the first version fast: label, visual state, and the items currently grouped into this unit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    {selectedUnit ? (
                      <div className="space-y-6">
                        <div className="flex flex-col gap-5 rounded-3xl border bg-muted/20 p-5 lg:flex-row lg:items-center">
                          <div className="flex h-32 w-full items-center justify-center rounded-3xl bg-background sm:w-44">
                            {selectedUnit.icon?.iconPath ? (
                              <img
                                src={selectedUnit.icon.iconPath}
                                alt={selectedUnit.unitType}
                                className="max-h-24 max-w-32 object-contain"
                              />
                            ) : null}
                          </div>
                          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Label
                              </label>
                              <Input
                                value={selectedUnit.label}
                                onChange={(event) =>
                                  updateUnit(selectedUnit.id, (unit) => ({
                                    ...unit,
                                    label: event.target.value,
                                  }))
                                }
                                className="rounded-2xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Visual State
                              </label>
                              <ToggleGroup
                                type="single"
                                value={selectedUnit.visualState}
                                onValueChange={(value) => {
                                  if (!value) return;
                                  updateUnit(selectedUnit.id, (unit) => ({
                                    ...unit,
                                    visualState: value as ProjectUnitVisualState,
                                  }))
                                }}
                                className="justify-start rounded-2xl border bg-background/80 p-1"
                              >
                                <ToggleGroupItem value="closed" className="rounded-xl px-3 text-xs">
                                  Closed
                                </ToggleGroupItem>
                                <ToggleGroupItem value="open" className="rounded-xl px-3 text-xs">
                                  Open
                                </ToggleGroupItem>
                                <ToggleGroupItem value="hanged" className="rounded-xl px-3 text-xs">
                                  Hanged
                                </ToggleGroupItem>
                              </ToggleGroup>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Merge Into
                              </label>
                              <Select onValueChange={mergeSelectedInto}>
                                <SelectTrigger className="w-full rounded-2xl">
                                  <SelectValue placeholder="Select target unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {units.filter((unit) => unit.id !== selectedUnit.id).map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="rounded-2xl border bg-background/70 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sheets</p>
                              <div className="mt-3 space-y-2">
                                {selectedUnit.sheetSlugs.length > 0 ? selectedUnit.sheetSlugs.map((slug) => {
                                  const binding = selectedUnit.sheetBindings?.[slug] ?? createDefaultBinding(selectedUnit.id, slug)
                                  return (
                                    <div
                                      key={slug}
                                      {...handleDragStart("sheet", slug)}
                                      className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-3 sm:flex-row sm:items-center"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{slug}</p>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          <Button
                                            type="button"
                                            variant={selectedUnit.primaryBoxSheetSlug === slug ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 rounded-full px-3 text-xs"
                                            onClick={() =>
                                              updateUnit(selectedUnit.id, (unit) => ({
                                                ...unit,
                                                primaryBoxSheetSlug: slug,
                                              }))
                                            }
                                          >
                                            Primary Box
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 rounded-full px-3 text-xs"
                                            onClick={() => splitSheetIntoNewUnit(selectedUnit.id, slug)}
                                          >
                                            Split
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <Select
                                          value={binding.roleInUnit}
                                          onValueChange={(value) =>
                                            updateUnit(selectedUnit.id, (unit) => ({
                                              ...unit,
                                              sheetBindings: {
                                                ...(unit.sheetBindings ?? {}),
                                                [slug]: {
                                                  ...(unit.sheetBindings?.[slug] ?? binding),
                                                  unitId: unit.id,
                                                  roleInUnit: value as typeof binding.roleInUnit,
                                                },
                                              },
                                            }))
                                          }
                                        >
                                          <SelectTrigger size="sm" className="w-full rounded-xl">
                                            <SelectValue placeholder="Role" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="box">Box</SelectItem>
                                            <SelectItem value="panel">Panel</SelectItem>
                                            <SelectItem value="rail">Rail</SelectItem>
                                            <SelectItem value="component">Component</SelectItem>
                                            <SelectItem value="cross-wire">Cross-Wire</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={binding.workType}
                                          onValueChange={(value) =>
                                            updateUnit(selectedUnit.id, (unit) => ({
                                              ...unit,
                                              sheetBindings: {
                                                ...(unit.sheetBindings ?? {}),
                                                [slug]: {
                                                  ...(unit.sheetBindings?.[slug] ?? binding),
                                                  unitId: unit.id,
                                                  workType: value as typeof binding.workType,
                                                },
                                              },
                                            }))
                                          }
                                        >
                                          <SelectTrigger size="sm" className="w-full rounded-xl">
                                            <SelectValue placeholder="Work type" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="build-up">Build-Up</SelectItem>
                                            <SelectItem value="wire">Wire</SelectItem>
                                            <SelectItem value="cross-wire">Cross-Wire</SelectItem>
                                            <SelectItem value="branding">Branding</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )
                                }) : <span className="text-sm text-muted-foreground">No sheets grouped yet</span>}
                              </div>
                            </div>
                            <div className="rounded-2xl border bg-background/70 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Layout Pages</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {selectedUnit.layoutPageNumbers.length > 0 ? selectedUnit.layoutPageNumbers.map((pageNumber) => (
                                  <Badge
                                    key={pageNumber}
                                    variant="outline"
                                    className="rounded-full px-3 py-1"
                                    {...handleDragStart("layout", String(pageNumber))}
                                  >
                                    Page {pageNumber}
                                  </Badge>
                                )) : <span className="text-sm text-muted-foreground">No layouts grouped yet</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <Card className="rounded-2xl border-border/70 py-0">
                            <CardContent className="p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Primary Box</p>
                              <p className="mt-2 text-sm font-medium">
                                {selectedUnit.primaryBoxSheetSlug ?? "Not assigned yet"}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="rounded-2xl border-border/70 py-0">
                            <CardContent className="p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Workflow</p>
                              <p className="mt-2 text-sm font-medium">{selectedUnit.buildSequence.join(" → ")}</p>
                            </CardContent>
                          </Card>
                          <Card className="rounded-2xl border-border/70 py-0">
                            <CardContent className="p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                              <p className="mt-2 text-sm font-medium capitalize">{selectedUnit.status.replace(/_/g, " ")}</p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
                        No units detected yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-border/70 py-0">
                  <CardHeader className="border-b pb-4">
                    <CardTitle>Inventory + Actions</CardTitle>
                    <CardDescription>
                      Drag unassigned sheets or layouts onto a unit card. The generated workflow will persist unit bindings into sheet schemas and create assignment mappings from units.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-3 rounded-2xl border bg-background/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Unassigned Sheets</p>
                      <div className="flex flex-wrap gap-2">
                        {unassignedSheets.length > 0 ? unassignedSheets.map((sheet) => (
                          <Badge
                            key={sheet.slug}
                            variant="secondary"
                            className="cursor-grab rounded-full px-3 py-1"
                            {...handleDragStart("sheet", sheet.slug)}
                          >
                            {sheet.slug}
                          </Badge>
                        )) : <span className="text-sm text-muted-foreground">All operational sheets are assigned.</span>}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border bg-background/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Unassigned Layouts</p>
                      <div className="flex flex-wrap gap-2">
                        {unassignedLayoutPages.length > 0 ? unassignedLayoutPages.map((page) => (
                          <Badge
                            key={page.pageNumber}
                            variant="outline"
                            className="cursor-grab rounded-full px-3 py-1"
                            {...handleDragStart("layout", String(page.pageNumber))}
                          >
                            Page {page.pageNumber}
                          </Badge>
                        )) : <span className="text-sm text-muted-foreground">All layouts are assigned.</span>}
                      </div>
                    </div>

                    {[
                      "Drag inventory onto unit cards to organize units with minimal clicks.",
                      "Use role and work-type controls on each sheet to define the unit-first workflow.",
                      "Generate workflow to persist unit bindings and replace the old first-time SWS setup path.",
                    ].map((line, index) => (
                      <div key={line} className="flex gap-3 rounded-2xl border bg-background/70 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-700">
                          {index + 1}
                        </div>
                        <p className="text-sm text-muted-foreground">{line}</p>
                      </div>
                    ))}

                    <div className="rounded-2xl bg-emerald-500/8 p-4 text-sm text-emerald-800">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Stronger production model
                      </div>
                      <p className="mt-2 text-emerald-900/80">
                        Units now become the stable object that can later own layouts, assignments, cross-wire readiness,
                        and grouped measurement reuse.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="orbit"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <Card className="rounded-3xl border-border/70 py-0">
                <CardHeader className="border-b pb-4">
                  <CardTitle>Orbit View</CardTitle>
                  <CardDescription>
                    Alternate operationship view for the selected unit. Useful for orientation and dependency scanning, not a replacement for the core board.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 p-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-3xl border bg-muted/20 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background">
                          {selectedUnit?.icon?.iconPath ? (
                            <img src={selectedUnit.icon.iconPath} alt={selectedUnit.unitType} className="max-h-12 max-w-12 object-contain" />
                          ) : null}
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{selectedUnit?.label ?? "No unit selected"}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedUnit ? `${selectedUnit.sheetSlugs.length} sheets · ${selectedUnit.layoutPageNumbers.length} layouts` : "Select a unit from board view first"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {units.map((unit) => (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => setSelectedUnitId(unit.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                            selectedUnit?.id === unit.id
                              ? "border-amber-400 bg-amber-500/8"
                              : "border-border/70 bg-background/70 hover:bg-muted/30",
                          )}
                        >
                          <span className="font-medium">{unit.label}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border bg-black p-4">
                    {selectedUnit ? (
                      <div className="h-[560px]">
                        <RadialFlow
                          badgeName={selectedUnit.label}
                          topics={buildOrbitTopics(selectedUnit)}
                          centralDotColor="#FBBF24"
                        />
                      </div>
                    ) : (
                      <div className="flex h-[560px] items-center justify-center text-sm text-muted-foreground">
                        No unit selected
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sticky bottom-4 z-20">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-3xl border bg-background/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Minimal-step handoff</p>
              <p className="text-sm text-muted-foreground">
                Save the unit cards now. Assignment generation and grouped measuring can build on this persisted unit backbone next.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" className="rounded-2xl" onClick={onContinueToProject}>
                Open Project
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl gap-2"
                onClick={handleGenerateWorkflow}
                disabled={isGeneratingWorkflow}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isGeneratingWorkflow ? "Generating..." : "Generate Workflow"}
              </Button>
              <Button className="rounded-2xl gap-2" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />
                Save Units
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
