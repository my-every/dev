/**
 * Project Field Mode System
 *
 * Every project field component supports a `mode` prop that controls
 * how the field renders:
 *
 *   create  – Full form input (text, select, cards) for creation flows.
 *   select  – Choice-box card variant for quick picking in constrained views.
 *   status  – Read-only badge with icon/color representing the current value.
 *   edit    – Click-to-open popover for inline value changes.
 *   list    – Compact row with label, value, and optional indicator.
 */

export type FieldMode = 'create' | 'select' | 'status' | 'edit' | 'list'

/** Base props shared by every field component. */
export interface BaseFieldProps {
  /** Render mode */
  mode: FieldMode
  /** Optional label override (otherwise each field supplies its own default) */
  label?: string
  /** Extra CSS class names on the root wrapper */
  className?: string
  /** Whether the field is disabled / read-only beyond what mode implies */
  disabled?: boolean
}
