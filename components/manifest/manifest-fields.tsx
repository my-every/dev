"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Lock, Loader2, Pencil, RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ManifestFieldBaseProps {
  label: string;
  helperText?: string;
  locked?: boolean;
  lockedReason?: string;
  generated?: boolean;
  className?: string;
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function FieldWrapper({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  children,
}: ManifestFieldBaseProps & { children: React.ReactNode }) {
  return (
    <div className={cn("group/field space-y-1", className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {locked ? (
          <span title={lockedReason ?? "This field is locked"}>
            <Lock className="h-3 w-3 text-muted-foreground/60" />
          </span>
        ) : null}
        {generated ? (
          <Badge variant="outline" className="h-4 px-1 py-0 text-[9px] font-normal">
            auto
          </Badge>
        ) : null}
      </div>
      {children}
      {helperText ? (
        <p className="text-[11px] text-muted-foreground/70">{helperText}</p>
      ) : null}
    </div>
  );
}

// ─── Saving states ────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function useSaveState() {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSave = useCallback(async (fn: () => Promise<void>) => {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState("idle"), 3000);
    }
  }, []);

  return { saveState, runSave };
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (state === "saved") return <Check className="h-3.5 w-3.5 text-emerald-500" />;
  if (state === "error") return <X className="h-3.5 w-3.5 text-destructive" />;
  return null;
}

// ─── ManifestTextField ─────────────────────────────────────────────────────────

export interface ManifestTextFieldProps extends ManifestFieldBaseProps {
  value: string | null | undefined;
  onSave?: (value: string) => Promise<void>;
  placeholder?: string;
  maxLength?: number;
}

export function ManifestTextField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  onSave,
  placeholder = "—",
  maxLength,
}: ManifestTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { saveState, runSave } = useSaveState();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(value ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value]);

  const commitSave = useCallback(async () => {
    if (!onSave) {
      setEditing(false);
      return;
    }
    await runSave(async () => {
      await onSave(draft.trim());
      setEditing(false);
    });
  }, [draft, onSave, runSave]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") void commitSave();
      if (e.key === "Escape") cancelEdit();
    },
    [cancelEdit, commitSave],
  );

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxLength}
            className="h-7 text-sm"
          />
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void commitSave()}>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-medium", !value && "text-muted-foreground/60")}>
            {value || placeholder}
          </span>
          <SaveIndicator state={saveState} />
          {!locked && !generated && onSave ? (
            <button
              type="button"
              onClick={startEdit}
              className="invisible ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/field:visible group-hover/field:opacity-100"
              title={`Edit ${label}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      )}
    </FieldWrapper>
  );
}

// ─── ManifestSelectField ───────────────────────────────────────────────────────

export interface ManifestSelectOption {
  value: string;
  label: string;
}

export interface ManifestSelectFieldProps extends ManifestFieldBaseProps {
  value: string | null | undefined;
  options: ManifestSelectOption[];
  onSave?: (value: string) => Promise<void>;
  placeholder?: string;
}

export function ManifestSelectField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  options,
  onSave,
  placeholder = "—",
}: ManifestSelectFieldProps) {
  const { saveState, runSave } = useSaveState();
  const displayLabel = options.find((o) => o.value === value)?.label ?? value ?? placeholder;

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!onSave) return;
      await runSave(() => onSave(e.target.value));
    },
    [onSave, runSave],
  );

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      {locked || generated || !onSave ? (
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-medium", !value && "text-muted-foreground/60")}>
            {displayLabel}
          </span>
          <SaveIndicator state={saveState} />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={value ?? ""}
            onChange={(e) => void handleChange(e)}
            disabled={saveState === "saving"}
            className="h-7 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {!value ? <option value="">—</option> : null}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <SaveIndicator state={saveState} />
        </div>
      )}
    </FieldWrapper>
  );
}

// ─── ManifestDateField ─────────────────────────────────────────────────────────

export interface ManifestDateFieldProps extends ManifestFieldBaseProps {
  value: string | null | undefined;
  onSave?: (value: string | null) => Promise<void>;
}

export function ManifestDateField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  onSave,
}: ManifestDateFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { saveState, runSave } = useSaveState();

  const startEdit = useCallback(() => {
    setDraft(value ?? "");
    setEditing(true);
  }, [value]);

  const commitSave = useCallback(async () => {
    if (!onSave) {
      setEditing(false);
      return;
    }
    await runSave(async () => {
      await onSave(draft || null);
      setEditing(false);
    });
  }, [draft, onSave, runSave]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft("");
  }, []);

  const formatted = value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitSave();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-7 text-sm"
          />
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void commitSave()}>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-medium", !value && "text-muted-foreground/60")}>
            {formatted ?? "—"}
          </span>
          <SaveIndicator state={saveState} />
          {!locked && !generated && onSave ? (
            <button
              type="button"
              onClick={startEdit}
              className="invisible ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/field:visible group-hover/field:opacity-100"
              title={`Edit ${label}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      )}
    </FieldWrapper>
  );
}

// ─── ManifestBooleanField ──────────────────────────────────────────────────────

export interface ManifestBooleanFieldProps extends ManifestFieldBaseProps {
  value: boolean | null | undefined;
  onSave?: (value: boolean) => Promise<void>;
}

export function ManifestBooleanField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  onSave,
}: ManifestBooleanFieldProps) {
  const { saveState, runSave } = useSaveState();

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!onSave) return;
      await runSave(() => onSave(next));
    },
    [onSave, runSave],
  );

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      <div className="flex items-center gap-2">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(next) => void handleToggle(next)}
          disabled={locked || generated || !onSave || saveState === "saving"}
        />
        <span className="text-sm font-medium">{value ? "Yes" : "No"}</span>
        <SaveIndicator state={saveState} />
      </div>
    </FieldWrapper>
  );
}

// ─── ManifestNumberField ───────────────────────────────────────────────────────

export interface ManifestNumberFieldProps extends ManifestFieldBaseProps {
  value: number | null | undefined;
  onSave?: (value: number) => Promise<void>;
  min?: number;
  max?: number;
  unit?: string;
}

export function ManifestNumberField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  onSave,
  min,
  max,
  unit,
}: ManifestNumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { saveState, runSave } = useSaveState();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(value?.toString() ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value]);

  const commitSave = useCallback(async () => {
    if (!onSave) {
      setEditing(false);
      return;
    }
    const parsed = parseFloat(draft);
    if (isNaN(parsed)) {
      setEditing(false);
      return;
    }
    await runSave(async () => {
      await onSave(parsed);
      setEditing(false);
    });
  }, [draft, onSave, runSave]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft("");
  }, []);

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            min={min}
            max={max}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitSave();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-7 w-28 text-sm"
          />
          {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void commitSave()}>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-medium", value == null && "text-muted-foreground/60")}>
            {value != null ? `${value}${unit ? ` ${unit}` : ""}` : "—"}
          </span>
          <SaveIndicator state={saveState} />
          {!locked && !generated && onSave ? (
            <button
              type="button"
              onClick={startEdit}
              className="invisible ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/field:visible group-hover/field:opacity-100"
              title={`Edit ${label}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      )}
    </FieldWrapper>
  );
}

// ─── ManifestArrayEditor ───────────────────────────────────────────────────────

export interface ManifestArrayEditorProps extends ManifestFieldBaseProps {
  values: string[];
  onSave?: (values: string[]) => Promise<void>;
  addPlaceholder?: string;
  maxItems?: number;
}

export function ManifestArrayEditor({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  values,
  onSave,
  addPlaceholder = "Add item…",
  maxItems,
}: ManifestArrayEditorProps) {
  const [draft, setDraft] = useState("");
  const { saveState, runSave } = useSaveState();

  const addItem = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || !onSave) return;
    if (maxItems && values.length >= maxItems) return;
    const next = [...values, trimmed];
    await runSave(async () => {
      await onSave(next);
      setDraft("");
    });
  }, [draft, maxItems, onSave, runSave, values]);

  const removeItem = useCallback(
    async (index: number) => {
      if (!onSave) return;
      const next = values.filter((_, i) => i !== index);
      await runSave(() => onSave(next));
    },
    [onSave, runSave, values],
  );

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      <div className="space-y-1.5">
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">—</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {values.map((item, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                {item}
                {!locked && !generated && onSave ? (
                  <button
                    type="button"
                    onClick={() => void removeItem(i)}
                    className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                ) : null}
              </Badge>
            ))}
          </div>
        )}
        {!locked && !generated && onSave && (!maxItems || values.length < maxItems) ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addItem();
              }}
              placeholder={addPlaceholder}
              className="h-6 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => void addItem()}
              disabled={!draft.trim() || saveState === "saving"}
            >
              Add
            </Button>
            <SaveIndicator state={saveState} />
          </div>
        ) : null}
      </div>
    </FieldWrapper>
  );
}

// ─── ManifestExternalLocationMatrix ───────────────────────────────────────────

export interface ExternalLocationVisibility {
  location: string;
  wireListVisible: boolean;
  brandingVisible: boolean;
}

export interface ManifestExternalLocationMatrixProps extends ManifestFieldBaseProps {
  locations: ExternalLocationVisibility[];
  onSave?: (locations: ExternalLocationVisibility[]) => Promise<void>;
}

export function ManifestExternalLocationMatrix({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  locations,
  onSave,
}: ManifestExternalLocationMatrixProps) {
  const { saveState, runSave } = useSaveState();

  const handleToggle = useCallback(
    async (index: number, field: "wireListVisible" | "brandingVisible", next: boolean) => {
      if (!onSave) return;
      const updated = locations.map((loc, i) =>
        i === index ? { ...loc, [field]: next } : loc,
      );
      await runSave(() => onSave(updated));
    },
    [locations, onSave, runSave],
  );

  if (locations.length === 0) {
    return (
      <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
        <p className="text-sm text-muted-foreground/60">No external locations configured.</p>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Location</th>
              <th className="px-2.5 py-1.5 text-center font-medium text-muted-foreground">Wire List</th>
              <th className="px-2.5 py-1.5 text-center font-medium text-muted-foreground">Branding</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc, i) => (
              <tr key={loc.location} className="border-b border-border/50 last:border-0">
                <td className="px-2.5 py-1.5 font-mono text-[11px]">{loc.location}</td>
                <td className="px-2.5 py-1.5 text-center">
                  <Switch
                    checked={loc.wireListVisible}
                    onCheckedChange={(next) => void handleToggle(i, "wireListVisible", next)}
                    disabled={locked || !onSave || saveState === "saving"}
                    className="scale-75"
                  />
                </td>
                <td className="px-2.5 py-1.5 text-center">
                  <Switch
                    checked={loc.brandingVisible}
                    onCheckedChange={(next) => void handleToggle(i, "brandingVisible", next)}
                    disabled={locked || !onSave || saveState === "saving"}
                    className="scale-75"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {saveState !== "idle" ? (
          <div className="flex items-center gap-1.5 border-t border-border/50 px-2.5 py-1.5">
            <SaveIndicator state={saveState} />
            <span className="text-[11px] text-muted-foreground">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Error saving"}
            </span>
          </div>
        ) : null}
      </div>
    </FieldWrapper>
  );
}

// ─── ManifestColorField ────────────────────────────────────────────────────────

export interface ManifestColorFieldProps extends ManifestFieldBaseProps {
  value: string | null | undefined;
  onSave?: (value: string) => Promise<void>;
}

export function ManifestColorField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  onSave,
}: ManifestColorFieldProps) {
  const { saveState, runSave } = useSaveState();

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onSave) return;
      await runSave(() => onSave(e.target.value));
    },
    [onSave, runSave],
  );

  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      <div className="flex items-center gap-2">
        <div
          className="h-5 w-5 rounded-md border border-border shadow-sm"
          style={{ backgroundColor: value ?? "#cccccc" }}
        />
        <span className="font-mono text-sm font-medium">{value ?? "—"}</span>
        {!locked && !generated && onSave ? (
          <input
            type="color"
            value={value ?? "#cccccc"}
            onChange={(e) => void handleChange(e)}
            disabled={saveState === "saving"}
            className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0 disabled:opacity-50"
            title="Pick color"
          />
        ) : null}
        <SaveIndicator state={saveState} />
      </div>
    </FieldWrapper>
  );
}

// ─── ManifestReadonlyField ─────────────────────────────────────────────────────

export interface ManifestReadonlyFieldProps extends ManifestFieldBaseProps {
  value: string | number | null | undefined;
  mono?: boolean;
}

export function ManifestReadonlyField({
  label,
  helperText,
  locked,
  lockedReason,
  generated,
  className,
  value,
  mono,
}: ManifestReadonlyFieldProps) {
  return (
    <FieldWrapper label={label} helperText={helperText} locked={locked} lockedReason={lockedReason} generated={generated} className={className}>
      <span className={cn("text-sm font-medium", mono && "font-mono", value == null && "text-muted-foreground/60")}>
        {value != null ? String(value) : "—"}
      </span>
    </FieldWrapper>
  );
}

// ─── ManifestRefreshButton ─────────────────────────────────────────────────────

export function ManifestRefreshButton({
  onClick,
  loading,
  label = "Recalculate",
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="h-7 gap-1.5 text-xs"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
