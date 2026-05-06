'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

/**
 * Full-page skeleton that mirrors the Profile page layout:
 * - Sticky header bar
 * - ProfileHeader card (cover image + avatar + identity + stats)
 * - Quick Actions section
 * - Dashboard widget grid
 */
export function ProfileSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background animate-in fade-in duration-300">
      {/* Top bar skeleton */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="hidden sm:block h-6 w-20 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </header>

      {/* Content skeleton */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Profile header card skeleton */}
          <Card className="overflow-hidden rounded-2xl border-0 shadow-lg">
            {/* Cover image */}
            <Skeleton className="h-36 sm:h-44 md:h-52 w-full rounded-none" />

            <div className="relative px-4 pb-5 pt-0 sm:px-6 md:px-8">
              {/* Avatar */}
              <div className="relative -mt-16 mb-4 flex items-end justify-between sm:-mt-20">
                <Skeleton className="h-24 w-24 rounded-full border-4 border-background sm:h-28 sm:w-28 md:h-32 md:w-32" />
                <div className="flex items-center gap-2 pt-20 sm:pt-24">
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>

              {/* Identity block */}
              <div className="mb-5 space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex gap-1.5 mt-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-3 text-center space-y-2">
                    <Skeleton className="h-6 w-10 mx-auto" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Quick Actions skeleton */}
          <section>
            <Skeleton className="h-4 w-28 mb-3" />
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-md" />
              ))}
            </div>
          </section>

          {/* Dashboard widget grid skeleton */}
          <section>
            <Skeleton className="h-4 w-24 mb-3" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
