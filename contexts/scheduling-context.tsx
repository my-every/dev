"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import type { ShiftId } from "@/types/shifts"
import type {
  Assignment,
  AssignmentStatus,
  Resource,
  Project,
  SchedulingFilters,
  ViewMode,
} from "@/types/scheduling"

// State interface
interface SchedulingState {
  assignments: Assignment[]
  resources: Resource[]
  projects: Project[]
  selectedDate: Date
  activeShift: ShiftId | "all"
  viewMode: ViewMode
  filters: SchedulingFilters
  isLoading: boolean
  error: string | null
}

// Action types
type SchedulingAction =
  | { type: "SET_ASSIGNMENTS"; payload: Assignment[] }
  | { type: "ADD_ASSIGNMENT"; payload: Assignment }
  | {
      type: "UPDATE_ASSIGNMENT"
      payload: { id: string; updates: Partial<Assignment> }
    }
  | {
      type: "MOVE_ASSIGNMENT"
      payload: { id: string; newTime: string; newResourceId: string }
    }
  | { type: "DELETE_ASSIGNMENT"; payload: string }
  | { type: "SET_RESOURCES"; payload: Resource[] }
  | { type: "SET_PROJECTS"; payload: Project[] }
  | { type: "SET_DATE"; payload: Date }
  | { type: "SET_ACTIVE_SHIFT"; payload: ShiftId | "all" }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "SET_FILTERS"; payload: Partial<SchedulingFilters> }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "BATCH_UPDATE"; payload: Assignment[] }

// Initial state
const initialFilters: SchedulingFilters = {
  shiftId: "all",
  resourceIds: [],
  projectIds: [],
  statuses: [],
  showOvertime: true,
}

const initialState: SchedulingState = {
  assignments: [],
  resources: [],
  projects: [],
  selectedDate: new Date(),
  activeShift: "all",
  viewMode: "day",
  filters: initialFilters,
  isLoading: false,
  error: null,
}

// Reducer
function schedulingReducer(
  state: SchedulingState,
  action: SchedulingAction
): SchedulingState {
  switch (action.type) {
    case "SET_ASSIGNMENTS":
      return { ...state, assignments: action.payload }

    case "ADD_ASSIGNMENT":
      return {
        ...state,
        assignments: [...state.assignments, action.payload],
      }

    case "UPDATE_ASSIGNMENT":
      return {
        ...state,
        assignments: state.assignments.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload.updates } : a
        ),
      }

    case "MOVE_ASSIGNMENT":
      return {
        ...state,
        assignments: state.assignments.map((a) =>
          a.id === action.payload.id
            ? {
                ...a,
                startTime: action.payload.newTime,
                resourceId: action.payload.newResourceId,
              }
            : a
        ),
      }

    case "DELETE_ASSIGNMENT":
      return {
        ...state,
        assignments: state.assignments.filter((a) => a.id !== action.payload),
      }

    case "SET_RESOURCES":
      return { ...state, resources: action.payload }

    case "SET_PROJECTS":
      return { ...state, projects: action.payload }

    case "SET_DATE":
      return { ...state, selectedDate: action.payload }

    case "SET_ACTIVE_SHIFT":
      return { ...state, activeShift: action.payload }

    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload }

    case "SET_FILTERS":
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload }

    case "SET_ERROR":
      return { ...state, error: action.payload }

    case "BATCH_UPDATE":
      const updatedMap = new Map(action.payload.map((a) => [a.id, a]))
      return {
        ...state,
        assignments: state.assignments.map((a) => updatedMap.get(a.id) || a),
      }

    default:
      return state
  }
}

// Context value interface
interface SchedulingContextValue extends SchedulingState {
  // Assignment operations
  addAssignment: (assignment: Omit<Assignment, "id">) => Assignment
  createAssignment: (assignment: Omit<Assignment, "id">) => Assignment // Alias for addAssignment
  updateAssignment: (id: string, updates: Partial<Assignment>) => void
  moveAssignment: (id: string, newTime: string, newResourceId: string) => void
  deleteAssignment: (id: string) => void
  setAssignmentStatus: (id: string, status: AssignmentStatus) => void

  // Data setters
  setAssignments: (assignments: Assignment[]) => void
  setResources: (resources: Resource[]) => void
  setProjects: (projects: Project[]) => void

  // View controls
  setSelectedDate: (date: Date) => void
  setActiveShift: (shift: ShiftId | "all") => void
  setViewMode: (mode: ViewMode) => void
  setFilters: (filters: Partial<SchedulingFilters>) => void

  // Computed values
  filteredAssignments: Assignment[]
  filteredResources: Resource[]

  // Loading state
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// Create context
const SchedulingContext = createContext<SchedulingContextValue | null>(null)

// Provider component
interface SchedulingProviderProps {
  children: ReactNode
  initialAssignments?: Assignment[]
  initialResources?: Resource[]
  initialProjects?: Project[]
}

export function SchedulingProvider({
  children,
  initialAssignments = [],
  initialResources = [],
  initialProjects = [],
}: SchedulingProviderProps) {
  const [state, dispatch] = useReducer(schedulingReducer, {
    ...initialState,
    assignments: initialAssignments,
    resources: initialResources,
    projects: initialProjects,
  })

  // Generate unique ID
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Assignment operations
  const addAssignment = useCallback(
    (assignment: Omit<Assignment, "id">) => {
      const newAssignment: Assignment = {
        ...assignment,
        id: assignment.id || generateId(),
      }
      dispatch({ type: "ADD_ASSIGNMENT", payload: newAssignment })
      return newAssignment
    },
    [generateId]
  )

  const updateAssignment = useCallback(
    (id: string, updates: Partial<Assignment>) => {
      dispatch({ type: "UPDATE_ASSIGNMENT", payload: { id, updates } })
    },
    []
  )

  const moveAssignment = useCallback(
    (id: string, newTime: string, newResourceId: string) => {
      dispatch({
        type: "MOVE_ASSIGNMENT",
        payload: { id, newTime, newResourceId },
      })
    },
    []
  )

  const deleteAssignment = useCallback((id: string) => {
    dispatch({ type: "DELETE_ASSIGNMENT", payload: id })
  }, [])

  const setAssignmentStatus = useCallback(
    (id: string, status: AssignmentStatus) => {
      dispatch({ type: "UPDATE_ASSIGNMENT", payload: { id, updates: { status } } })
    },
    []
  )

  // Data setters
  const setAssignments = useCallback((assignments: Assignment[]) => {
    dispatch({ type: "SET_ASSIGNMENTS", payload: assignments })
  }, [])

  const setResources = useCallback((resources: Resource[]) => {
    dispatch({ type: "SET_RESOURCES", payload: resources })
  }, [])

  const setProjects = useCallback((projects: Project[]) => {
    dispatch({ type: "SET_PROJECTS", payload: projects })
  }, [])

  // View controls
  const setSelectedDate = useCallback((date: Date) => {
    dispatch({ type: "SET_DATE", payload: date })
  }, [])

  const setActiveShift = useCallback((shift: ShiftId | "all") => {
    dispatch({ type: "SET_ACTIVE_SHIFT", payload: shift })
  }, [])

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: "SET_VIEW_MODE", payload: mode })
  }, [])

  const setFilters = useCallback((filters: Partial<SchedulingFilters>) => {
    dispatch({ type: "SET_FILTERS", payload: filters })
  }, [])

  // Loading state
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error })
  }, [])

  // Filtered assignments based on current filters
  const filteredAssignments = useMemo(() => {
    let result = state.assignments

    // Filter by shift
    if (state.activeShift !== "all") {
      result = result.filter((a) => a.shiftId === state.activeShift)
    }

    // Filter by resource IDs
    if (state.filters.resourceIds.length > 0) {
      result = result.filter((a) =>
        state.filters.resourceIds.includes(a.resourceId)
      )
    }

    // Filter by project IDs
    if (state.filters.projectIds.length > 0) {
      result = result.filter((a) =>
        state.filters.projectIds.includes(a.projectId)
      )
    }

    // Filter by status
    if (state.filters.statuses.length > 0) {
      result = result.filter((a) => state.filters.statuses.includes(a.status))
    }

    // Filter overtime
    if (!state.filters.showOvertime) {
      result = result.filter((a) => !a.isOvertime)
    }

    return result
  }, [state.assignments, state.activeShift, state.filters])

  // Filtered resources based on active shift
  const filteredResources = useMemo(() => {
    if (state.activeShift === "all") {
      return state.resources.filter((r) => r.isActive)
    }
    return state.resources.filter(
      (r) => r.shiftId === state.activeShift && r.isActive
    )
  }, [state.resources, state.activeShift])

  const value: SchedulingContextValue = {
    ...state,
    addAssignment,
    createAssignment: addAssignment, // Alias for addAssignment
    updateAssignment,
    moveAssignment,
    deleteAssignment,
    setAssignmentStatus,
    setAssignments,
    setResources,
    setProjects,
    setSelectedDate,
    setActiveShift,
    setViewMode,
    setFilters,
    setLoading,
    setError,
    filteredAssignments,
    filteredResources,
  }

  return (
    <SchedulingContext.Provider value={value}>
      {children}
    </SchedulingContext.Provider>
  )
}

// Hook to use the scheduling context
export function useScheduling() {
  const context = useContext(SchedulingContext)
  if (!context) {
    throw new Error("useScheduling must be used within a SchedulingProvider")
  }
  return context
}

// Export context for testing
export { SchedulingContext }
