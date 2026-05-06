'use client'

import type { ReactNode } from 'react'
import { D380HeaderNavTabs } from '@/components/projects/layout/header-nav-tabs'
import { D380FloatingToolbar } from '@/components/projects/layout/floating-toolbar'

interface ProjectsShellProps {
    children: ReactNode
}

export function ProjectsShell({ children }: ProjectsShellProps) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <D380HeaderNavTabs />
            <div className="flex-1">{children}</div>
            <D380FloatingToolbar />
        </div>
    )
}
