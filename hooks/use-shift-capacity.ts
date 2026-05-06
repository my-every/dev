"use client"

import { useMemo } from "react"
import type { ShiftId } from "@/types/shifts"
import type { Assignment, Resource, CapacitySummary } from "@/types/scheduling"
import { ALL_SHIFT_IDS } from "@/types/shifts"
import {
  calculateShiftCapacity,
  calculateResourceCapacity,
} from "@/lib/shift-utils"
import { useScheduling } from "@/contexts/scheduling-context"

/**
 * Hook to calculate capacity for all shifts
 */
export function useShiftCapacity(): Record<ShiftId, CapacitySummary> {
  const { resources, filteredAssignments } = useScheduling()

  return useMemo(() => {
    const capacities: Record<ShiftId, CapacitySummary> = {} as Record<
      ShiftId,
      CapacitySummary
    >

    for (const shiftId of ALL_SHIFT_IDS) {
      capacities[shiftId] = calculateShiftCapacity(
        shiftId,
        resources,
        filteredAssignments
      )
    }

    return capacities
  }, [resources, filteredAssignments])
}

/**
 * Hook to calculate capacity for a specific shift
 */
export function useSingleShiftCapacity(shiftId: ShiftId): CapacitySummary {
  const { resources, filteredAssignments } = useScheduling()

  return useMemo(() => {
    return calculateShiftCapacity(shiftId, resources, filteredAssignments)
  }, [shiftId, resources, filteredAssignments])
}

/**
 * Hook to calculate capacity for a specific resource
 */
export function useResourceCapacity(resourceId: string): CapacitySummary | null {
  const { resources, filteredAssignments } = useScheduling()

  return useMemo(() => {
    const resource = resources.find((r) => r.id === resourceId)
    if (!resource) return null

    return calculateResourceCapacity(resource, filteredAssignments)
  }, [resourceId, resources, filteredAssignments])
}

/**
 * Hook to calculate capacity for all resources
 */
export function useAllResourceCapacities(): Map<string, CapacitySummary> {
  const { resources, filteredAssignments } = useScheduling()

  return useMemo(() => {
    const capacities = new Map<string, CapacitySummary>()

    for (const resource of resources) {
      capacities.set(
        resource.id,
        calculateResourceCapacity(resource, filteredAssignments)
      )
    }

    return capacities
  }, [resources, filteredAssignments])
}

/**
 * Standalone function to calculate shift capacity (for use outside context)
 */
export function calculateCapacity(
  shiftId: ShiftId,
  resources: Resource[],
  assignments: Assignment[]
): CapacitySummary {
  return calculateShiftCapacity(shiftId, resources, assignments)
}
