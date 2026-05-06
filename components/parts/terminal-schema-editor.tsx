"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartStackSelector } from "@/components/parts/part-stack-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PartTerminalDefinition, PartTerminalSchema, PartTerminalSide } from "@/types/parts-library";

const TERMINAL_SIDES: Array<{ value: PartTerminalSide; label: string }> = [
  { value: "unknown", label: "Unknown" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "front", label: "Front" },
  { value: "rear", label: "Rear" },
  { value: "inner", label: "Inner" },
  { value: "outer", label: "Outer" },
];

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

function createTerminal(): PartTerminalDefinition {
  return {
    name: "",
    aliases: [],
    wireId: "",
    size: "",
    side: "unknown",
    tier: "",
    order: null,
    isNegative: false,
    polarityMode: "fixed-positive",
    instructions: [],
    hardware: {},
  };
}

interface TerminalSchemaEditorProps {
  value?: PartTerminalSchema;
  onChange: (schema: PartTerminalSchema) => void;
  disabled?: boolean;
}

export function TerminalSchemaEditor({ value, onChange, disabled = false }: TerminalSchemaEditorProps) {
  const schema = value ?? {
    terminals: [],
    negativePatterns: ["COM", "COMMON", "0V", "0VDC", "DC-", "NEG", "NEGATIVE", "-"],
    updatedAt: new Date().toISOString(),
  };

  const updateSchema = (next: PartTerminalSchema) => {
    onChange({
      ...next,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateTerminal = (index: number, patch: Partial<PartTerminalDefinition>) => {
    updateSchema({
      ...schema,
      terminals: schema.terminals.map((terminal, terminalIndex) =>
        terminalIndex === index ? { ...terminal, ...patch } : terminal,
      ),
    });
  };

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Terminal Intelligence</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage terminal naming, polarity, side, tier, and install guidance used by branding and wire ordering.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            updateSchema({
              ...schema,
              terminals: [...schema.terminals, createTerminal()],
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add terminal
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Negative terminal patterns</Label>
          <Input
            value={joinList(schema.negativePatterns)}
            onChange={(event) =>
              updateSchema({
                ...schema,
                negativePatterns: splitList(event.target.value).map((item) => item.toUpperCase()),
              })
            }
            disabled={disabled}
            placeholder="COM, COMMON, 0V, DC-"
          />
        </div>
      </div>

      {schema.terminals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No terminals yet. Add terminals manually or let project extraction seed them from wire-list sheets.
        </div>
      ) : (
        <div className="space-y-3">
          {schema.terminals.map((terminal, index) => (
            <div key={`${terminal.name || "terminal"}-${index}`} className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {terminal.name || `Terminal ${index + 1}`}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() =>
                    updateSchema({
                      ...schema,
                      terminals: schema.terminals.filter((_, terminalIndex) => terminalIndex !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs">Terminal</Label>
                  <Input
                    value={terminal.name}
                    disabled={disabled}
                    onChange={(event) => updateTerminal(index, { name: event.target.value.toUpperCase() })}
                    placeholder="COM"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Wire ID</Label>
                  <Input
                    value={terminal.wireId ?? ""}
                    disabled={disabled}
                    onChange={(event) => updateTerminal(index, { wireId: event.target.value.toUpperCase() })}
                    placeholder="WHT"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Size</Label>
                  <Input
                    value={terminal.size ?? ""}
                    disabled={disabled}
                    onChange={(event) => updateTerminal(index, { size: event.target.value })}
                    placeholder="16"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Aliases</Label>
                  <Input
                    value={joinList(terminal.aliases)}
                    disabled={disabled}
                    onChange={(event) => updateTerminal(index, { aliases: splitList(event.target.value).map((item) => item.toUpperCase()) })}
                    placeholder="COMMON, 0V"
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs">Side</Label>
                  <Select
                    value={terminal.side ?? "unknown"}
                    onValueChange={(value) => updateTerminal(index, { side: value as PartTerminalSide })}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINAL_SIDES.map((side) => (
                        <SelectItem key={side.value} value={side.value}>
                          {side.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tier / Order</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={terminal.tier ?? ""}
                      disabled={disabled}
                      onChange={(event) => updateTerminal(index, { tier: event.target.value })}
                      placeholder="T1"
                    />
                    <Input
                      type="number"
                      value={terminal.order ?? ""}
                      disabled={disabled}
                      onChange={(event) => updateTerminal(index, { order: event.target.value ? Number(event.target.value) : null })}
                      placeholder="1"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs">Hardware</Label>
                  <Input
                    value={Object.entries(terminal.hardware ?? {}).map(([key, value]) => `${key}:${value}`).join(", ")}
                    disabled={disabled}
                    onChange={(event) =>
                      updateTerminal(index, {
                        hardware: Object.fromEntries(
                          splitList(event.target.value)
                            .map((item) => item.split(":"))
                            .filter((entry) => entry[0])
                            .map(([key, value]) => [key.trim(), String(value ?? "").trim()]),
                        ),
                      })
                    }
                    placeholder="barrier:required, spacer:adjacent AC"
                  />
                </div>
              </div>

              <div className="mt-3">
                <PartStackSelector
                  value={terminal.hardwareStackId ? [terminal.hardwareStackId] : []}
                  onChange={(next) => updateTerminal(index, { hardwareStackId: next[0] ?? undefined })}
                  label="Reusable Hardware Stack"
                  useCase="terminal-hardware"
                  allowMultiple={false}
                />
              </div>

              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Install instructions</Label>
                  <Textarea
                    value={joinList(terminal.instructions)}
                    disabled={disabled}
                    onChange={(event) => updateTerminal(index, { instructions: splitList(event.target.value) })}
                    placeholder="Keep clear of AC, route first, use shield barrier"
                    rows={2}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(terminal.isNegative)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    updateTerminal(index, {
                      isNegative: Boolean(checked),
                      polarityMode: checked ? "fixed-negative" : "fixed-positive",
                    })
                  }
                />
                <span>Use negative wire marker for this terminal</span>
              </div>

              <div className="mt-3 space-y-2">
                <Label className="text-xs">Polarity Mode</Label>
                <Select
                  value={terminal.polarityMode ?? (terminal.isNegative ? "fixed-negative" : "fixed-positive")}
                  onValueChange={(value) =>
                    updateTerminal(index, {
                      polarityMode: value as "fixed-negative" | "fixed-positive" | "either",
                      isNegative:
                        value === "fixed-negative"
                          ? true
                          : value === "fixed-positive"
                            ? false
                            : terminal.isNegative,
                    })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed-positive">Fixed Positive</SelectItem>
                    <SelectItem value="fixed-negative">Fixed Negative</SelectItem>
                    <SelectItem value="either">Either (infer from row)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
