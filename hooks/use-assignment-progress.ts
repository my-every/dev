"use client"

import { useState, useEffect, useMemo } from "react"
import type { Assignment } from "@/types/scheduling"
import { timeToMinutes, getDurationMinutes, getCurrentTime } from "@/lib/time-utils"
import { useScheduling } from "@/contexts/scheduling-context"

interface AssignmentProgress {
  totalMinutes: number
  elapsedMinutes: number
  remainingMinutes: number
  percentComplete: number
  isStarted: boolean
  isEnded: boolean
  status: "not-started" | "in-progress" | "completed" | "overdue"
}

/**
 * Hook to track progress of a specific assignment in real-time
 */
export function useAssignmentProgress(assignmentId: string): AssignmentProgress | null {
  const { assignments } = useScheduling()
  const [currentTime, setCurrentTime] = useState(getCurrentTime())

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const assignment = useMemo(() => {
    return assignments.find((a) => a.id === assignmentId)
  }, [assignments, assignmentId])

  return useMemo(() => {
    if (!assignment) return null

    return calculateProgress(assignment, currentTime)
  }, [assignment, currentTime])
}

/**
 * Hook to track progress of multiple assignments
 */
export function useAssignmentsProgress(
  assignmentIds: string[]
): Map<string, AssignmentProgress> {
  const { assignments } = useScheduling()
  const [currentTime, setCurrentTime] = useState(getCurrentTime())

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return useMemo(() => {
    const progressMap = new Map<string, AssignmentProgress>()

    for (const id of assignmentIds) {
      const assignment = assignments.find((a) => a.id === id)
      if (assignment) {
        progressMap.set(id, calculateProgress(assignment, currentTime))
      }
    }

    return progressMap
  }, [assignments, assignmentIds, currentTime])
}

/**
 * Hook to get all in-progress assignments
 */
export function useInProgressAssignments(): {
  assignment: Assignment
  progress: AssignmentProgress
}[] {
  const { filteredAssignments } = useScheduling()
  const [currentTime, setCurrentTime] = useState(getCurrentTime())

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return useMemo(() => {
    return filteredAssignments
      .filter((a) => a.status === "in-progress" || a.status === "scheduled")
      .map((assignment) => ({
        assignment,
        progress: calculateProgress(assignment, currentTime),
      }))
      .filter((item) => item.progress.status === "in-progress")
  }, [filteredAssignments, currentTime])
}

/**
 * Calculate progress for an assignment at a given time
 */
function calculateProgress(
  assignment: Assignment,
  currentTime: string
): AssignmentProgress {
  const totalMinutes = getDurationMinutes(assignment.startTime, assignment.endTime)
  const startMinutes = timeToMinutes(assignment.startTime)
  const endMinutes = timeToMinutes(assignment.endTime)
  const currentMinutes = timeToMinutes(currentTime)

  const isStarted = currentMinutes >= startMinutes
  const isEnded = currentMinutes >= endMinutes

  let elapsedMinutes = 0
  let status: AssignmentProgress["status"] = "not-started"

  if (assignment.status === "completed") {
    elapsedMinutes = totalMinutes
    status = "completed"
  } else if (isEnded) {
    elapsedMinutes = totalMinutes
    status = assignment.status === "in-progress" ? "overdue" : "completed"
  } else if (isStarted) {
    elapsedMinutes = currentMinutes - startMinutes
    status = "in-progress"
  }

  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes)
  const percentComplete =
    totalMinutes > 0 ? Math.round((elapsedMinutes / totalMinutes) * 100) : 0

  return {
    totalMinutes,
    elapsedMinutes,
    remainingMinutes,
    percentComplete: Math.min(100, percentComplete),
    isStarted,
    isEnded,
    status,
  }
}

/**
 * Standalone function to calculate progress (for use outside hooks)
 */
export function getAssignmentProgress(
  assignment: Assignment,
  currentTime?: string
): AssignmentProgress {
  return calculateProgress(assignment, currentTime || getCurrentTime())
}
