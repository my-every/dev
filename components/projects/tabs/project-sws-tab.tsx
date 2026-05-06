"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Edit3,
  Eye,
  FileDown,
  Layers3,
  RotateCcw,
  Tablet,
  Printer,
  Plus,
  Trash2,
  GripVertical,
  Play,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";
import type { ManifestAssignment } from "@/types/project-manifest";
import { createDefaultAssignmentSwsConfig, type AssignmentSwsConfig, type SwsSectionEdit, type SwsWorkElementEdit } from "@/types/d380-assignment-sws";
import type { SwsExecutionMode, SwsTemplateId } from "@/types/d380-sws";
import { SwsWorksheetRenderer } from "@/components/d380/sws";
import { resolveSwsTemplateIdForAssignment } from "@/lib/sws/assignment-template-resolution";
import { SWS_TEMPLATE_REGISTRY } from "@/lib/sws/sws-template-registry";
import { useSession } from "@/hooks/use-session";
import { ProjectAssignmentMappingModal } from "@/components/projects/project-assignment-mapping-modal";
import { hasUploadedLegals } from "@/lib/projects/dashboard-status";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

type AssignmentCard = {
  slug: string;
  name: string;
  stage: string;
  status: string;
  swsType: string;
  rowCount: number;
  assignment: ManifestAssignment;
};

const LEAD_EDIT_ROLES = new Set(["TEAM_LEAD", "MANAGER", "SUPERVISOR", "DEVELOPER"]);

function normalize(value: string) {
  return value.replace(/[_-]+/g, " ").toUpperCase();
}

function templateSections(templateId: SwsTemplateId) {
  const template = SWS_TEMPLATE_REGISTRY[templateId];
  return template?.sections ?? [];
}

function reorderList(items: string[], activeId: string, overId: string) {
  const oldIndex = items.indexOf(activeId);
  const newIndex = items.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return items;
  const next = [...items];
  const [item] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, item);
  return next;
}

function DraggableRow({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={style}
      className={cn(className, isDragging && "opacity-60", isOver && "ring-1 ring-primary")}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

type ProjectSwsTabProps = ProjectTabProps & {
  initialSheetSlug?: string;
  initialMode?: SwsExecutionMode;
};

export function ProjectSwsTab({ project, onProjectRefresh, initialSheetSlug, initialMode }: ProjectSwsTabProps) {
  const { user } = useSession();
  const hasLegals = hasUploadedLegals(project);
  const canEdit = Boolean(user && LEAD_EDIT_ROLES.has(user.role));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "print" | "tablet">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [active, setActive] = useState<AssignmentCard | null>(null);
  const [activeMode, setActiveMode] = useState<SwsExecutionMode>("PRINT_MANUAL");
  const [config, setConfig] = useState<AssignmentSwsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [tabletBadge, setTabletBadge] = useState("");
  const [rebasePrompt, setRebasePrompt] = useState<{
    open: boolean;
    resolvedTemplateId: SwsTemplateId;
    currentTemplateId: SwsTemplateId;
  }>({ open: false, resolvedTemplateId: "PANEL_BUILD_WIRE", currentTemplateId: "PANEL_BUILD_WIRE" });

  const cards = useMemo<AssignmentCard[]>(() => {
    return Object.values(project.assignments ?? {})
      .filter((a): a is ManifestAssignment => a.kind === "operational")
      .map((assignment) => ({
        slug: assignment.sheetSlug,
        name: assignment.sheetName,
        stage: assignment.stage,
        status: assignment.status,
        swsType: String(assignment.swsType ?? "UNDECIDED"),
        rowCount: assignment.rowCount,
        assignment,
      }));
  }, [project.assignments]);
  const deepLinkHandledRef = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesQuery = !q || card.name.toLowerCase().includes(q) || card.slug.toLowerCase().includes(q) || card.swsType.toLowerCase().includes(q);
      if (!matchesQuery) return false;
      if (modeFilter === "all") return true;
      if (modeFilter === "print") return (config?.executionState?.activeMode ?? "PRINT_MANUAL") === "PRINT_MANUAL";
      return (config?.executionState?.activeMode ?? "PRINT_MANUAL") === "TABLET_INTERACTIVE";
    });
  }, [cards, config?.executionState?.activeMode, modeFilter, search]);

  async function loadSws(assignment: ManifestAssignment, executionMode?: SwsExecutionMode) {
    const url = `/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(assignment.sheetSlug)}/sws`;
    const res = await fetch(url, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || "Failed to load SWS");

    const nextConfig = payload.sws as AssignmentSwsConfig;
    const resolved = resolveSwsTemplateIdForAssignment(assignment) as SwsTemplateId;

    setConfig(nextConfig);
    setActiveMode(executionMode ?? nextConfig.executionState?.activeMode ?? "PRINT_MANUAL");
    setActive({ slug: assignment.sheetSlug, name: assignment.sheetName, stage: assignment.stage, status: assignment.status, swsType: String(assignment.swsType ?? "UNDECIDED"), rowCount: assignment.rowCount, assignment });
    setEditorOpen(true);

    if (nextConfig.templateId !== resolved) {
      setRebasePrompt({
        open: true,
        resolvedTemplateId: resolved,
        currentTemplateId: nextConfig.templateId as SwsTemplateId,
      });
    }
  }

  useEffect(() => {
    if (!initialSheetSlug) return;
    const deepLinkKey = `${project.id}:${initialSheetSlug}:${initialMode ?? "PRINT_MANUAL"}`;
    if (deepLinkHandledRef.current === deepLinkKey) return;
    const match = cards.find((card) => card.slug === initialSheetSlug);
    if (!match) return;
    deepLinkHandledRef.current = deepLinkKey;
    void loadSws(match.assignment, initialMode);
  }, [cards, initialMode, initialSheetSlug, project.id]);

  async function saveSws(next: AssignmentSwsConfig) {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(active.slug)}/sws`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sws: next }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to save");
      setConfig(payload.sws as AssignmentSwsConfig);
      await onProjectRefresh?.();
    } finally {
      setSaving(false);
    }
  }

  async function runRebaseChoice(choice: "keep" | "rebase" | "reset") {
    if (!active || !config) return;
    if (choice === "keep") {
      setRebasePrompt((p) => ({ ...p, open: false }));
      return;
    }

    if (choice === "rebase") {
      const template = SWS_TEMPLATE_REGISTRY[rebasePrompt.resolvedTemplateId];
      const next: AssignmentSwsConfig = {
        ...config,
        templateId: rebasePrompt.resolvedTemplateId,
        sectionOrder: template.sections.map((s) => s.id),
        sectionEdits: {},
        workElementEdits: {},
      };
      setConfig(next);
      await saveSws(next);
      setRebasePrompt((p) => ({ ...p, open: false }));
      return;
    }

    const reset = createDefaultAssignmentSwsConfig(rebasePrompt.resolvedTemplateId);
    const next: AssignmentSwsConfig = {
      ...reset,
      worksheetMetadata: config.worksheetMetadata,
      executionState: config.executionState,
      instanceVersion: (config.instanceVersion ?? 1) + 1,
    };
    setConfig(next);
    await saveSws(next);
    setRebasePrompt((p) => ({ ...p, open: false }));
  }

  async function setMode(mode: SwsExecutionMode) {
    if (!active) return;
    setActiveMode(mode);
    await fetch(`/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(active.slug)}/sws/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  }

  async function resetTemplate() {
    if (!active) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(active.slug)}/sws/reset`, { method: "POST" });
    const payload = await res.json();
    if (res.ok) {
      setConfig(payload.sws as AssignmentSwsConfig);
      await onProjectRefresh?.();
    }
  }

  function updateMetadata(field: string, value: string) {
    if (!config) return;
    setConfig({ ...config, worksheetMetadata: { ...(config.worksheetMetadata ?? {}), [field]: value } });
  }

  function updateSectionEdit(sectionId: string, patch: Partial<SwsSectionEdit>) {
    if (!config) return;
    const existing = config.sectionEdits?.[sectionId] ?? { sectionId };
    setConfig({
      ...config,
      sectionEdits: {
        ...(config.sectionEdits ?? {}),
        [sectionId]: { ...existing, ...patch, sectionId },
      },
    });
  }

  function addStep(sectionId: string) {
    if (!config) return;
    const id = `custom-${Date.now()}`;
    const section = config.sectionEdits?.[sectionId] ?? { sectionId };
    const added = [
      ...(section.addedWorkElements ?? []),
      { id, text: "New step", isKeyPoint: false, requiresCheckOff: true } as SwsWorkElementEdit,
    ];
    updateSectionEdit(sectionId, { addedWorkElements: added });
  }

  function deleteAddedStep(sectionId: string, stepId: string) {
    if (!config) return;
    const section = config.sectionEdits?.[sectionId];
    if (!section?.addedWorkElements) return;
    updateSectionEdit(sectionId, { addedWorkElements: section.addedWorkElements.filter((s) => s.id !== stepId) });
  }

  async function updateExecutionState(sectionId: string, action: "start" | "complete") {
    if (!active) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(active.slug)}/sws`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sectionId, badge: tabletBadge || undefined }),
    });
    const payload = await res.json();
    if (res.ok) {
      setConfig(payload.sws as AssignmentSwsConfig);
    }
  }

  async function toggleChecklist(sectionId: string, stepId: string, checked: boolean) {
    if (!active) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(active.slug)}/sws`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle-checklist", sectionId, stepId, checked, badge: tabletBadge || undefined }),
    });
    const payload = await res.json();
    if (res.ok) {
      setConfig(payload.sws as AssignmentSwsConfig);
    }
  }

  function onSectionDragEnd(event: DragEndEvent) {
    if (!config?.sectionOrder) return;
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;
    if (!config.sectionOrder.includes(activeId) || !config.sectionOrder.includes(overId)) return;
    setConfig({ ...config, sectionOrder: reorderList(config.sectionOrder, activeId, overId) });
  }

  function onRowDragEnd(sectionId: string, event: DragEndEvent) {
    if (!config) return;
    const section = config.sectionEdits?.[sectionId];
    if (!section?.addedWorkElements) return;
    const ids = section.addedWorkElements.map((item) => item.id);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || !ids.includes(activeId) || !ids.includes(overId)) return;

    const nextIds = reorderList(ids, activeId, overId);
    const map = new Map(section.addedWorkElements.map((item) => [item.id, item]));
    const nextRows = nextIds.map((id) => map.get(id)!).filter(Boolean);
    updateSectionEdit(sectionId, { addedWorkElements: nextRows });
  }

  const previewTemplateId = (config?.templateId ?? (active ? resolveSwsTemplateIdForAssignment(active.assignment) : "PANEL_BUILD_WIRE")) as SwsTemplateId;
  const sections = templateSections(previewTemplateId);

  if (!hasLegals) {
    return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Upload workbook/layout first. SWS workspace becomes available after legals are present.</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assignments by sheet/SWS..." className="h-9 max-w-sm" />
          <Tabs value={modeFilter} onValueChange={(v) => setModeFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="print">Print</TabsTrigger>
              <TabsTrigger value="tablet">Tablet</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setMappingOpen(true)}>
            <Layers3 className="mr-1 h-4 w-4" /> Mapping Utility
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <div key={card.slug} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold">{card.name}</div>
                <div className="text-xs text-muted-foreground">{card.slug} • {card.rowCount} rows</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="dot">{normalize(card.swsType)}</Badge>
                <Badge variant="dot">{normalize(String(card.stage))}</Badge>
                <Badge variant="dot">{normalize(String(card.status))}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void loadSws(card.assignment)}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => void loadSws(card.assignment, "TABLET_INTERACTIVE")}>
                  <Tablet className="mr-1 h-4 w-4" /> Execute Tablet
                </Button>
                <Button size="sm" variant="outline" onClick={() => void loadSws(card.assignment, "PRINT_MANUAL")}>
                  <Printer className="mr-1 h-4 w-4" /> Print
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-[96vw] w-[1600px] h-[90vh] overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {active ? <span className="text-sm font-normal text-muted-foreground">{active.name}</span> : null}
            </DialogTitle>
          </DialogHeader>

          <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[560px_minmax(0,1fr)]">
            <div className="border-r p-4 overflow-y-auto space-y-4">
              <div className="flex items-center gap-2">
                <Button size="sm" variant={activeMode === "PRINT_MANUAL" ? "primary" : "outline"} onClick={() => void setMode("PRINT_MANUAL")}> <Printer className="mr-1 h-4 w-4" /> Print </Button>
                <Button size="sm" variant={activeMode === "TABLET_INTERACTIVE" ? "primary" : "outline"} onClick={() => void setMode("TABLET_INTERACTIVE")}> <Tablet className="mr-1 h-4 w-4" /> Tablet </Button>
              </div>

              {activeMode === "TABLET_INTERACTIVE" ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Tablet Execution Stamps</div>
                  <Input value={tabletBadge} onChange={(e) => setTabletBadge(e.target.value)} placeholder="Badge (optional override)" className="h-8" />
                  <div className="space-y-2">
                    {(config?.sectionOrder ?? []).map((sectionId) => {
                      const section = sections.find((s) => s.id === sectionId);
                      const state = config?.executionState?.sectionStates?.find((s) => s.sectionId === sectionId);
                      const addedRows = config?.sectionEdits?.[sectionId]?.addedWorkElements ?? [];
                      return (
                        <div key={sectionId} className="rounded-md border p-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium">{section?.description ?? sectionId}</div>
                            <Badge variant="dot">{state?.status ?? "NOT_STARTED"}</Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground">Start: {state?.startTime ? new Date(state.startTime).toLocaleString() : "-"} • End: {state?.endTime ? new Date(state.endTime).toLocaleString() : "-"}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => void updateExecutionState(sectionId, "start")}> <Play className="mr-1 h-3 w-3" /> Start</Button>
                            <Button size="sm" variant="outline" onClick={() => void updateExecutionState(sectionId, "complete")}> <CheckCircle2 className="mr-1 h-3 w-3" /> Complete</Button>
                          </div>
                          <div className="space-y-1 pt-1">
                            {(section?.processSteps ?? []).map((step) => {
                              const checked = Boolean(state?.checklistState?.[step.id]);
                              return (
                                <label key={step.id} className="flex items-start gap-2 rounded border border-border/60 bg-background px-2 py-1.5 text-xs">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => void toggleChecklist(sectionId, step.id, Boolean(value))}
                                    className="mt-0.5"
                                  />
                                  <span className={cn(step.isKeyPoint && "font-semibold text-foreground")}>{step.text}</span>
                                </label>
                              );
                            })}
                            {addedRows.map((step) => {
                              const key = step.id;
                              const checked = Boolean(state?.checklistState?.[key]);
                              return (
                                <label key={key} className="flex items-start gap-2 rounded border border-border/60 bg-background px-2 py-1.5 text-xs">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => void toggleChecklist(sectionId, key, Boolean(value))}
                                    className="mt-0.5"
                                  />
                                  <span className={cn(step.isKeyPoint && "font-semibold text-foreground")}>{step.text || "Custom step"}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {config ? (
                <>
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Metadata</div>
                    <Input value={config.worksheetMetadata?.pdNumber ?? ""} onChange={(e) => updateMetadata("pdNumber", e.target.value)} placeholder="PD#" disabled={!canEdit} />
                    <Input value={config.worksheetMetadata?.projectName ?? ""} onChange={(e) => updateMetadata("projectName", e.target.value)} placeholder="Project" disabled={!canEdit} />
                    <Input value={config.worksheetMetadata?.unit ?? ""} onChange={(e) => updateMetadata("unit", e.target.value)} placeholder="Unit" disabled={!canEdit} />
                    <Input value={config.worksheetMetadata?.panel ?? ""} onChange={(e) => updateMetadata("panel", e.target.value)} placeholder="Panel/Box/Console" disabled={!canEdit} />
                    <Input value={config.worksheetMetadata?.revision ?? ""} onChange={(e) => updateMetadata("revision", e.target.value)} placeholder="Revision" disabled={!canEdit} />
                    <Input value={config.worksheetMetadata?.date ?? ""} onChange={(e) => updateMetadata("date", e.target.value)} placeholder="Date" disabled={!canEdit} />
                  </div>

                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Sections (drag to reorder)</div>
                      {!canEdit ? <Badge variant="dot">Read Only</Badge> : null}
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                      <div className="space-y-2">
                        {(config.sectionOrder ?? []).map((sectionId) => {
                          const section = sections.find((s) => s.id === sectionId);
                          const edit = config.sectionEdits?.[sectionId];
                          return (
                            <DraggableRow key={sectionId} id={sectionId} className="rounded-md border p-2 space-y-2">
                              <div className="flex items-center gap-2 text-muted-foreground"><GripVertical className="h-3.5 w-3.5" /><span className="text-xs font-medium">{section?.description ?? sectionId}</span></div>
                              <Input value={edit?.cycleTime ?? section?.cycleTime ?? ""} onChange={(e) => updateSectionEdit(sectionId, { cycleTime: e.target.value })} placeholder="Cycle time H:MM" disabled={!canEdit} />
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => updateSectionEdit(sectionId, { hidden: !(edit?.hidden ?? false) })} disabled={!canEdit}>{edit?.hidden ? "Show" : "Hide"}</Button>
                                <Button size="sm" variant="outline" onClick={() => addStep(sectionId)} disabled={!canEdit}><Plus className="mr-1 h-3 w-3" />Add Row</Button>
                              </div>
                              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onRowDragEnd(sectionId, event)}>
                                <div className="space-y-1">
                                  {(edit?.addedWorkElements ?? []).map((step) => (
                                    <DraggableRow key={step.id} id={step.id} className="flex items-center gap-2 rounded border p-1.5 bg-background">
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                      <Input value={step.text ?? ""} onChange={(e) => {
                                        const items = (edit?.addedWorkElements ?? []).map((entry) => entry.id === step.id ? { ...entry, text: e.target.value } : entry);
                                        updateSectionEdit(sectionId, { addedWorkElements: items });
                                      }} disabled={!canEdit} />
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteAddedStep(sectionId, step.id)} disabled={!canEdit}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </DraggableRow>
                                  ))}
                                </div>
                              </DndContext>
                            </DraggableRow>
                          );
                        })}
                      </div>
                    </DndContext>
                  </div>
                </>
              ) : null}

              <div className="flex gap-2">
                <Button onClick={() => config && void saveSws(config)} disabled={!config || !canEdit || saving}>{saving ? "Saving..." : "Save"}</Button>
                <Button variant="outline" onClick={() => void resetTemplate()} disabled={!canEdit}><RotateCcw className="mr-1 h-4 w-4" /> Reset from Template</Button>
                <Button variant="outline" onClick={() => window.print()}><FileDown className="mr-1 h-4 w-4" /> Print Preview</Button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto bg-muted/20">
              {config && active ? (
                <SwsWorksheetRenderer
                  swsType={previewTemplateId}
                  executionMode={activeMode}
                  metadata={{
                    pdNumber: config.worksheetMetadata?.pdNumber ?? project.pdNumber,
                    projectName: config.worksheetMetadata?.projectName ?? project.name,
                    unit: config.worksheetMetadata?.unit ?? project.unitNumber,
                    panel: config.worksheetMetadata?.panel,
                    box: config.worksheetMetadata?.box,
                    bays: config.worksheetMetadata?.bays,
                    date: config.worksheetMetadata?.date ?? new Date().toISOString().slice(0, 10),
                    revision: config.worksheetMetadata?.revision ?? project.revision,
                    swsIpvId: config.worksheetMetadata?.swsIpvId ?? previewTemplateId,
                    revLevel: config.worksheetMetadata?.revLevel ?? project.revision,
                    revDate: config.worksheetMetadata?.revDate ?? new Date().toISOString().slice(0, 10),
                  }}
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rebasePrompt.open} onOpenChange={(open) => setRebasePrompt((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>SWS Template Changed</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>Current worksheet template: <span className="font-medium text-foreground">{rebasePrompt.currentTemplateId}</span></div>
            <div>Mapped assignment template: <span className="font-medium text-foreground">{rebasePrompt.resolvedTemplateId}</span></div>
            <div>Choose how to handle this mismatch.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runRebaseChoice("keep")}>Keep Current</Button>
            <Button variant="outline" onClick={() => void runRebaseChoice("rebase")}>Rebase to Mapped</Button>
            <Button onClick={() => void runRebaseChoice("reset")}>Full Reset</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProjectAssignmentMappingModal
        isOpen={mappingOpen}
        onClose={() => setMappingOpen(false)}
        onSave={async () => {
          setMappingOpen(false);
          await onProjectRefresh?.();
        }}
        sheets={Object.values(project.assignments ?? {}) as any}
        projectName={project.name}
      />
    </>
  );
}
