"use client"

/**
 * Revision Panel Wrapper
 *
 * Thin convenience wrapper around the `useRevisionPanel` hook.
 * Accepts a render-prop `children` function for backward compatibility.
 *
 * Prefer using the hook directly so that WorkspaceLayout can be the
 * outermost layout shell (see the sheet detail page).
 */

import { useRevisionPanel, type UseRevisionPanelOptions, type RevisionPanelState } from "./use-revision-panel"

// ============================================================================
// Props
// ============================================================================

interface RevisionPanelWrapperProps extends UseRevisionPanelOptions {
  /** Render function receiving sidebar JSX and revision state.
   *  The caller is responsible for composing the sidebar + content layout. */
  children: (state: RevisionPanelState) => React.ReactNode
}

// ============================================================================
// Component
// ============================================================================

export function RevisionPanelWrapper({
  children,
  ...options
}: RevisionPanelWrapperProps) {
  const state = useRevisionPanel(options)
  return <>{children(state)}</>
}
