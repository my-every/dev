"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { FlattenedAssignment } from "@/types/project-manifest"

interface DragDropContextValue {
  // Currently dragged item
  draggedItem: FlattenedAssignment | null
  isDragging: boolean
  
  // Drag handlers
  startDrag: (item: FlattenedAssignment) => void
  endDrag: () => void
  
  // Drop target info
  dropTarget: { stationId: string; time: string } | null
  setDropTarget: (target: { stationId: string; time: string } | null) => void
}

const DragDropContext = createContext<DragDropContextValue | null>(null)

export function useDragDrop() {
  const context = useContext(DragDropContext)
  if (!context) {
    throw new Error("useDragDrop must be used within a DragDropProvider")
  }
  return context
}

// Optional hook that doesn't throw if context is missing
export function useDragDropOptional() {
  return useContext(DragDropContext)
}

interface DragDropProviderProps {
  children: ReactNode
  onDrop?: (item: FlattenedAssignment, stationId: string, time: string) => void
}

export function DragDropProvider({ children, onDrop }: DragDropProviderProps) {
  const [draggedItem, setDraggedItem] = useState<FlattenedAssignment | null>(null)
  const [dropTarget, setDropTarget] = useState<{ stationId: string; time: string } | null>(null)

  const startDrag = useCallback((item: FlattenedAssignment) => {
    setDraggedItem(item)
  }, [])

  const endDrag = useCallback(() => {
    // If we have a valid drop target and dragged item, trigger the drop
    if (draggedItem && dropTarget && onDrop) {
      onDrop(draggedItem, dropTarget.stationId, dropTarget.time)
    }
    setDraggedItem(null)
    setDropTarget(null)
  }, [draggedItem, dropTarget, onDrop])

  return (
    <DragDropContext.Provider
      value={{
        draggedItem,
        isDragging: draggedItem !== null,
        startDrag,
        endDrag,
        dropTarget,
        setDropTarget,
      }}
    >
      {children}
    </DragDropContext.Provider>
  )
}
