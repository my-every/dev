"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectScheduleDocument } from "@/lib/project-schedule/types";
import { extractStructuredPdfText } from "@/lib/layout-matching/extract-pdf-text";
import { extractPdfColumnRows } from "@/lib/wire-length";

const COLUMN_ALIAS_MAP: Record<string, string> = {
  lwc: "lwc",
  lwcproject: "lwc",
  unit: "unit",
  pd: "pd",
  "pd#": "pd",
  pdnumber: "pd",
  project: "name",
  "project name": "name",
  customer: "name",
  legals: "legals",
  sw: "sw",
  "consh wo open": "wo",
  "concsh wo open": "wo",
  "concsh woopen": "wo",
  wo: "wo",
  "proj kitted": "proj",
  "project kitted": "proj",
  "prject knitted": "proj",
  proj: "proj",
  conlay: "conlay",
  conasy: "conasy",
  conassy: "conasy",
  test: "test",
  "test 1st pass": "test",
  "test first pass": "test",
  concus: "concus",
  pwrchk: "pwrchk",
  "d380 final": "d380Final",
  "d380 final-": "d380Final",
  "d380 final biq": "d380Final",
  d380final: "d380Final",
  "dept 380": "dept380",
  "dept 380 target": "dept380",
  target: "dept380",
  "target date": "dept380",
  dept380: "dept380",
  "days late": "daysLate",
  dayslate: "daysLate",
  commit: "commit",
  commmit: "commit",
  "new commmit": "commit",
  "new commit": "commit",
  "new commit date": "commit",
  "biq comp": "biqComp",
  biqcomp: "biqComp",
  hide: "hide",
  comments: "comments",
};

const CANONICAL_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "lwc", label: "LWC" },
  { key: "name", label: "PROJECT" },
  { key: "unit", label: "UNIT" },
  { key: "pd", label: "PD#" },
  { key: "legals", label: "LEGALS" },
  { key: "sw", label: "SW" },
  { key: "wo", label: "CONCSH WO OPEN" },
  { key: "proj", label: "PROJ KITTED" },
  { key: "conlay", label: "CONLAY" },
  { key: "conasy", label: "CONASY" },
  { key: "test", label: "TEST 1ST PASS" },
  { key: "concus", label: "CONCUS" },
  { key: "pwrchk", label: "PWRCHK" },
  { key: "d380Final", label: "D380 FINAL-BIQ" },
  { key: "dept380", label: "DEPT 380 TARGET" },
  { key: "daysLate", label: "DAYS LATE" },
  { key: "commit", label: "NEW COMMMIT" },
  { key: "biqComp", label: "BIQ COMP" },
  { key: "hide", label: "HIDE" },
  { key: "comments", label: "COMMENTS" },
];

const CANONICAL_KEYS = new Set<string>(CANONICAL_COLUMNS.map((column) => column.key));

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function orderedColumnKeys(values: Record<string, string>): string[] {
  return Object.keys(values).sort((left, right) => {
    const leftMatch = left.match(/(\d+)$/);
    const rightMatch = right.match(/(\d+)$/);
    if (leftMatch && rightMatch) {
      return Number(leftMatch[1]) - Number(rightMatch[1]);
    }
    return left.localeCompare(right);
  });
}

function findHeaderIndex(rows: Array<{ values: Record<string, string> }>): number {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const keys = orderedColumnKeys(row.values);
    const recognized = keys.reduce((count, key) => {
      const alias = COLUMN_ALIAS_MAP[normalizeHeader(row.values[key] || "")];
      return alias ? count + 1 : count;
    }, 0);
    if (recognized >= 6) {
      return index;
    }
  }
  return -1;
}

interface ProjectScheduleUploadProps {
  onImported?: (schedule: ProjectScheduleDocument) => void;
}

export function ProjectScheduleUpload({ onImported }: ProjectScheduleUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const helperText = useMemo(() => {
    if (isUploading) {
      return "Importing schedule...";
    }
    if (message) {
      return message;
    }
    return "Upload a project schedule PDF, CSV, or Excel file.";
  }, [isUploading, message]);

  const buildScheduleFromPdf = async (pdfFile: File): Promise<ProjectScheduleDocument> => {
    const pdfSource = await extractStructuredPdfText(pdfFile);
    const extractedRows = extractPdfColumnRows(pdfSource, {
      includeEmptyRows: false,
      trimValues: true,
    });

    const headerIndex = findHeaderIndex(extractedRows);
    const headerRow = headerIndex >= 0 ? extractedRows[headerIndex] : null;
    const dataRows = headerIndex >= 0 ? extractedRows.slice(headerIndex + 1) : extractedRows;

    const columnKeys = headerRow ? orderedColumnKeys(headerRow.values) : [];
    const columnMap = new Map<string, string>();

    for (const key of columnKeys) {
      const headerValue = headerRow?.values[key] || key;
      const normalized = normalizeHeader(headerValue);
      const mapped = COLUMN_ALIAS_MAP[normalized];
      if (mapped) {
        columnMap.set(key, mapped);
      }
    }

    const mappedRows = dataRows
      .filter((row) => {
        const joined = Object.values(row.values).join(" ").toLowerCase();
        return !joined.includes("project open") && !joined.includes("kitted target");
      })
      .map((row, index) => {
        const mapped: Record<string, string> = {};
        const sourceKeys = orderedColumnKeys(row.values);
        for (const key of sourceKeys) {
          const targetKey = columnMap.get(key);
          if (!targetKey || !CANONICAL_KEYS.has(targetKey)) {
            continue;
          }
          const value = row.values[key];
          if (value) {
            mapped[targetKey] = value;
          }
        }

        return {
          id: `${pdfFile.name.toLowerCase().replace(/\.pdf$/i, "") || "row"}-${index + 1}`,
          ...mapped,
        };
      })
      .filter((row) => Object.keys(row).length > 1);

    const columns = CANONICAL_COLUMNS;

    const baseName = pdfFile.name.replace(/\.pdf$/i, "").trim() || "Imported Project";

    return {
      columns,
      groups: [
        {
          id: baseName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "imported-project",
          projectLabel: baseName,
          rows: mappedRows,
        },
      ],
      importedAt: new Date().toISOString(),
      sourceFile: pdfFile.name,
    };
  };

  const handleUpload = async () => {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const isPdf = /\.pdf$/i.test(file.name);
      const isCsv = /\.csv$/i.test(file.name);
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);

      if (!isPdf && !isCsv && !isExcel) {
        throw new Error("Please select a PDF, CSV, or Excel file.");
      }

      const response = (isCsv || isExcel)
        ? await (async () => {
          const formData = new FormData();
          formData.append("file", file);
          return fetch("/api/schedule/project-schedule", {
            method: "POST",
            body: formData,
          });
        })()
        : await (async () => {
          const schedulePayload = await buildScheduleFromPdf(file);
          return fetch("/api/schedule/project-schedule", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(schedulePayload),
          });
        })();

      const payload = await response.json().catch(() => ({ error: "Import failed" })) as {
        error?: string;
        schedule?: ProjectScheduleDocument;
      };

      if (!response.ok || !payload.schedule) {
        throw new Error(payload.error || "Failed to import schedule file.");
      }

      setMessage(`Imported ${file.name}`);
      onImported?.(payload.schedule);
      window.dispatchEvent(new CustomEvent("project-schedule:updated"));
      setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to import schedule file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        type="file"
        accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="text-xs"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setFile(selected);
          setMessage(null);
        }}
      />

      <Button
        type="button"
        size="sm"
        className="w-full gap-2"
        onClick={handleUpload}
        disabled={!file || isUploading}
      >
        <Upload className="h-3.5 w-3.5" />
        {isUploading ? "Importing..." : "Import Schedule"}
      </Button>

      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
