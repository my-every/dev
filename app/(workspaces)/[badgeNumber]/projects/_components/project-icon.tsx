"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type ShareStatus = "online" | "away" | "busy" | "offline" | "syncing";

function getInitials(name: string): string {
  const cleaned = String(name ?? "").trim();
  if (!cleaned) return "PRJ";

  // Show up to 6 non-dash characters; dashes are included but don't count toward the limit.
  const compact = cleaned.replace(/[^A-Za-z0-9-]/g, "");
  if (!compact) return "PRJ";

  let result = "";
  let count = 0;
  for (const ch of compact) {
    if (count >= 6) break;
    result += ch;
    if (ch !== "-") count++;
  }
  return result.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function textColorForBackground(hexColor?: string): string {
  const rgb = hexColor ? hexToRgb(hexColor) : null;
  if (!rgb) return "#111827";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.62 ? "#111827" : "#F9FAFB";
}

function statusClass(status: ShareStatus): string {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "away":
      return "bg-amber-400";
    case "busy":
      return "bg-rose-500";
    case "syncing":
      return "bg-sky-500";
    default:
      return "bg-slate-400";
  }
}

export type ProjectIconSize = "sm" | "md" | "lg";

export interface ProjectIconProps {
  name: string;
  color?: string;
  href?: string;
  onClick?: () => void;
  instanceNumber?: number | null;
  shareStatus?: ShareStatus;
  notificationCount?: number;
  className?: string;
  title?: string;
  showStatus?: boolean;
  interactive?: boolean;
  size?: ProjectIconSize;
}

const SIZE_CONTAINER: Record<ProjectIconSize, string> = {
  sm: "h-8 w-8 rounded-md sm:h-10 sm:w-10",
  md: "min-h-10 w-12 rounded-lg px-1.5 sm:min-h-12.5 sm:w-15 sm:px-2",
  lg: "h-12 w-12 rounded-xl px-1 sm:h-16 sm:w-16 sm:rounded-2xl sm:px-1.5",
};

const SIZE_TEXT: Record<ProjectIconSize, string> = {
  sm: "text-[6px] sm:text-[7px]",
  md: "text-[9px] sm:text-[10.5px]",
  lg: "text-[10px] sm:text-xs",
};

export function ProjectIcon({
  name,
  color = "#FFCC61",
  href,
  onClick,
  instanceNumber,
  shareStatus = "offline",
  notificationCount = 0,
  className,
  showStatus = false,
  title,
  interactive = true,
  size = "md",
}: ProjectIconProps) {
  const initials = getInitials(name);
  const fg = textColorForBackground(color);
  const labelClass = initials.length >= 6 ? SIZE_TEXT[size] : size === "sm" ? "text-[8px]" : SIZE_TEXT[size];
  const content = (
    <div
      className={cn(
        "relative inline-flex items-center justify-center border border-black/10 font-semibold shadow-sm transition-transform hover:scale-[1.03]",
        SIZE_CONTAINER[size],
        className,
      )}
      style={{ backgroundColor: color, color: fg }}
      title={title ?? name}
      aria-label={title ?? name}
    >
      <span className={cn("whitespace-nowrap font-semibold leading-none tracking-tight", labelClass)}>{initials}</span>
      {typeof instanceNumber === "number" && instanceNumber > 1 ? (
        <span className="absolute -right-1 -top-1 rounded-md bg-black px-1 text-[10px] font-bold text-white">
          #{instanceNumber}
        </span>
      ) : null}
   
   {showStatus ? <span
        className={cn(
          "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
          statusClass(shareStatus),
        )}
      /> : null}
      {notificationCount > 0 ? (
        <span className="absolute -left-1 -top-1 rounded-md bg-rose-600 px-1 text-[10px] font-bold text-white">
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  if (!interactive || !onClick) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="inline-flex">
      {content}
    </button>
  );
}

export interface UnitTypeIconProps {
  unitType: string;
  bayCount?: 1 | 2 | 3 | 4;
  href?: string;
  onClick?: () => void;
  className?: string;
  shareStatus?: ShareStatus;
  notificationCount?: number;
  title?: string;
  interactive?: boolean;
}

function parseUnitLabel(unitType: string, bayCount?: 1 | 2 | 3 | 4): { label: string; metallic: boolean; badge?: string } {
  const normalized = String(unitType ?? "").trim().toUpperCase();
  if (normalized === "ONSKID" || normalized === "OFFSKID") {
    return { label: `${bayCount ?? 1}B`, metallic: false };
  }
  const bayMatch = normalized.match(/(\d+)\s*B(?:AY)?/i);
  if (bayMatch) {
    return { label: `${bayMatch[1]}B`, metallic: false };
  }
  const jbMatch = normalized.match(/^JB\s*([0-9]+)$/i);
  if (jbMatch) {
    return { label: "JB", metallic: true, badge: `#${jbMatch[1]}` };
  }
  return { label: normalized.slice(0, 2) || "UT", metallic: false };
}

export function UnitTypeIcon({
  unitType,
  bayCount,
  href,
  onClick,
  className,
  shareStatus = "offline",
  notificationCount = 0,
  title,
  interactive = true,
}: UnitTypeIconProps) {
  const parsed = parseUnitLabel(unitType, bayCount);
  const icon = (
    <div
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-lg border font-bold shadow-sm",
        parsed.metallic
          ? "border-slate-500/60 bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-900"
          : "border-stone-800/40 bg-gradient-to-br from-[#f4dfc4] via-[#e8d0b2] to-[#d5be9f] text-neutral-900",
        className,
      )}
      title={title ?? unitType}
      aria-label={title ?? unitType}
    >
      <span className="text-xs">{parsed.label}</span>
      {parsed.badge ? (
        <span className="absolute -right-1 -top-1 rounded-md bg-black px-1 text-[10px] font-bold text-white">
          {parsed.badge}
        </span>
      ) : null}
      <span
        className={cn(
          "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
          statusClass(shareStatus),
        )}
      />
      {notificationCount > 0 ? (
        <span className="absolute -left-1 -top-1 rounded-md bg-rose-600 px-1 text-[10px] font-bold text-white">
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {icon}
      </Link>
    );
  }

  if (!interactive || !onClick) {
    return icon;
  }

  return (
    <button type="button" onClick={onClick} className="inline-flex">
      {icon}
    </button>
  );
}
