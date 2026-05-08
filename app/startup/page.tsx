import { FirstLaunchModeSelector } from '@/components/providers/first-launch-mode-selector'

export const dynamic = 'force-dynamic'

interface StartupPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StartupPage({ searchParams }: StartupPageProps) {
  const params = await searchParams
  const revisit = params.revisit === '1'
  return <FirstLaunchModeSelector allowRevisit={revisit} />
}
