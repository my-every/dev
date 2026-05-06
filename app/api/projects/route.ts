import { NextResponse } from 'next/server'

import { listStoredProjects } from '@/lib/project-state/share-project-state-handlers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const manifests = await listStoredProjects()
  return NextResponse.json({ manifests })
}