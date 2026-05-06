import { FirstLaunchModeSelector } from '@/components/providers/first-launch-mode-selector'

export const dynamic = 'force-dynamic'

export default function StartupPage() {
  return <FirstLaunchModeSelector allowRevisit />
}
