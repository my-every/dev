"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentPreperationPrintOut } from "@/components/dashboard/assignment-preperation-print-out";
import { parseWorkbook } from "@/lib/workbook/parse-workbook";
import type { ParsedWorkbookSheet } from "@/lib/workbook/types";
import {
  FILTER_METADATA,
  applyIdentificationFilter,
  buildBlueLabelSequenceMatrix,
  buildRowsByNormalizedSheetName,
  parseBlueLabelSheet,
  type BlueLabelSequenceMap,
  type BlueLabelSequenceMatrixEntry,
  type IdentificationFilterKind,
} from "@/lib/wiring-identification";
import {
  buildCablePartNumberMap,
  buildPartNumberMap,
  type CablePartNumberLookupResult,
  type PartNumberLookupResult,
} from "@/lib/part-number-list";
import type { AssignmentPreparationQuickRefCard } from "@/components/dashboard/assignment-preperation-print-out";

interface DashboardMatrixResult {
  fileName: string;
  sheetName: string;
  entries: BlueLabelSequenceMatrixEntry[];
  warnings: string[];
  exportedPath?: string;
  rowsBySheet: Map<string, import("@/lib/workbook/types").SemanticWireListRow[]>;
  blueLabels: BlueLabelSequenceMap;
  partNumberMap: Map<string, PartNumberLookupResult>;
  cablePartNumberMap: Map<string, CablePartNumberLookupResult>;
}

interface AssignmentPreparationPrintPayload {
  fileName: string;
  sheetName: string;
  entries: BlueLabelSequenceMatrixEntry[];
  quickRefCards: AssignmentPreparationQuickRefCard[];
}

const QUICK_REF_FILTER_KINDS: IdentificationFilterKind[] = [
  "grounds",
  "clips",
  "jumpers",
  "af_jumpers",
  "xt_clips",
  "ka_jumpers",
  "ka_relay_plugin_jumpers",
  "ka_twin_ferrules",
  "kt_jumpers",
  "fu_jumpers",
  "vio_jumpers",
  "resistors",
  "cables",
];

function buildAfFamilyCards(
  kind: IdentificationFilterKind,
  filterResult: ReturnType<typeof applyIdentificationFilter>,
) {
  const getRowPrefix = (deviceId: string): string => (deviceId.split(":")[0] || "").trim().toUpperCase();

  const afAuRows = filterResult.rows.filter((row) => {
    const fromPrefix = getRowPrefix(row.fromDeviceId);
    const toPrefix = getRowPrefix(row.toDeviceId);
    return (fromPrefix === "AF" && toPrefix === "AU") || (fromPrefix === "AU" && toPrefix === "AF");
  });

  const afRows = filterResult.rows.filter((row) => {
    const fromPrefix = getRowPrefix(row.fromDeviceId);
    const toPrefix = getRowPrefix(row.toDeviceId);
    return fromPrefix === "AF" && toPrefix === "AF";
  });

  const mapRows = (sourceRows: typeof filterResult.rows) =>
    sourceRows.slice(0, 12).map((row) => {
      const metadata = filterResult.matchMetadata[row.__rowId];
      const resolvedWireType =
        String(row.wireType ?? "").trim() ||
        String(metadata?.meta?.runId ?? metadata?.meta?.cableType ?? "").trim();
      const instruction =
        metadata?.badge?.trim() ||
        String(
          metadata?.meta?.clipType ||
            metadata?.meta?.jumperType ||
            metadata?.meta?.signalType ||
            metadata?.meta?.warningDescription ||
            "Quick reference",
        );

      return {
        key: `${kind}:${row.__rowId}`,
        fromDeviceId: row.fromDeviceId,
        toDeviceId: row.toDeviceId,
        wireId: row.wireId,
        wireType: resolvedWireType,
        gaugeSize: row.gaugeSize,
        instruction,
      };
    });

  const cards: AssignmentPreparationQuickRefCard[] = [];

  if (afAuRows.length > 0) {
    cards.push({
      kind,
      title: "AF/AU Jumpers",
      instruction: "AF and AU identity jumpers (COM, SH, V+) - sequential devices",
      rows: mapRows(afAuRows),
    });
  }

  if (afRows.length > 0) {
    cards.push({
      kind,
      title: "AF Jumpers",
      instruction: "AF identity jumpers (COM, SH, V+) - sequential AF devices",
      rows: mapRows(afRows),
    });
  }

  return cards;
}

function findPartNumberListSheet(sheets: ParsedWorkbookSheet[]): ParsedWorkbookSheet | null {
  return (
    sheets.find((sheet) => sheet.originalName.trim().toUpperCase() === "PART NUMBER LIST") ??
    sheets.find((sheet) => sheet.originalName.toUpperCase().includes("PART NUMBER LIST")) ??
    sheets.find((sheet) => sheet.originalName.toUpperCase().includes("PARTS LIST")) ??
    null
  );
}

function findBlueLabelsSheet(sheets: ParsedWorkbookSheet[]): ParsedWorkbookSheet | null {
  return (
    sheets.find((sheet) => sheet.originalName.trim().toUpperCase() === "BLUE LABELS") ??
    sheets.find((sheet) => sheet.originalName.toUpperCase().includes("BLUE LABEL")) ??
    null
  );
}

function findCablePartNumbersSheet(sheets: ParsedWorkbookSheet[]): ParsedWorkbookSheet | null {
  return (
    sheets.find((sheet) => sheet.originalName.trim().toUpperCase() === "CABLE PART NUMBERS") ??
    sheets.find((sheet) => sheet.originalName.toUpperCase().includes("CABLE PART NUMBER")) ??
    null
  );
}

export function BlueLabelMatrixWidget() {
  const [selectedSheetTab, setSelectedSheetTab] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DashboardMatrixResult | null>(null);

  const sheetTabs = useMemo(() => {
    if (!result) return [] as string[];
    return Array.from(new Set(result.entries.map((entry) => entry.sheetName))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [result]);

  useEffect(() => {
    if (!selectedSheetTab && sheetTabs.length > 0) {
      setSelectedSheetTab(sheetTabs[0]);
    }
  }, [selectedSheetTab, sheetTabs]);

  const visibleEntries = useMemo(() => {
    if (!result) return [] as BlueLabelSequenceMatrixEntry[];
    if (!selectedSheetTab) return [];
    return result.entries.filter((entry) => entry.sheetName === selectedSheetTab);
  }, [result, selectedSheetTab]);

  const activeSheetRows = useMemo(() => {
    if (!result) return [] as import("@/lib/workbook/types").SemanticWireListRow[];
    if (!selectedSheetTab) return [];
    return result.rowsBySheet.get(selectedSheetTab) ?? [];
  }, [result, selectedSheetTab]);

  const quickRefCards = useMemo(() => {
    if (!result || activeSheetRows.length === 0) {
      return [] as AssignmentPreparationQuickRefCard[];
    }

    const targetSheet = selectedSheetTab;

    return QUICK_REF_FILTER_KINDS
      .flatMap((kind) => {
        const filterResult = applyIdentificationFilter(
          activeSheetRows,
          kind,
          result.blueLabels,
          targetSheet,
          result.partNumberMap,
          result.cablePartNumberMap,
        );

        if (filterResult.rows.length === 0) {
          return null;
        }

        if (kind === "af_jumpers") {
          return buildAfFamilyCards(kind, filterResult);
        }

        const rows = filterResult.rows.slice(0, 12).map((row) => {
          const metadata = filterResult.matchMetadata[row.__rowId];
          const resolvedWireType =
            String(row.wireType ?? "").trim() ||
            String(metadata?.meta?.runId ?? metadata?.meta?.cableType ?? "").trim();
          const instruction =
            metadata?.badge?.trim() ||
            String(
              metadata?.meta?.clipType ||
                metadata?.meta?.jumperType ||
                metadata?.meta?.signalType ||
                metadata?.meta?.warningDescription ||
                "Quick reference",
            );

          return {
            key: `${kind}:${row.__rowId}`,
            fromDeviceId: row.fromDeviceId,
            toDeviceId: row.toDeviceId,
            wireId: row.wireId,
            wireType: resolvedWireType,
            gaugeSize: row.gaugeSize,
            instruction,
          };
        });

        return {
          kind,
          title: FILTER_METADATA[kind].label,
          instruction: FILTER_METADATA[kind].description,
          rows,
        };
      })
      .flat()
      .filter((value): value is AssignmentPreparationQuickRefCard => Boolean(value));
  }, [activeSheetRows, result, selectedSheetTab]);

  async function processWorkbookFile(file: File) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const parseResult = await parseWorkbook(file);
      if (!parseResult.success || !parseResult.workbook) {
        setError(parseResult.errors.join("\n") || "Unable to parse workbook.");
        return;
      }

      const workbook = parseResult.workbook;
      const blueLabelsSheet = findBlueLabelsSheet(workbook.sheets);
      const partNumberListSheet = findPartNumberListSheet(workbook.sheets);
      const cablePartNumbersSheet = findCablePartNumbersSheet(workbook.sheets);

      if (!blueLabelsSheet) {
        setError("Blue Labels sheet was not found in this workbook.");
        return;
      }

      const blueLabels = parseBlueLabelSheet(blueLabelsSheet);
      const rowsBySheet = buildRowsByNormalizedSheetName(workbook.sheets, {
        excludeReferenceSheets: true,
      });
      const partNumberMap = buildPartNumberMap(partNumberListSheet);
      const cablePartNumberMap = buildCablePartNumberMap(cablePartNumbersSheet ?? partNumberListSheet);
      const entries = buildBlueLabelSequenceMatrix(blueLabels, { rowsBySheet, partNumberMap });

      if (entries.length === 0) {
        setError("No Blue Labels matrix entries were generated from the workbook.");
        return;
      }

      let exportedPath: string | undefined;
      try {
        const response = await fetch("/api/dashboard/blue-label-matrix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceFileName: file.name,
            blueLabelsSheetName: blueLabelsSheet.originalName,
            generatedAt: new Date().toISOString(),
            warnings: [...parseResult.warnings.map((w) => w.message), ...blueLabels.warnings],
            entries,
          }),
        });

        if (response.ok) {
          const body = (await response.json()) as { filePath?: string };
          exportedPath = body.filePath;
        }
      } catch {
        // Upload/render flow should still succeed if local export write fails.
      }

      setResult({
        fileName: file.name,
        sheetName: blueLabelsSheet.originalName,
        entries,
        warnings: [...parseResult.warnings.map((w) => w.message), ...blueLabels.warnings],
        exportedPath,
        rowsBySheet,
        blueLabels,
        partNumberMap,
        cablePartNumberMap,
      });
      const nextSheetTabs = Array.from(new Set(entries.map((entry) => entry.sheetName))).sort((a, b) =>
        a.localeCompare(b),
      );
      setSelectedSheetTab(nextSheetTabs[0] ?? "");
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "Unexpected parsing error.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    void processWorkbookFile(file);
    // Allow selecting the same file repeatedly.
    event.target.value = "";
  }

  function handlePrintPreview() {
    if (typeof window === "undefined") return;
    if (!result || !selectedSheetTab) return;

    const payload: AssignmentPreparationPrintPayload = {
      fileName: result.fileName,
      sheetName: selectedSheetTab,
      entries: visibleEntries,
      quickRefCards,
    };

    const payloadKey = `assignment-prep-print:${Date.now()}:${selectedSheetTab}`;
    window.sessionStorage.setItem(payloadKey, JSON.stringify(payload));

  const encodedProjectId = encodeURIComponent("assignment-prep");
  const encodedSheetSlug = encodeURIComponent(selectedSheetTab);
    const encodedPayloadKey = encodeURIComponent(payloadKey);
  const printRoute = `/print/project-context/${encodedProjectId}/wire-list/${encodedSheetSlug}/assignment-preparation?payloadKey=${encodedPayloadKey}`;
    const popup = window.open(printRoute, "_blank", "noopener,noreferrer");

    if (!popup) {
      window.location.href = printRoute;
    }
  }

  return (
    <>
      <div className="assignment-prep-dashboard-shell mx-auto w-full max-w-7xl px-4 py-8 print:hidden">
        <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5" />
            Assignment Preparation Dashboard
          </CardTitle>
          <CardDescription>
            Upload a UCP wire list workbook and switch sheet tabs to render an
            AssignmentPreperationPrintOut reference (tabloid-ready) with Blue Label Matrix and wire prep tables.
          </CardDescription>
        </CardHeader>

          <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="max-w-xl"
              disabled={isLoading}
            />
            <Button type="button" variant="outline" disabled>
              Auto-processing on file select
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing workbook and building matrix...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Matrix generation failed
              </div>
              <div className="mt-1 whitespace-pre-wrap">{error}</div>
            </div>
          ) : null}

          {result ? (
            <div className="space-y-4">
              <div className="rounded-md border px-3 py-3 print:hidden">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{result.fileName}</Badge>
                  <Badge variant="dot" color="blue">
                    Blue Labels Source: {result.sheetName}
                  </Badge>
                  <Badge variant="secondary">{visibleEntries.length} entries</Badge>
                  {result.exportedPath ? (
                    <Badge variant="dot" color="green" className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Exported: {result.exportedPath}
                    </Badge>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto h-8 gap-1.5"
                    onClick={handlePrintPreview}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Preview
                  </Button>
                </div>
              </div>

              {sheetTabs.length > 0 ? (
                <Tabs value={selectedSheetTab} onValueChange={setSelectedSheetTab}>
                  <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-md border p-1 print:hidden">
                    {sheetTabs.map((sheetName) => {
                      const sheetCount = result.entries.filter(
                        (entry) => entry.sheetName === sheetName,
                      ).length;

                      return (
                        <TabsTrigger key={`sheet-tab-${sheetName}`} value={sheetName}>
                          {sheetName} ({sheetCount})
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              ) : null}

           
            </div>
          ) : null}
          </CardContent>
        </Card>
      </div>

      {result && selectedSheetTab ? (
        <div className="mx-auto w-full px-2 pb-8 print:max-w-none print:px-0 print:pb-0">
          <AssignmentPreperationPrintOut
            fileName={result.fileName}
            sheetName={selectedSheetTab}
            entries={visibleEntries}
            quickRefCards={quickRefCards}
          />
        </div>
      ) : null}
    </>
  );
}
