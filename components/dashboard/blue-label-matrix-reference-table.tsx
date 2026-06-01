"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BlueLabelSequenceMatrixEntry } from "@/lib/wiring-identification";

interface BlueLabelMatrixReferenceTableProps {
  entries: BlueLabelSequenceMatrixEntry[];
}

const BLUE_LABEL_PRIMARY_COLUMN_MAX_ROWS = 47;

export function BlueLabelMatrixReferenceTable({ entries }: BlueLabelMatrixReferenceTableProps) {
  const matrixColumns = useMemo(() => {
    const primaryCount = Math.min(entries.length, BLUE_LABEL_PRIMARY_COLUMN_MAX_ROWS);
    const firstColumn = entries.slice(0, primaryCount);
    const secondColumn = entries.slice(primaryCount);

    if (secondColumn.length === 0) {
      return [firstColumn] as const;
    }

    return [firstColumn, secondColumn] as const;
  }, [entries]);

  return (
    <Card className="w-full max-w-lg min-w-0 gap-2 max-h-max rounded-none py-2 shadow-none print:break-inside-avoid-page">
      <CardHeader className="gap-1 px-3">
        <CardTitle className="text-[12px] leading-tight">Device ID / Blue Label Sequence Reference</CardTitle>
        <CardDescription className="text-[10px] leading-tight">
          All devices installed in sequential order.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-3">
        <div
          className={`grid grid-cols-1 gap-2 ${
            matrixColumns.length > 1 ? "md:grid-cols-2 print:grid-cols-2" : ""
          }`}
        >
          {matrixColumns.map((columnEntries, columnIndex) => (
            <div key={`matrix-column-${columnIndex}`} className="min-w-0 border">
              <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="w-10 px-1.5 py-1 font-medium">#</th>
                    <th className="px-1.5 py-1 font-medium">Device ID</th>
                   
                  </tr>
                </thead>
                <tbody>
                  {columnEntries.map((entry) => (
                    <tr
                      key={`${entry.sheetName}:${entry.deviceId}:${entry.sequenceIndex}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-1.5 py-0.5 align-top">{entry.sequenceIndex + 1}</td>
                      <td className="px-1.5 py-0.5 align-top whitespace-nowrap font-medium text-foreground">{entry.deviceId}</td>
                    
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}