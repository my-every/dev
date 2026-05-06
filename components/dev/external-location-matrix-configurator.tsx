"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BoxSideConfig } from "@/boxSide";

const BOX_SIDES = [
  "leftDoor",
  "rightDoor",
  "leftSide",
  "rightSide",
  "leftBackSide",
  "topBackSide",
  "backSide",
  "rightBackSide",
] as const;

type BoxSide = (typeof BOX_SIDES)[number];
type CellValue = "T" | "F" | "I";
type MatrixConfig = Record<BoxSide, Record<BoxSide, CellValue>>;

interface AssignmentReference {
  value: string;
  boxSide: string;
}

interface UnitReference {
  unitType: string;
  assignments: AssignmentReference[];
}

interface ExternalLocationMatrixConfiguratorProps {
  unitReferences: UnitReference[];
}

function isBoxSide(value: string): value is BoxSide {
  return BOX_SIDES.includes(value as BoxSide);
}

function createInternalMatrix(): MatrixConfig {
  const matrix = {} as MatrixConfig;
  for (const row of BOX_SIDES) {
    matrix[row] = {} as Record<BoxSide, CellValue>;
    for (const col of BOX_SIDES) {
      matrix[row][col] = "I";
    }
  }
  return matrix;
}

function createDefaultMatrix(): MatrixConfig {
  const matrix = createInternalMatrix();

  // Seed defaults from canonical box-side config and keep unspecified cells as internal.
  for (const [rowSide, rowConfig] of Object.entries(BoxSideConfig)) {
    if (!isBoxSide(rowSide)) continue;
    for (const [locationSide, visible] of Object.entries(rowConfig.externalLocations)) {
      if (!isBoxSide(locationSide)) continue;
      matrix[rowSide][locationSide] = visible ? "T" : "F";
    }
  }

  return matrix;
}

function cellToFlags(value: CellValue): { visible: boolean; internal: boolean } {
  if (value === "I") {
    return { visible: false, internal: true };
  }

  return {
    visible: value === "T",
    internal: false,
  };
}

function flagsToCell(visible: boolean, internal: boolean): CellValue {
  if (internal) return "I";
  return visible ? "T" : "F";
}

export function ExternalLocationMatrixConfigurator({
  unitReferences,
}: ExternalLocationMatrixConfiguratorProps) {
  const [matrix, setMatrix] = useState<MatrixConfig>(() => createDefaultMatrix());
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [selectedUnitType, setSelectedUnitType] = useState(unitReferences[0]?.unitType ?? "");
  const [selectedAssignmentValue, setSelectedAssignmentValue] = useState("");

  const selectedUnit = useMemo(
    () => unitReferences.find((unit) => unit.unitType === selectedUnitType) ?? null,
    [selectedUnitType, unitReferences]
  );

  const availableBoxSides = useMemo(() => {
    if (!selectedUnit) return [] as BoxSide[];

    const sideSet = new Set<BoxSide>();
    for (const assignment of selectedUnit.assignments) {
      if (isBoxSide(assignment.boxSide)) {
        sideSet.add(assignment.boxSide);
      }
    }

    return BOX_SIDES.filter((side) => sideSet.has(side));
  }, [selectedUnit]);

  useEffect(() => {
    if (!selectedUnit || selectedUnit.assignments.length === 0) {
      setSelectedAssignmentValue("");
      return;
    }

    const currentStillExists = selectedUnit.assignments.some(
      (assignment) => assignment.value === selectedAssignmentValue
    );
    if (!currentStillExists) {
      setSelectedAssignmentValue(selectedUnit.assignments[0].value);
    }
  }, [selectedUnit, selectedAssignmentValue]);

  const selectedAssignment = useMemo(
    () =>
      selectedUnit?.assignments.find((assignment) => assignment.value === selectedAssignmentValue) ??
      null,
    [selectedAssignmentValue, selectedUnit]
  );

  const activeRows = availableBoxSides;
  const activeColumns = availableBoxSides;

  const exportPayload = useMemo(
    () => ({
      legend: {
        T: true,
        F: false,
        I: "internal",
      },
      unitType: selectedUnitType || null,
      assignment: selectedAssignment
        ? {
            value: selectedAssignment.value,
            boxSide: selectedAssignment.boxSide,
          }
        : null,
      boxSides: [...activeColumns],
      matrix: activeRows.reduce((acc, row) => {
        acc[row] = activeColumns.reduce((colAcc, col) => {
          colAcc[col] = matrix[row][col];
          return colAcc;
        }, {} as Record<BoxSide, CellValue>);
        return acc;
      }, {} as Record<BoxSide, Record<BoxSide, CellValue>>),
    }),
    [matrix, selectedUnitType, selectedAssignment, activeColumns, activeRows]
  );

  const exportJson = useMemo(() => JSON.stringify(exportPayload, null, 2), [exportPayload]);

  const updateCell = (row: BoxSide, col: BoxSide, nextValue: CellValue) => {
    setMatrix((prev) => ({
      ...prev,
      [row]: {
        ...prev[row],
        [col]: nextValue,
      },
    }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1400);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "external-locations-matrix.config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">External Location Matrix Configurator</h3>
        <p className="text-xs text-muted-foreground">
          Select a unit type and assignment reference. Matrix options are shown only for boxSides that
          exist in the selected unit type.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-foreground">Unit Type</span>
          <select
            value={selectedUnitType}
            onChange={(event) => setSelectedUnitType(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]"
          >
            {unitReferences.map((unit) => (
              <option key={unit.unitType} value={unit.unitType}>
                {unit.unitType}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs">
          <span className="font-medium text-foreground">Assignment Reference</span>
          <select
            value={selectedAssignmentValue}
            onChange={(event) => setSelectedAssignmentValue(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]"
            disabled={!selectedUnit || selectedUnit.assignments.length === 0}
          >
            {selectedUnit?.assignments.map((assignment) => (
              <option key={assignment.value} value={assignment.value}>
                {assignment.value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-foreground">Unit Assignment References</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Showing assignments and their source boxSide from the selected unit type.
        </p>
        <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="border-b border-border px-2 py-2 text-left font-medium">Assignment</th>
                <th className="border-b border-border px-2 py-2 text-left font-medium">boxSide</th>
              </tr>
            </thead>
            <tbody>
              {selectedUnit?.assignments.map((assignment) => (
                <tr
                  key={`${assignment.value}:${assignment.boxSide}`}
                  className={assignment.value === selectedAssignmentValue ? "bg-muted/30" : undefined}
                >
                  <td className="border-t border-border px-2 py-2">{assignment.value}</td>
                  <td className="border-t border-border px-2 py-2">{assignment.boxSide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 text-[11px]">
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">boxSides in unitType</span>
        {availableBoxSides.length === 0 ? (
          <span className="rounded border border-border px-2 py-1">none</span>
        ) : (
          availableBoxSides.map((side) => (
            <span key={side} className="rounded border border-border px-2 py-1">
              {side}
            </span>
          ))
        )}
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <table className="min-w-240 border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-10 border-b border-r border-border bg-muted/60 px-2 py-2 text-left font-medium">
                boxSide
              </th>
              {activeColumns.map((col) => (
                <th key={col} className="border-b border-border px-2 py-2 text-center font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row}>
                <th className="sticky left-0 z-10 border-r border-border bg-background px-2 py-2 text-left font-medium">
                  {row}
                </th>
                {activeColumns.map((col) => {
                  const value = matrix[row][col];
                  const flags = cellToFlags(value);
                  return (
                    <td key={`${row}:${col}`} className="border-t border-border px-2 py-2 align-top">
                      <div className="space-y-1 rounded-md border border-border/70 p-2">
                        <div className="text-center text-[11px] font-semibold">{value}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">Visible</span>
                          <Switch
                            checked={flags.visible}
                            onCheckedChange={(checked) => updateCell(row, col, flagsToCell(checked, flags.internal))}
                            disabled={flags.internal}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">Internal</span>
                          <Switch
                            checked={flags.internal}
                            onCheckedChange={(checked) =>
                              updateCell(row, col, flagsToCell(checked ? false : flags.visible, checked))
                            }
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setMatrix(createDefaultMatrix())}>
          Reset To Default
        </Button>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy Failed" : "Copy JSON"}
        </Button>
        <Button variant="primary" size="sm" onClick={handleDownload}>
          Download JSON
        </Button>
      </div>

      <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-[11px] leading-4">
        {exportJson}
      </pre>
    </div>
  );
}
