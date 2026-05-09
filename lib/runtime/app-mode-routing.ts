import type { AppLaunchMode } from '@/lib/runtime/app-mode-types'

/**
 * Returns the route the user should land on after completing the launch/onboarding flow.
 *
 * @param mode      - The selected AppLaunchMode.
 * @param badge     - Optional badge number; used to produce a personalised workspace URL
 *                    in DEPARTMENT mode (e.g. /1234 → workspace dashboard).
 */
export function getPostLaunchRouteForMode(mode: AppLaunchMode, badge?: string): string {
  switch (mode) {
    case 'DEPARTMENT':
      // Route to the badge-specific workspace dashboard if we know the badge,
      // otherwise fall back to the shared 380 launcher.
      return badge ? `/${badge}` : '/380'
    case 'WORKSPACE':
      // Workspace-only mode: land on the 380 board / launcher page.
      return '/380'
    case 'STANDALONE_TOOL':
      // Standalone utility mode: open the standalone build tool entry point.
      return '/standalone'
    default:
      return '/380'
  }
}

