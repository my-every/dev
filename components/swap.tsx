'use client';

/**
 * Drag-and-drop grid primitives built on @dnd-kit/core.
 *
 * Replaces the previous Swapy-based implementation. Each draggable slot is
 * simultaneously a drop target; dropping widget A onto widget B swaps their
 * positions. The DragHandle reads drag listeners from the nearest
 * DraggableDroppableSlot ancestor via context.
 */

import React, { createContext, useContext, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

// ─── Drag listeners context ───────────────────────────────────────────────────

type DragListeners = Record<string, React.EventHandler<React.SyntheticEvent>>;

const DragListenersContext = createContext<DragListeners>({});

// ─── DragDropGrid ─────────────────────────────────────────────────────────────

type DragDropGridProps = {
  /** Unique id for the DndContext — prevents cross-grid interference. */
  id: string;
  /** Called when a successful swap completes: receives the two widget ids. */
  onSwap?: (activeId: string, overId: string) => void;
  /** Forwarded to the wrapper div (use for grid layout classes). */
  className?: string;
  children: React.ReactNode;
  /** Render function called with the currently-dragged id for the overlay. */
  renderOverlay?: (activeId: string) => React.ReactNode;
};

export function DragDropGrid({
  id,
  onSwap,
  className,
  children,
  renderOverlay,
}: DragDropGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8 px of movement before a drag starts — prevents accidental
      // drags on click interactions inside the card.
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (over && active.id !== over.id) {
      onSwap?.(active.id as string, over.id as string);
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={className}>{children}</div>
      <DragOverlay dropAnimation={null}>
        {activeId && renderOverlay ? (
          <div className="opacity-80 shadow-2xl">{renderOverlay(activeId)}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── DraggableDroppableSlot ───────────────────────────────────────────────────

type DraggableDroppableSlotProps = {
  /** Widget id — used as both the draggable id and the droppable id. */
  id: string;
  /** Forwarded to the wrapper div (use for col-span / layout classes). */
  className?: string;
  children: React.ReactNode;
};

/**
 * A slot that is simultaneously draggable and a valid drop target.
 * Dropping widget A onto widget B causes a swap (handled by DragDropGrid).
 *
 * Drag listeners are exposed to descendant DragHandle components via context
 * rather than prop-drilling.
 */
export function DraggableDroppableSlot({
  id,
  className,
  children,
}: DraggableDroppableSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id });

  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });

  // Merge both refs onto the same element.
  const mergedRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <DragListenersContext.Provider value={(listeners ?? {}) as DragListeners}>
      <div
        ref={mergedRef}
        className={cn(
          'relative transition-opacity',
          isDragging && 'opacity-30',
          isOver && !isDragging && 'ring-2 ring-primary/50 rounded-2xl',
          className,
        )}
        {...attributes}
      >
        {children}
      </div>
    </DragListenersContext.Provider>
  );
}

// ─── DragHandle ───────────────────────────────────────────────────────────────

export function DragHandle({ className }: { className?: string }) {
  const listeners = useContext(DragListenersContext);

  return (
    <div
      {...listeners}
      className={cn(
        'absolute top-2 left-2 z-10 cursor-grab rounded-md bg-transparent',
        'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300',
        'active:cursor-grabbing',
        className,
      )}
      aria-label="Drag to reorder widget"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="5" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="15" cy="5" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="19" r="1" />
      </svg>
    </div>
  );
}
