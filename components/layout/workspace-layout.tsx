"use client"

/**
 * WorkspaceLayout
 *
 * Reusable full-viewport layout with four configurable slots:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │  ┌─────────┬────────────────────────────────────────┐  │
 *   │  │  side   │  subheader  (pinned, shrink-0)         │  │
 *   │  │  panel  ├────────────────────────────────────────┤  │
 *   │  │         │  children   (flex-1, scrollable)       │  │
 *   │  │         │                                        │  │
 *   │  └─────────┴────────────────────────────────────────┘  │
 *   │              ┌──────────────────────┐                  │
 *   │              │  toolbar (floating)  │                  │
 *   │              └──────────────────────┘                  │
 *   │  overlays (dialogs / modals)                           │
 *   └────────────────────────────────────────────────────────┘
 *
 * The page itself never scrolls — only the children content area does.
 * Each slot is optional and fully configurable per page.
 */

import { cn } from "@/lib/utils"

export interface WorkspaceLayoutProps {
  /** Side panel rendered in the left column. */
  sidePanel?: React.ReactNode
  /** Pinned header above the scrollable content area. */
  subheader?: React.ReactNode
  /** Floating toolbar (positioned fixed at the bottom). */
  toolbar?: React.ReactNode
  /** Overlay elements rendered outside layout flow (dialogs, modals). */
  overlays?: React.ReactNode
  /** Scrollable main content. */
  children: React.ReactNode
  /** Additional className for the outer `<main>` element. */
  className?: string
  /** Additional className for the inner content column. */
  contentClassName?: string
  /** Additional className for the scrollable children wrapper. */
  scrollClassName?: string
}

export function WorkspaceLayout({
  sidePanel,
  subheader,
  toolbar,
  overlays,
  children,
  className,
  contentClassName,
  scrollClassName,
}: WorkspaceLayoutProps) {
  return (
    <main className={cn("h-screen overflow-hidden bg-accent flex flex-col flex-1 p-4", className)}>
      <div className="flex h-full min-h-0 rounded-xl items-stretch overflow-hidden">
        {/* Side Panel (left column) */}
        {sidePanel}

        {/* Content Column */}
        <div
          className={cn(
            "flex min-h-0 flex-1 min-w-0 flex-col p-4 gap-4 rounded-none bg-background self-stretch overflow-hidden",
            contentClassName,
          )}
        >
          {/* Pinned Subheader */}
          {subheader && <div className="shrink-0">{subheader}</div>}

          {/* Scrollable Content */}
          <div className={cn("flex-1 min-h-0 overflow-y-auto", scrollClassName)}>
            {children}
          </div>
        </div>
      </div>

      {/* Floating Toolbar */}
      {toolbar}

      {/* Overlays */}
      {overlays}
    </main>
  )
}
