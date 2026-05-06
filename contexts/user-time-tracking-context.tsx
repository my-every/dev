"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"

// ============================================================================
// Types
// ============================================================================

export type UserAvailabilityStatus = "available" | "busy" | "on-break" | "offline"

export interface ClockRecord {
  userId: string
  clockInTime: string // ISO string
  clockOutTime?: string // ISO string
  breakStartTime?: string // ISO string
  breakEndTime?: string // ISO string
  totalBreakMinutes: number
  shift: 1 | 2
}

export interface UserAssignmentRecord {
  userId: string
  assignmentId: string
  assignmentName: string
  stationId: string
  projectId?: string
  projectName?: string
  startTime: string // HH:mm format
  estimatedEndTime: string // HH:mm format
  status: "assigned" | "in-progress" | "completed" | "paused"
}

export interface QueuedAssignmentRecord {
  userId: string
  assignmentId: string
  assignmentName: string
  stationId: string
  projectId?: string
  projectName?: string
  queuedAt: string // ISO timestamp
  priority: number // Lower is higher priority
  estimatedStartTime?: string // HH:mm format
}

export interface UserTimeState {
  clockRecord: ClockRecord | null
  currentAssignment: UserAssignmentRecord | null
  queuedAssignments: QueuedAssignmentRecord[]
  status: UserAvailabilityStatus
}

interface UserTimeTrackingContextValue {
  // State access
  getUserState: (userId: string) => UserTimeState
  getAllUserStates: () => Map<string, UserTimeState>
  
  // Clock operations
  clockIn: (userId: string, shift: 1 | 2) => void
  clockOut: (userId: string) => void
  startBreak: (userId: string) => void
  endBreak: (userId: string) => void
  
  // Assignment operations
  assignUser: (userId: string, assignment: Omit<UserAssignmentRecord, "userId">) => void
  updateAssignmentStatus: (userId: string, status: UserAssignmentRecord["status"]) => void
  unassignUser: (userId: string) => void
  
  // Queue operations
  queueAssignment: (userId: string, assignment: Omit<QueuedAssignmentRecord, "userId" | "queuedAt">) => boolean
  removeFromQueue: (userId: string, assignmentId: string) => void
  promoteFromQueue: (userId: string) => void
  getUserQueue: (userId: string) => QueuedAssignmentRecord[]
  isInQueue: (userId: string, assignmentId: string) => boolean
  
  // Derived state
  getAvailableUsers: (shift?: 1 | 2) => string[]
  getBusyUsers: () => string[]
  isUserAvailable: (userId: string) => boolean
  getUserCurrentAssignment: (userId: string) => UserAssignmentRecord | null
  
  // Bulk operations
  getAssignedUserIds: () => Set<string>
  getQueuedUserIds: () => Set<string>
}

const UserTimeTrackingContext = createContext<UserTimeTrackingContextValue | null>(null)

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY = "user-time-tracking-state"
const BROADCAST_CHANNEL_NAME = "user-time-tracking-sync"

// ============================================================================
// Provider
// ============================================================================

interface UserTimeTrackingProviderProps {
  children: ReactNode
}

export function UserTimeTrackingProvider({ children }: UserTimeTrackingProviderProps) {
  // Map of userId -> UserTimeState
  const [userStates, setUserStates] = useState<Map<string, UserTimeState>>(() => new Map())
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const map = new Map<string, UserTimeState>(Object.entries(parsed))
        setUserStates(map)
      }
    } catch (e) {
      console.error("[UserTimeTracking] Failed to load from localStorage:", e)
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage when state changes
  useEffect(() => {
    if (!isHydrated) return
    try {
      const obj = Object.fromEntries(userStates)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } catch (e) {
      console.error("[UserTimeTracking] Failed to save to localStorage:", e)
    }
  }, [userStates, isHydrated])

  // Cross-tab synchronization via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    
    channel.onmessage = (event) => {
      if (event.data?.type === "state-update") {
        const map = new Map<string, UserTimeState>(Object.entries(event.data.state))
        setUserStates(map)
      }
    }

    return () => channel.close()
  }, [])

  // Broadcast state changes to other tabs
  const broadcastState = useCallback((newState: Map<string, UserTimeState>) => {
    if (typeof BroadcastChannel === "undefined") return
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.postMessage({
      type: "state-update",
      state: Object.fromEntries(newState),
    })
    channel.close()
  }, [])

  // ============================================================================
  // State Access Methods
  // ============================================================================

  const getUserState = useCallback((userId: string): UserTimeState => {
    return userStates.get(userId) || {
      clockRecord: null,
      currentAssignment: null,
      queuedAssignments: [],
      status: "offline",
    }
  }, [userStates])

  const getAllUserStates = useCallback(() => {
    return new Map(userStates)
  }, [userStates])

  // ============================================================================
  // Clock Operations
  // ============================================================================

  const clockIn = useCallback((userId: string, shift: 1 | 2) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      next.set(userId, {
        clockRecord: {
          userId,
          clockInTime: new Date().toISOString(),
          totalBreakMinutes: 0,
          shift,
        },
        currentAssignment: existing?.currentAssignment || null,
        queuedAssignments: existing?.queuedAssignments || [],
        status: existing?.currentAssignment ? "busy" : "available",
      })
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const clockOut = useCallback((userId: string) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (existing?.clockRecord) {
        next.set(userId, {
          clockRecord: {
            ...existing.clockRecord,
            clockOutTime: new Date().toISOString(),
          },
          currentAssignment: null, // Clear assignment on clock out
          queuedAssignments: [], // Clear queue on clock out
          status: "offline",
        })
      }
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const startBreak = useCallback((userId: string) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (existing?.clockRecord) {
        next.set(userId, {
          ...existing,
          clockRecord: {
            ...existing.clockRecord,
            breakStartTime: new Date().toISOString(),
          },
          status: "on-break",
        })
      }
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const endBreak = useCallback((userId: string) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (existing?.clockRecord?.breakStartTime) {
        const breakStart = new Date(existing.clockRecord.breakStartTime)
        const breakEnd = new Date()
        const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000)
        
        next.set(userId, {
          ...existing,
          clockRecord: {
            ...existing.clockRecord,
            breakStartTime: undefined,
            breakEndTime: breakEnd.toISOString(),
            totalBreakMinutes: existing.clockRecord.totalBreakMinutes + breakMinutes,
          },
          status: existing.currentAssignment ? "busy" : "available",
        })
      }
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  // ============================================================================
  // Assignment Operations
  // ============================================================================

  const assignUser = useCallback((userId: string, assignment: Omit<UserAssignmentRecord, "userId">) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      next.set(userId, {
        clockRecord: existing?.clockRecord || null,
        currentAssignment: { ...assignment, userId },
        status: existing?.clockRecord?.breakStartTime ? "on-break" : "busy",
      })
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const updateAssignmentStatus = useCallback((userId: string, status: UserAssignmentRecord["status"]) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (existing?.currentAssignment) {
        next.set(userId, {
          ...existing,
          currentAssignment: {
            ...existing.currentAssignment,
            status,
          },
        })
      }
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const unassignUser = useCallback((userId: string) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (existing) {
        next.set(userId, {
          ...existing,
          currentAssignment: null,
          status: existing.clockRecord?.breakStartTime 
            ? "on-break" 
            : existing.clockRecord 
              ? "available" 
              : "offline",
        })
      }
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  // ============================================================================
  // Queue Operations
  // ============================================================================

  const MAX_QUEUE_SIZE = 3

  const queueAssignment = useCallback((
    userId: string,
    assignment: Omit<QueuedAssignmentRecord, "userId" | "queuedAt">
  ): boolean => {
    let success = false
    
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      // User must be clocked in
      if (!existing?.clockRecord || existing.clockRecord.clockOutTime) {
        return prev
      }
      
      const currentQueue = existing.queuedAssignments || []
      
      // Check queue size
      if (currentQueue.length >= MAX_QUEUE_SIZE) {
        return prev
      }
      
      // Check if already in queue
      if (currentQueue.some(q => q.assignmentId === assignment.assignmentId)) {
        return prev
      }
      
      const newQueuedAssignment: QueuedAssignmentRecord = {
        ...assignment,
        userId,
        queuedAt: new Date().toISOString(),
      }
      
      const newQueue = [...currentQueue, newQueuedAssignment]
        .sort((a, b) => a.priority - b.priority)
      
      next.set(userId, {
        ...existing,
        queuedAssignments: newQueue,
      })
      
      success = true
      broadcastState(next)
      return next
    })
    
    return success
  }, [broadcastState])

  const removeFromQueueFn = useCallback((userId: string, assignmentId: string) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (!existing) return prev
      
      const newQueue = (existing.queuedAssignments || [])
        .filter(q => q.assignmentId !== assignmentId)
      
      next.set(userId, {
        ...existing,
        queuedAssignments: newQueue,
      })
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const promoteFromQueue = useCallback((userId: string) => {
    setUserStates((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId)
      
      if (!existing || !existing.queuedAssignments?.length) return prev
      
      // User must not have an active assignment
      if (existing.currentAssignment) return prev
      
      const [nextInQueue, ...remainingQueue] = existing.queuedAssignments
      
      // Convert queued assignment to active assignment
      const newAssignment: UserAssignmentRecord = {
        userId,
        assignmentId: nextInQueue.assignmentId,
        assignmentName: nextInQueue.assignmentName,
        stationId: nextInQueue.stationId,
        projectId: nextInQueue.projectId,
        projectName: nextInQueue.projectName,
        startTime: nextInQueue.estimatedStartTime || new Date().toTimeString().slice(0, 5),
        estimatedEndTime: "23:59", // Will be updated by caller
        status: "assigned",
      }
      
      next.set(userId, {
        ...existing,
        currentAssignment: newAssignment,
        queuedAssignments: remainingQueue,
        status: existing.clockRecord?.breakStartTime ? "on-break" : "busy",
      })
      
      broadcastState(next)
      return next
    })
  }, [broadcastState])

  const getUserQueueFn = useCallback((userId: string): QueuedAssignmentRecord[] => {
    return userStates.get(userId)?.queuedAssignments || []
  }, [userStates])

  const isInQueueFn = useCallback((userId: string, assignmentId: string): boolean => {
    const queue = userStates.get(userId)?.queuedAssignments || []
    return queue.some(q => q.assignmentId === assignmentId)
  }, [userStates])
  
  // ============================================================================
  // Derived State
  // ============================================================================
  
  const getAvailableUsers = useCallback((shift?: 1 | 2): string[] => {
    const available: string[] = []
    userStates.forEach((state, id) => {
      if (state.status === "available") {
        if (shift === undefined || state.clockRecord?.shift === shift) {
          available.push(id)
        }
      }
    })
    return available
  }, [userStates])

  const getBusyUsers = useCallback((): string[] => {
    const busy: string[] = []
    userStates.forEach((state, id) => {
      if (state.status === "busy") {
        busy.push(id)
      }
    })
    return busy
  }, [userStates])

  const isUserAvailable = useCallback((userId: string): boolean => {
    const state = userStates.get(userId)
    return state?.status === "available"
  }, [userStates])

  const getUserCurrentAssignment = useCallback((userId: string): UserAssignmentRecord | null => {
    return userStates.get(userId)?.currentAssignment || null
  }, [userStates])

  const getAssignedUserIds = useCallback((): Set<string> => {
    const ids = new Set<string>()
    userStates.forEach((state, id) => {
      if (state.currentAssignment) {
        ids.add(id)
      }
    })
    return ids
  }, [userStates])

  const getQueuedUserIds = useCallback((): Set<string> => {
    const ids = new Set<string>()
    userStates.forEach((state, id) => {
      if (state.queuedAssignments && state.queuedAssignments.length > 0) {
        ids.add(id)
      }
    })
    return ids
  }, [userStates])
  
  // ============================================================================
  // Context Value
  // ============================================================================
  
  const value = useMemo<UserTimeTrackingContextValue>(() => ({
    getUserState,
    getAllUserStates,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    assignUser,
    updateAssignmentStatus,
    unassignUser,
    queueAssignment,
    removeFromQueue: removeFromQueueFn,
    promoteFromQueue,
    getUserQueue: getUserQueueFn,
    isInQueue: isInQueueFn,
    getAvailableUsers,
    getBusyUsers,
    isUserAvailable,
    getUserCurrentAssignment,
    getAssignedUserIds,
    getQueuedUserIds,
  }), [
    getUserState,
    getAllUserStates,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    assignUser,
    updateAssignmentStatus,
    unassignUser,
    queueAssignment,
    removeFromQueueFn,
    promoteFromQueue,
    getUserQueueFn,
    isInQueueFn,
    getAvailableUsers,
    getBusyUsers,
    isUserAvailable,
    getUserCurrentAssignment,
    getAssignedUserIds,
    getQueuedUserIds,
  ])

  return (
    <UserTimeTrackingContext.Provider value={value}>
      {children}
    </UserTimeTrackingContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useUserTimeTracking() {
  const context = useContext(UserTimeTrackingContext)
  if (!context) {
    throw new Error("useUserTimeTracking must be used within a UserTimeTrackingProvider")
  }
  return context
}

// ============================================================================
// Utility Hooks
// ============================================================================

/** Hook to get a single user's time tracking state */
export function useUserState(userId: string) {
  const { getUserState } = useUserTimeTracking()
  return getUserState(userId)
}

/** Hook to check if a user is available */
export function useIsUserAvailable(userId: string) {
  const { isUserAvailable } = useUserTimeTracking()
  return isUserAvailable(userId)
}

/** Hook to get all assigned user IDs as a Set */
export function useAssignedUserIds() {
  const { getAssignedUserIds } = useUserTimeTracking()
  return useMemo(() => getAssignedUserIds(), [getAssignedUserIds])
}
