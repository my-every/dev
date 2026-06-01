"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWirePrepInstructionParts } from "@/components/dashboard/wire-prep-instruction";

export interface PairGroupWirePrepLine {
  id: string;
  from: string;
  to: string;
  wireId?: string;
}

export interface PairGroupWirePrepGroup {
  id: string;
  lines: PairGroupWirePrepLine[];
  connectorCount?: number;
  valueText?: string;
}

interface PairGroupWirePrepTableProps {
  title: string;
  instruction: string;
  groups: PairGroupWirePrepGroup[];
  imageSrc?: string;
  imageAlt?: string;
  countLabel?: string;
  countColumnClassName?: string;
  showWireIdColumn?: boolean;
  wireIdLabel?: string;
  prepCount?: number;
}

function defaultFormatLine(line: PairGroupWirePrepLine): ReactNode {
  const from = line.from || "-";
  const to = line.to || "";

  return (
    <div className="flex flex-col items-start leading-tight">
      <span>{from}</span>
      {to ? <span>{to}</span> : null}
    </div>
  );
}

export function PairGroupWirePrepTable({
  title,
  instruction,
  groups,
  imageSrc,
  imageAlt = "Connector",
  countLabel = "Connectors",
  countColumnClassName = "w-16",
  showWireIdColumn = false,
  wireIdLabel = "Wire ID",
  prepCount,
}: PairGroupWirePrepTableProps) {
  const resolvedPrepCount = prepCount ?? groups.reduce((total, group) => total + group.lines.length, 0);
  const { safeCount, normalizedInstruction } = getWirePrepInstructionParts(instruction, resolvedPrepCount);

  return (
    <Card className="w-full max-w-lg min-w-0 break-inside-avoid-column max-h-max gap-2 rounded-none py-2 shadow-none print:break-inside-avoid-page">
      <CardHeader className="gap-1 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-[12px] leading-tight">{title}</CardTitle>
            <CardDescription className="text-[10px] leading-tight">
              <span>Prepare </span>
              <span className="inline-flex min-w-4 items-center justify-center rounded-sm bg-muted px-1 font-semibold text-foreground">
                {safeCount}
              </span>
              {normalizedInstruction ? <span> {normalizedInstruction}</span> : null}
            </CardDescription>
          </div>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={imageAlt}
              className="h-12.5 w-12.5 object-cover"
            />
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="px-3">
        <div className="rounded- min-w-0 border">
          <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-7 px-1.5 py-1 font-medium">#</th>
                <th className="px-1.5 py-1 font-medium">From - To</th>
                {showWireIdColumn ? <th className="w-24 px-1.5 py-1 font-medium">{wireIdLabel}</th> : null}
                <th className={`${countColumnClassName} px-1.5 py-1 font-medium`}>{countLabel}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={group.id} className="border-b border-b-zinc-400 last:border-b-0">
                  <td className="border-r px-1.5 py-1 align-middle font-medium">
                    <div className="flex h-full items-center justify-center">{index + 1}</div>
                  </td>
                  <td className="px-1.5 py-1 align-middle">
                    <div className="flex flex-col items-start gap-0.5">
                      {group.lines.map((line) => (
                        <div key={`${group.id}-${line.id}`} className=" break-all">
                          {defaultFormatLine(line)}
                        </div>
                      ))}
                    </div>
                  </td>
                  {showWireIdColumn ? (
                    <td className="w-24 px-1.5 py-1 align-middle">
                      <div className="flex flex-col items-start gap-0.5">
                        {group.lines.map((line) => (
                          <div key={`${group.id}-${line.id}-wire`} className="break-all">
                            {line.wireId || "-"}
                          </div>
                        ))}
                      </div>
                    </td>
                  ) : null}
                  <td className={`${countColumnClassName} px-1.5 py-1 align-middle font-medium`}>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span>-</span>
                      <span>{group.valueText ?? group.connectorCount ?? group.lines.length}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}