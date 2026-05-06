"use client";

import { cn } from "@/lib/utils";

/**
 * Maps a normalized unit-type id (e.g. "JB70") to the SVG asset shipped under
 * `public/unit-type/`. Add new entries as more SVGs land — the lookup is a
 * plain object, no rebuild required beyond pointing at a new file.
 */
export const UNIT_TYPE_SVG_REGISTRY: Record<string, string> = {
  JB5: "/unit-type/jb5.svg",
  JB70: "/unit-type/jb70.svg",
  JB75: "/unit-type/jb75.svg",
};

/** Normalize a unit type label into a registry key (uppercase, trimmed). */
export function normalizeUnitTypeKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

/** Resolve the SVG path for a unit type, or null if no asset is registered. */
export function resolveUnitTypeSvg(value: string | null | undefined): string | null {
  const key = normalizeUnitTypeKey(value);
  return key ? UNIT_TYPE_SVG_REGISTRY[key] ?? null : null;
}

type UnitTypeGlyphProps = {
  unitType: string | null | undefined;
  /** Width/height in pixels. Defaults to 24. */
  size?: number;
  className?: string;
  /**
   * Visible-to-screen-readers label override. Defaults to the unit type
   * itself.
   */
  ariaLabel?: string;
};

/**
 * Small visual representation of a unit type. When a matching SVG exists in
 * `public/unit-type/`, it is rendered inline; otherwise we fall back to a
 * neutral text badge so the UI never breaks when a new unit type appears
 * before its asset is added.
 */
export function UnitTypeGlyph({
  unitType = "JB5",
  size = 50,
  className,
  ariaLabel,
}: UnitTypeGlyphProps) {
  const path = resolveUnitTypeSvg(unitType);
  const label = String(unitType ?? "").trim();

  if (!path) {
    return (
      <span
        role="img"
        aria-label={ariaLabel ?? (label || "Unknown unit type")}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground",
          "text-[9px] font-semibold uppercase tracking-tight",
          className
        )}
        style={{ width: size, height: size }}
      >
        {label.slice(0, 3) || "—"}
      </span>
    );
  }

  return (
    // Static SVG asset under /public — `<img>` is appropriate here and
    // sidesteps next/image's domain configuration.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={path}
      alt={ariaLabel ?? `${label} unit type`}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
