"use client";

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Minus,
  Printer,
  RefreshCw,
  Settings2,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  CrossWireSchema,
  CrossWireAssignmentGroup,
  CrossWireDestinationGroup,
  CrossWireUnitTypeGroup,
} from "@/lib/project-exports/cross-wire-schema";

// ============================================================================
// Constants
// ============================================================================

const PRINT_PAGE_WIDTH = 800;
const PRINT_PAGE_MIN_HEIGHT = 1120;
const PRINT_PAGE_FOOTER_TEXT = "Caterpillar: Confidential Green";

// ============================================================================
// Types
// ============================================================================

export interface CrossWirePrintWorkspaceProps {
  schema: CrossWireSchema;
  onRequestClose?: () => void;
  onRegenerateSchema?: () => Promise<void>;
  headerTitle?: string;
}

interface SectionVisibility {
  /** Set of `${unitType}:${sheetSlug}:${toLocation}` keys that are hidden. */
  hiddenDestinations: Set<string>;
  /** Set of `${unitType}:${sheetSlug}` keys for collapsed assignments. */
  collapsedAssignments: Set<string>;
}

// ============================================================================
// Helpers
// ============================================================================

function destinationKey(
  unitType: string,
  sheetSlug: string,
  toLocation: string,
): string {
  return `${unitType}::${sheetSlug}::${toLocation}`;
}

function assignmentKey(unitType: string, sheetSlug: string): string {
  return `${unitType}::${sheetSlug}`;
}

// ============================================================================
// PrintPage — identical to print-modal internal pattern
// ============================================================================

function PrintPage({
  children,
  className = "",
  footerText = PRINT_PAGE_FOOTER_TEXT,
  pageNumber,
  totalPages,
}: {
  children: ReactNode;
  className?: string;
  footerText?: string;
  pageNumber?: number;
  totalPages?: number;
}) {
  return (
    <section
      className={cn(
        "print-page mx-auto print:w-full rounded-md border border-black/10 bg-white print:shadow-none print:border-0 print:rounded-none print:mx-0",
        className,
      )}
    >
      <div
        className="print-page__inner flex w-full min-h-280 flex-col px-5 py-5 print:w-full print:min-h-0! print:px-4"
        style={{ minWidth: `${PRINT_PAGE_WIDTH}px`, minHeight: `${PRINT_PAGE_MIN_HEIGHT}px` }}
      >
        <div className="print-page__content flex-1 pb-4">{children}</div>
        <div className="print-footer flex items-center justify-between text-[10px] text-muted-foreground border-t border-foreground/20 pt-3 mt-4">
          <span>{footerText}</span>
          <span className="font-medium text-muted-foreground">
            {pageNumber && totalPages ? `Page ${pageNumber} of ${totalPages}` : ""}
          </span>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CrossWireCoverPage
// ============================================================================

function CrossWireCoverPage({
  schema,
  pageNumber,
  totalPages,
}: {
  schema: CrossWireSchema;
  pageNumber: number;
  totalPages: number;
}) {
  const { projectInfo } = schema;
  const now = new Date();
  return (
    <PrintPage
      className="print-cover-page shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
      pageNumber={pageNumber}
      totalPages={totalPages}
    >
      <div className="flex flex-col items-center py-12 px-4 w-full">
        {/* Logo */}
        <div className="mb-8 flex justify-center w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/SolarTurbines-Light.svg"
            alt="Solar Turbines"
            className="h-20 w-auto"
          />
        </div>

        {/* Title */}
        <div className="space-y-2 mb-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground/80">
            Cross Wire List
          </h2>
          <p className="text-base text-muted-foreground">
            External Connection Reference
          </p>
        </div>

        {/* Project info card */}
        <div className="border border-border rounded-lg p-8 bg-muted/10 w-full max-w-112.5 space-y-4">
          {projectInfo.projectNumber && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">PD Number:</span>
              <span className="text-sm font-semibold font-mono">{projectInfo.projectNumber}</span>
            </div>
          )}
          {projectInfo.unitNumber && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">Unit Number:</span>
              <span className="text-sm font-semibold">{projectInfo.unitNumber}</span>
            </div>
          )}
          {projectInfo.projectName && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">Project Name:</span>
              <span className="text-sm font-semibold">{projectInfo.projectName}</span>
            </div>
          )}
          {projectInfo.revision && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">Revision:</span>
              <span className="text-sm font-semibold">{projectInfo.revision}</span>
            </div>
          )}
          <div className="flex justify-between items-center border-b border-border/30 pb-3">
            <span className="text-sm font-medium text-muted-foreground">Total Cross-Wire Rows:</span>
            <span className="text-sm font-semibold tabular-nums">{schema.totalCrossWireRows}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Generated:</span>
            <span className="text-sm font-semibold">
              {now.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </div>
    </PrintPage>
  );
}

// ============================================================================
// Wire rows table
// ============================================================================

function CrossWireRowsTable({
  rows,
}: {
  rows: CrossWireDestinationGroup["rows"];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic px-1 py-2">
        No rows.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-[10.5px] print:text-[9.5px]">
      <thead>
        <tr className="border-b-2 border-foreground/30 bg-muted/40">
          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">From Device</th>
          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">Wire No.</th>
          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">Wire ID</th>
          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">Gauge</th>
          <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">Length</th>
          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">To Device</th>
          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">Bundle</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={`${row.fromDeviceId}-${row.wireNo}-${i}`}
            className={cn(
              "border-b border-foreground/10",
              i % 2 === 0 ? "bg-transparent" : "bg-muted/20",
            )}
          >
            <td className="px-2 py-1 font-mono text-[10px]">{row.fromDeviceId}</td>
            <td className="px-2 py-1">{row.wireNo}</td>
            <td className="px-2 py-1">{row.wireId}</td>
            <td className="px-2 py-1">{row.gaugeSize}</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {typeof row.length === "number" ? row.length.toFixed(1) : "—"}
            </td>
            <td className="px-2 py-1 font-mono text-[10px]">{row.toDeviceId}</td>
            <td className="px-2 py-1 text-muted-foreground text-[10px]">{row.bundleDisplay || row.bundleName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// Document (printable)
// ============================================================================

function CrossWirePrintDocument({
  schema,
  visibility,
  showCoverPage,
}: {
  schema: CrossWireSchema;
  visibility: SectionVisibility;
  showCoverPage: boolean;
}) {
  // Count visible pages to get total pages
  const visibleUnitTypeGroups = schema.unitTypeGroups.filter((ug) =>
    ug.assignments.some((ag) =>
      ag.destinationGroups.some(
        (dg) =>
          !visibility.hiddenDestinations.has(
            destinationKey(ug.unitType, ag.sheetSlug, dg.toLocation),
          ),
      ),
    ),
  );

  const totalPages =
    (showCoverPage ? 1 : 0) + Math.max(visibleUnitTypeGroups.length, 1);

  let pageCounter = showCoverPage ? 1 : 0;

  return (
    <div className="cross-wire-print-document space-y-6 print:space-y-0">
      {showCoverPage && (
        <CrossWireCoverPage
          schema={schema}
          pageNumber={1}
          totalPages={totalPages}
        />
      )}

      {visibleUnitTypeGroups.length === 0 ? (
        <PrintPage pageNumber={pageCounter + 1} totalPages={totalPages}>
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              All destinations are hidden. Use the Settings panel to show destinations.
            </p>
          </div>
        </PrintPage>
      ) : (
        visibleUnitTypeGroups.map((unitGroup) => {
          pageCounter += 1;
          return (
            <PrintPage
              key={unitGroup.unitType}
              pageNumber={pageCounter}
              totalPages={totalPages}
            >
              {/* Unit type header */}
              <div className="mb-5 pb-3 border-b-2 border-foreground/20">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Unit Type
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    {unitGroup.unitType}
                  </h2>
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {unitGroup.totalRows} wire{unitGroup.totalRows !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Assignments */}
              <div className="space-y-6">
                {unitGroup.assignments
                  .filter((ag) =>
                    ag.destinationGroups.some(
                      (dg) =>
                        !visibility.hiddenDestinations.has(
                          destinationKey(unitGroup.unitType, ag.sheetSlug, dg.toLocation),
                        ),
                    ),
                  )
                  .map((assignmentGroup) => {
                    const isCollapsed = visibility.collapsedAssignments.has(
                      assignmentKey(unitGroup.unitType, assignmentGroup.sheetSlug),
                    );

                    const visibleDestinations = assignmentGroup.destinationGroups.filter(
                      (dg) =>
                        !visibility.hiddenDestinations.has(
                          destinationKey(
                            unitGroup.unitType,
                            assignmentGroup.sheetSlug,
                            dg.toLocation,
                          ),
                        ),
                    );

                    return (
                      <div key={assignmentGroup.sheetSlug}>
                        {/* Assignment header */}
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-foreground/15">
                          <div className="h-1 w-3 bg-foreground/20 rounded-full shrink-0" />
                          <h3 className="text-[11px] font-semibold text-foreground tracking-wide">
                            {assignmentGroup.sheetName}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 font-normal shrink-0"
                          >
                            {assignmentGroup.unitType}
                          </Badge>
                          <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
                            {assignmentGroup.totalRows} row{assignmentGroup.totalRows !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Destination groups */}
                        {!isCollapsed && (
                          <div className="space-y-4 pl-3">
                            {visibleDestinations.map((destGroup) => (
                              <div key={destGroup.toLocation}>
                                {/* Destination header */}
                                <div className="flex items-center gap-1.5 mb-2">
                                  <ExternalLink className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span className="text-[10.5px] font-semibold text-foreground/80">
                                    {destGroup.toLocation}
                                  </span>
                                  {destGroup.resolvedAssignmentName && (
                                    <>
                                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                                      <span className="text-[10px] text-muted-foreground">
                                        {destGroup.resolvedAssignmentName}
                                      </span>
                                      {destGroup.resolvedUnitType && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[8.5px] h-3.5 px-1 font-normal"
                                        >
                                          {destGroup.resolvedUnitType}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                  <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
                                    {destGroup.rows.length}
                                  </span>
                                </div>

                                {/* Rows table */}
                                <CrossWireRowsTable rows={destGroup.rows} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </PrintPage>
          );
        })
      )}
    </div>
  );
}

// ============================================================================
// Settings panel
// ============================================================================

function SettingsPanel({
  schema,
  visibility,
  showCoverPage,
  onToggleCoverPage,
  onToggleDestination,
  onToggleAssignment,
  onToggleAllForUnitType,
  onRebuildBrandSchemas,
  isRebuildingBrandSchemas,
}: {
  schema: CrossWireSchema;
  visibility: SectionVisibility;
  showCoverPage: boolean;
  onToggleCoverPage: () => void;
  onToggleDestination: (unitType: string, sheetSlug: string, toLocation: string) => void;
  onToggleAssignment: (unitType: string, sheetSlug: string) => void;
  onToggleAllForUnitType: (unitType: string, show: boolean) => void;
  onRebuildBrandSchemas?: () => Promise<void>;
  isRebuildingBrandSchemas?: boolean;
}) {
  const [expandedUnitTypes, setExpandedUnitTypes] = useState<Set<string>>(
    () => new Set(schema.unitTypeGroups.map((g) => g.unitType)),
  );

  const toggleUnitTypeExpanded = useCallback((unitType: string) => {
    setExpandedUnitTypes((prev) => {
      const next = new Set(prev);
      if (next.has(unitType)) {
        next.delete(unitType);
      } else {
        next.add(unitType);
      }
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Settings
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-4">
          {/* Document options */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Document
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={showCoverPage}
                onCheckedChange={onToggleCoverPage}
                className="h-3.5 w-3.5"
              />
              <span className="text-sm">Cover Page</span>
            </label>
          </div>

          <Separator />

          {/* Missing schemas notice */}
          {schema.missingSchemas.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
              <div className="flex items-start gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold mb-0.5">{schema.missingSchemas.length} assignment{schema.missingSchemas.length !== 1 ? "s" : ""} missing sheet data</p>
                  <p className="text-amber-600/80 mb-2">
                    Sheet schemas must exist (run <code className="font-mono">legal:backfill</code>) before all cross-wire rows can appear. Brand list schemas add bundle enrichment but are optional.
                  </p>
                  {onRebuildBrandSchemas && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRebuildBrandSchemas}
                      disabled={isRebuildingBrandSchemas}
                      className="h-7 text-[11px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 w-full"
                    >
                      {isRebuildingBrandSchemas ? (
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1.5" />
                      )}
                      {isRebuildingBrandSchemas ? "Building schemas…" : "Build All & Refresh"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Unit type groups */}
          {schema.unitTypeGroups.map((unitGroup) => {
            const isExpanded = expandedUnitTypes.has(unitGroup.unitType);
            const allDestinationKeys = unitGroup.assignments.flatMap((ag) =>
              ag.destinationGroups.map((dg) =>
                destinationKey(unitGroup.unitType, ag.sheetSlug, dg.toLocation),
              ),
            );
            const allHidden = allDestinationKeys.every((k) =>
              visibility.hiddenDestinations.has(k),
            );
            const someHidden = allDestinationKeys.some((k) =>
              visibility.hiddenDestinations.has(k),
            );

            return (
              <div key={unitGroup.unitType}>
                {/* Unit type header row */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleUnitTypeExpanded(unitGroup.unitType)}
                    className="flex items-center gap-1 flex-1 min-w-0 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground truncate">
                      {unitGroup.unitType}
                    </span>
                    <span className="ml-1 text-[10px] text-muted-foreground tabular-nums shrink-0">
                      ({unitGroup.totalRows})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleAllForUnitType(unitGroup.unitType, allHidden)}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {allHidden ? "Show all" : someHidden ? "Show all" : "Hide all"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-1.5 ml-5 space-y-3">
                    {unitGroup.assignments.map((ag) => {
                      const aKey = assignmentKey(unitGroup.unitType, ag.sheetSlug);
                      const isCollapsed = visibility.collapsedAssignments.has(aKey);
                      const assignmentAllHidden = ag.destinationGroups.every((dg) =>
                        visibility.hiddenDestinations.has(
                          destinationKey(unitGroup.unitType, ag.sheetSlug, dg.toLocation),
                        ),
                      );

                      return (
                        <div key={ag.sheetSlug}>
                          {/* Assignment row */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button
                              type="button"
                              onClick={() => onToggleAssignment(unitGroup.unitType, ag.sheetSlug)}
                              className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                              title={isCollapsed ? "Expand in preview" : "Collapse in preview"}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "text-[11px] font-medium truncate flex-1",
                                assignmentAllHidden
                                  ? "text-muted-foreground/50 line-through"
                                  : "text-foreground",
                              )}
                            >
                              {ag.sheetName}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                              {ag.totalRows}
                            </span>
                          </div>

                          {/* Destination checkboxes */}
                          {!isCollapsed && (
                            <div className="ml-5 space-y-1.5">
                              {ag.destinationGroups.map((dg) => {
                                const dKey = destinationKey(
                                  unitGroup.unitType,
                                  ag.sheetSlug,
                                  dg.toLocation,
                                );
                                const isHidden = visibility.hiddenDestinations.has(dKey);

                                return (
                                  <label
                                    key={dg.toLocation}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={!isHidden}
                                      onCheckedChange={() =>
                                        onToggleDestination(
                                          unitGroup.unitType,
                                          ag.sheetSlug,
                                          dg.toLocation,
                                        )
                                      }
                                      className="h-3.5 w-3.5 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <span
                                        className={cn(
                                          "text-[11px] truncate block",
                                          isHidden
                                            ? "text-muted-foreground/50 line-through"
                                            : "text-foreground",
                                        )}
                                      >
                                        {dg.toLocation}
                                      </span>
                                      {dg.resolvedAssignmentName && (
                                        <span className="text-[9.5px] text-muted-foreground/70 truncate block">
                                          → {dg.resolvedAssignmentName}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                      {dg.rows.length}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <Separator className="mt-3" />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Main CrossWirePrintWorkspace
// ============================================================================

export function CrossWirePrintWorkspace({
  schema,
  onRequestClose,
  onRegenerateSchema,
  headerTitle = "Cross Wire List",
}: CrossWirePrintWorkspaceProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(90);
  const [showCoverPage, setShowCoverPage] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRebuildingBrandSchemas, setIsRebuildingBrandSchemas] = useState(false);

  const [visibility, setVisibility] = useState<SectionVisibility>(() => ({
    hiddenDestinations: new Set(),
    collapsedAssignments: new Set(),
  }));

  // -- Handlers --

  const handleToggleCoverPage = useCallback(() => {
    setShowCoverPage((prev) => !prev);
  }, []);

  const handleToggleDestination = useCallback(
    (unitType: string, sheetSlug: string, toLocation: string) => {
      const key = destinationKey(unitType, sheetSlug, toLocation);
      setVisibility((prev) => {
        const next = new Set(prev.hiddenDestinations);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return { ...prev, hiddenDestinations: next };
      });
    },
    [],
  );

  const handleToggleAssignment = useCallback(
    (unitType: string, sheetSlug: string) => {
      const key = assignmentKey(unitType, sheetSlug);
      setVisibility((prev) => {
        const next = new Set(prev.collapsedAssignments);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return { ...prev, collapsedAssignments: next };
      });
    },
    [],
  );

  const handleToggleAllForUnitType = useCallback(
    (unitType: string, show: boolean) => {
      const group = schema.unitTypeGroups.find((g) => g.unitType === unitType);
      if (!group) return;
      const keys = group.assignments.flatMap((ag) =>
        ag.destinationGroups.map((dg) =>
          destinationKey(unitType, ag.sheetSlug, dg.toLocation),
        ),
      );
      setVisibility((prev) => {
        const next = new Set(prev.hiddenDestinations);
        if (show) {
          for (const k of keys) next.delete(k);
        } else {
          for (const k of keys) next.add(k);
        }
        return { ...prev, hiddenDestinations: next };
      });
    },
    [schema.unitTypeGroups],
  );

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerateSchema) return;
    setIsRegenerating(true);
    try {
      await onRegenerateSchema();
    } finally {
      setIsRegenerating(false);
    }
  }, [onRegenerateSchema]);

  const handleRebuildBrandSchemas = useCallback(async () => {
    setIsRebuildingBrandSchemas(true);
    try {
      await fetch(
        `/api/projects/${encodeURIComponent(schema.projectId)}/wire-brand-list-schemas`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "all" }) },
      );
      // After rebuilding schemas, regenerate the cross wire schema and reload
      await fetch(
        `/api/projects/${encodeURIComponent(schema.projectId)}/cross-wire-schema`,
        { method: "POST" },
      );
      router.refresh();
    } finally {
      setIsRebuildingBrandSchemas(false);
    }
  }, [schema.projectId, router]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Cross Wire List - ${schema.projectInfo.projectNumber} Rev ${schema.projectInfo.revision}`,
  });

  // Visible row count
  const visibleRowCount = useMemo(() => {
    let total = 0;
    for (const ug of schema.unitTypeGroups) {
      for (const ag of ug.assignments) {
        for (const dg of ag.destinationGroups) {
          if (
            !visibility.hiddenDestinations.has(
              destinationKey(ug.unitType, ag.sheetSlug, dg.toLocation),
            )
          ) {
            total += dg.rows.length;
          }
        }
      }
    }
    return total;
  }, [schema.unitTypeGroups, visibility.hiddenDestinations]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        {onRequestClose && (
          <button
            type="button"
            onClick={onRequestClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <div className="h-4 w-px bg-border" />
        <h2 className="text-sm font-semibold text-foreground flex-1 truncate">
          {headerTitle}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {visibleRowCount} row{visibleRowCount !== 1 ? "s" : ""}
          </span>
          {onRegenerateSchema && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="h-8 text-xs"
            >
              {isRegenerating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Regenerate
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => handlePrint()}
            className="h-8 text-xs"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Settings sidebar */}
        <div className="w-64 shrink-0 border-r flex flex-col min-h-0">
          <SettingsPanel
            schema={schema}
            visibility={visibility}
            showCoverPage={showCoverPage}
            onToggleCoverPage={handleToggleCoverPage}
            onToggleDestination={handleToggleDestination}
            onToggleAssignment={handleToggleAssignment}
            onToggleAllForUnitType={handleToggleAllForUnitType}
            onRebuildBrandSchemas={handleRebuildBrandSchemas}
            isRebuildingBrandSchemas={isRebuildingBrandSchemas}
          />
        </div>

        {/* Preview area */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="h-7 w-7 p-0"
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
              {zoom}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="h-7 w-7 p-0"
              disabled={zoom >= 150}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(90)}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              Reset
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-xs text-muted-foreground">
              {schema.projectInfo.projectNumber}
              {schema.projectInfo.revision ? ` · Rev ${schema.projectInfo.revision}` : ""}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              Generated {new Date(schema.generatedAt).toLocaleString()}
            </span>
          </div>

          {/* Scrollable preview */}
          <div
            className="flex-1 overflow-auto bg-muted/20"
            style={{
              minWidth: `${PRINT_PAGE_WIDTH * (zoom / 100) + 96}px`,
              minHeight: `max(100%, ${PRINT_PAGE_MIN_HEIGHT * (zoom / 100) + 96}px)`,
            }}
          >
            <div
              style={{
                transformOrigin: "top center",
                transform: `scale(${zoom / 100})`,
                width: `${PRINT_PAGE_WIDTH}px`,
                margin: "48px auto",
              }}
            >
              {/* Hidden printable document */}
              <div ref={printRef} className="print:block print:m-0 print:p-0">
                <CrossWirePrintDocument
                  schema={schema}
                  visibility={visibility}
                  showCoverPage={showCoverPage}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
