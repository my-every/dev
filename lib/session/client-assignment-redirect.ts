export async function resolveAssignmentRedirectHref(badge: string): Promise<string | null> {
  const normalizedBadge = badge.trim().replace(/\D/g, '')
  if (!normalizedBadge) {
    return null
  }

  try {
    const response = await fetch(`/api/session/assignment-redirect?badge=${encodeURIComponent(normalizedBadge)}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json() as { href?: string | null }
    return payload.href ?? null
  } catch {
    return null
  }
}
