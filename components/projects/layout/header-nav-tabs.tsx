'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { D380Logo } from '@/components/projects/layout/logo'
import { getD380ShellNavItems } from '@/lib/view-models/d380-shell'
import { cn } from '@/lib/utils'

function isActivePath(pathname: string, href: string) {
    if (href === '/projects') {
        return pathname === '/projects'
    }

    if (href === '/projects/leader-board') {
        return pathname.startsWith('/projects/leader-board') || pathname.startsWith('/projects/leaderboard')
    }

    return pathname.startsWith(href)
}

export function D380HeaderNavTabs() {
    const pathname = usePathname()
    const navItems = getD380ShellNavItems()

    return (
        <header className="sticky top-0 z-40 backdrop-blur-xl">
            <div className="mx-auto flex max-w-360 items-center gap-4 px-4 py-4 sm:px-6 md:px-10">
                <Link href="/380" className="min-w-fit flex items-center gap-3 transition-opacity hover:opacity-80">
                    <D380Logo size="md" />
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-foreground/46">Department</div>
                        <div className="text-xl font-semibold tracking-tight text-foreground">D380</div>
                    </div>
                </Link>

                <div className="min-w-0 flex-1 overflow-x-auto">
                    <nav className="mx-auto flex w-max items-center rounded-full border border-border/70 bg-card/88 p-1 shadow-[0_12px_36px_rgba(0,0,0,0.08)]">
                        {navItems.map(item => {
                            const active = isActivePath(pathname, item.href)

                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    className={cn(
                                        'rounded-full px-4 py-2 text-sm font-medium text-foreground/66 transition-colors sm:px-5',
                                        active && 'bg-primary text-primary-foreground shadow-sm',
                                    )}
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>
                </div>

            </div>
        </header>
    )
}
