import type { AppLaunchMode } from '@/lib/runtime/app-mode-types'

export function getPostLaunchRouteForMode(mode: AppLaunchMode): string {
  void mode
  return '/380'
}
