"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SENSITIVITY_STORAGE_KEY = "work-sensitivity-level";

export type SensitivityLevel = "non-confidential" | "confidential-green" | "confidential-yellow" | "confidential-red";

interface SensitivityOption {
  value: SensitivityLevel;
  label: string;
  toneClassName: string;
  dotClassName: string;
}

const SENSITIVITY_OPTIONS: SensitivityOption[] = [
  {
    value: "non-confidential",
    label: "Cat Non-Confidential",
    toneClassName: "border-sky-200 bg-sky-50 text-sky-900",
    dotClassName: "bg-sky-500",
  },
  {
    value: "confidential-green",
    label: "Cat Confidential Green",
    toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dotClassName: "bg-emerald-600",
  },
  {
    value: "confidential-yellow",
    label: "Cat Confidential Yellow",
    toneClassName: "border-amber-200 bg-amber-50 text-amber-900",
    dotClassName: "bg-amber-500",
  },
  {
    value: "confidential-red",
    label: "Cat Confidential Red",
    toneClassName: "border-rose-200 bg-rose-50 text-rose-900",
    dotClassName: "bg-rose-600",
  },
];

interface SensitivityBadgeProps {
  value: SensitivityLevel;
  pulse?: boolean;
  className?: string;
}

export function SensitivityBadge({ value, pulse = false, className }: SensitivityBadgeProps) {
  const option = SENSITIVITY_OPTIONS.find((entry) => entry.value === value) ?? SENSITIVITY_OPTIONS[1];

  return (
    <div className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ",
      option.toneClassName,
      className,
    )}>
      <Shield className="h-3.5 w-3.5" />
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {pulse ? <span className={cn("absolute inline-flex  w-full rounded-full opacity-70 animate-ping", option.dotClassName)} /> : null}
        <span className={cn("relative h-2 w-2 rounded-full", option.dotClassName)} />
      </span>
      <span>{option.label}</span>
    </div>
  );
}

function getSensitivityOption(value: SensitivityLevel) {
  return SENSITIVITY_OPTIONS.find((entry) => entry.value === value) ?? SENSITIVITY_OPTIONS[1];
}

function useSensitivityValue(enabled: boolean, controlledValue?: SensitivityLevel, onValueChange?: (value: SensitivityLevel) => void) {
  const [internalValue, setInternalValue] = useState<SensitivityLevel>(controlledValue ?? "confidential-green");
  const isControlled = controlledValue !== undefined;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue, isControlled]);

  useEffect(() => {
    if (!enabled || isControlled || typeof window === "undefined") {
      return;
    }

    const storedValue = window.localStorage.getItem(SENSITIVITY_STORAGE_KEY) as SensitivityLevel | null;
    if (storedValue && SENSITIVITY_OPTIONS.some((entry) => entry.value === storedValue)) {
      setInternalValue(storedValue);
    }
  }, [enabled, isControlled]);

  const value = controlledValue ?? internalValue;
  const selectedOption = useMemo(() => getSensitivityOption(value), [value]);

  const updateValue = (nextValue: SensitivityLevel) => {
    if (!isControlled) {
      setInternalValue(nextValue);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SENSITIVITY_STORAGE_KEY, nextValue);
      }
    }

    onValueChange?.(nextValue);
  };

  return {
    value,
    selectedOption,
    setValue: updateValue,
  };
}

interface SensitivitySelectorProps {
  enabled?: boolean;
  value?: SensitivityLevel;
  onValueChange?: (value: SensitivityLevel) => void;
  className?: string;
  badgeClassName?: string;
  label?: string;
  showHint?: boolean;
  pulseBadge?: boolean;
}

export function SensitivitySelector({
  enabled = true,
  value: controlledValue,
  onValueChange,
  className,
  badgeClassName,
  label = "Sensitivity",
  showHint = true,
  pulseBadge = false,
}: SensitivitySelectorProps) {
  const { value, selectedOption, setValue } = useSensitivityValue(enabled, controlledValue, onValueChange);

  if (!enabled) {
    return null;
  }

  return (
    <div className={cn(
      "flex min-w-[18rem] items-center gap-3 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 shadow-lg backdrop-blur-md",
      className,
    )}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <SensitivityBadge value={value} pulse={pulseBadge} className={badgeClassName} />
      </div>

      <div className="flex w-60 flex-col gap-1">
        <Select
          value={value}
          onValueChange={(nextValue) => {
            setValue(nextValue as SensitivityLevel);
          }}
        >
          <SelectTrigger className="h-10 w-full text-left">
            <SelectValue>{selectedOption.label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {SENSITIVITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", option.dotClassName)} />
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showHint ? (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Stored locally for this browser session profile.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface SensitivityFooterProps extends SensitivitySelectorProps {
  variant?: "selector" | "badge";
}

export function SensitivityFooter({
  variant = "badge",
  enabled = true,
  value,
  onValueChange,
  className,
  badgeClassName,
  label,
  showHint,
  pulseBadge,
}: SensitivityFooterProps) {
  const sensitivity = useSensitivityValue(enabled, value, onValueChange);

  if (!enabled) {
    return null;
  }

  if (variant === "badge") {
    return (
      <SensitivityBadge
        value={sensitivity.value}
        pulse={pulseBadge ?? true}
        className={cn("w-fit", className, badgeClassName)}
      />
    );
  }

  return (
    <SensitivitySelector
      enabled={enabled}
      value={sensitivity.value}
      onValueChange={sensitivity.setValue}
      className={className}
      badgeClassName={badgeClassName}
      label={label}
      showHint={showHint}
      pulseBadge={pulseBadge}
    />
  );
}