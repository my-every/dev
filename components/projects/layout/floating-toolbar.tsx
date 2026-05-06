'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Plus, User, LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@/components/ui/tooltip'
import { ProjectUploadFlow } from '@/components/projects/project-upload-flow'
import { ProfileLoginFlow } from '@/components/profile/profile-login-flow'
import { useSession } from '@/hooks/use-session'

export function D380FloatingToolbar() {
    const [uploadOpen, setUploadOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const { isAuthenticated } = useSession()

    // Only render on /projects exactly, not subroutes like /projects/upload or /projects/[id]
    const isProjectsRoot = pathname === '/projects'

    useEffect(() => {
        if (!isProjectsRoot) {
            setUploadOpen(false)
        }
    }, [isProjectsRoot])

    if (!isProjectsRoot) return null

    return (
        <>
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/86 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                size="icon"
                                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => setUploadOpen(true)}
                            >
                                <Plus className="size-4" />
                                <span className="sr-only">Upload Project</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Upload Project</TooltipContent>
                    </Tooltip>

                    {isAuthenticated ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="rounded-full"
                                    onClick={() => router.push('/profile')}
                                >
                                    <User className="size-4" />
                                    <span className="sr-only">My Profile</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">My Profile</TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                            <ProfileLoginFlow side="top" align="end">
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="rounded-full"
                                    >
                                        <LogIn className="size-4" />
                                        <span className="sr-only">Sign In</span>
                                    </Button>
                                </TooltipTrigger>
                            </ProfileLoginFlow>
                            <TooltipContent side="top">Sign In</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
                    <DialogTitle className="sr-only">Upload Project</DialogTitle>
                    <ProjectUploadFlow
                        mode="create"
                        onClose={() => setUploadOpen(false)}
                        onCancel={() => setUploadOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}
