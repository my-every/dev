"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AssignmentPreperationPrintOut } from "@/components/dashboard/assignment-preperation-print-out";
import type { AssignmentPreparationQuickRefCard } from "@/components/dashboard/assignment-preperation-print-out";
import type { BlueLabelSequenceMatrixEntry } from "@/lib/wiring-identification";

interface AssignmentPreparationPrintPayload {
  fileName: string;
  sheetName: string;
  entries: BlueLabelSequenceMatrixEntry[];
  quickRefCards: AssignmentPreparationQuickRefCard[];
}

function isValidPayload(value: unknown): value is AssignmentPreparationPrintPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssignmentPreparationPrintPayload>;
  return (
    typeof candidate.fileName === "string" &&
    typeof candidate.sheetName === "string" &&
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.quickRefCards)
  );
}

export default function AssignmentPreparationPrintRoutePage() {
  const params = useParams<{ sheetName: string }>();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<AssignmentPreparationPrintPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fallbackSheet = useMemo(() => {
    const raw = params?.sheetName ?? "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params?.sheetName]);

  useEffect(() => {
    const payloadKey = searchParams.get("payloadKey");
    if (!payloadKey) {
      setError("Missing print payload. Open this page from the dashboard Print Preview button.");
      return;
    }

    const serialized = window.sessionStorage.getItem(payloadKey);
    if (!serialized) {
      setError("Print payload not found. Return to dashboard and click Print Preview again.");
      return;
    }

    try {
      const parsed = JSON.parse(serialized) as unknown;
      if (!isValidPayload(parsed)) {
        setError("Print payload format is invalid.");
        return;
      }

      setPayload(parsed);
      setError(null);
    } catch {
      setError("Failed to parse print payload.");
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-background p-4 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex w-full max-w-[16.6in] items-center justify-end gap-2 print:hidden">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-[16.6in] rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      ) : null}

      {payload ? (
        <AssignmentPreperationPrintOut
          fileName={payload.fileName}
          sheetName={payload.sheetName || fallbackSheet}
          entries={payload.entries}
          quickRefCards={payload.quickRefCards}
        />
      ) : null}
    </main>
  );
}
