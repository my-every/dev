"use client";

import { useMemo, type ReactNode } from "react";

import {
  ProjectGroupedAccordion,
  type ProjectGroupableItem,
  type ProjectGroupFilter,
  type ProjectGroupingMode,
} from "./project-grouped-accordion";
import { UnitTypeGlyph, normalizeUnitTypeKey } from "./unit-type-glyph";

/**
 * Anything assignment-shaped that exposes a `unitType` field can be grouped.
 * The `id` is required so the accordion has a stable React key.
 */
export type UnitTypeGroupableItem = ProjectGroupableItem & {
  unitType?: string | null;
};

type ProjectUnitTypeAccordionProps<TItem extends UnitTypeGroupableItem> = {
  items: TItem[];
  /** Render override for one row inside a unit-type bucket. */
  renderItem: (item: TItem) => ReactNode;
  /**
   * Optional explicit ordering of unit types (e.g. ["JB5", "JB70", "JB75"]).
   * Unit types not listed here fall to the end in alphabetical order.
   */
  unitTypeOrder?: string[];
  /** Pixel size of the unit-type SVG glyph in the trigger label. Defaults to 24. */
  glyphSize?: number;
  /**
   * - "exclusive" (default): each item appears in exactly one bucket.
   * - "overlap": an item can appear in every bucket whose predicate matches.
   *   Rarely useful for unit-type grouping but exposed for symmetry.
   */
  mode?: ProjectGroupingMode;
  type?: "single" | "multiple";
  defaultOpenIds?: string[];
  hideEmpty?: boolean;
  /** Label used for the bucket that catches items without a unit type. */
  unassignedLabel?: string;
  className?: string;
  emptyGroupMessage?: string;
};

/**
 * Reusable accordion that buckets assignments (or any items with a
 * `unitType` field) by unit type. Unit-type buckets are derived from the
 * input data, so newly-introduced unit types appear automatically — and
 * gain a real glyph as soon as their SVG is registered in
 * {@link UNIT_TYPE_SVG_REGISTRY}.
 */
export function ProjectUnitTypeAccordion<TItem extends UnitTypeGroupableItem>({
  items,
  renderItem,
  unitTypeOrder,
  glyphSize = 24,
  mode = "exclusive",
  type = "multiple",
  defaultOpenIds,
  hideEmpty = true,
  unassignedLabel = "Unassigned",
  className,
  emptyGroupMessage = "No assignments in this group.",
}: ProjectUnitTypeAccordionProps<TItem>) {
  const groups = useMemo<ProjectGroupFilter<TItem>[]>(() => {
    const presentKeys = new Set<string>();
    let hasUnknown = false;

    for (const item of items) {
      const key = normalizeUnitTypeKey(item.unitType);
      if (key) presentKeys.add(key);
      else hasUnknown = true;
    }

    const orderIndex = new Map<string, number>(
      (unitTypeOrder ?? []).map((value, index) => [
        normalizeUnitTypeKey(value),
        index,
      ])
    );

    const orderedKeys = Array.from(presentKeys).sort((left, right) => {
      const li = orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
      const ri = orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (li !== ri) return li - ri;
      return left.localeCompare(right);
    });

    const buckets: ProjectGroupFilter<TItem>[] = orderedKeys.map((key) => ({
      id: `unit-type-${key.toLowerCase()}`,
      label: key,
      icon: <UnitTypeGlyph unitType={key} size={glyphSize} />,
      match: (item) => normalizeUnitTypeKey(item.unitType) === key,
    }));

    if (hasUnknown) {
      buckets.push({
        id: "unit-type-unassigned",
        label: unassignedLabel,
        icon: <UnitTypeGlyph unitType={null} size={glyphSize} />,
        match: (item) => normalizeUnitTypeKey(item.unitType) === "",
      });
    }

    return buckets;
  }, [items, unitTypeOrder, glyphSize, unassignedLabel]);

  return (
    <ProjectGroupedAccordion<TItem>
      projects={items}
      groups={groups}
      renderProject={renderItem}
      mode={mode}
      type={type}
      defaultOpenIds={defaultOpenIds}
      hideEmpty={hideEmpty}
      className={className}
      emptyGroupMessage={emptyGroupMessage}
    />
  );
}
