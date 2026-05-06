'use client'

import { type ReactNode, useState, useCallback, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BellRing, Search, X, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export type ToolbarActionType = 'button' | 'link' | 'popover' | 'modal' | 'sheet'

export interface ToolbarAction {
    id: string
    type: ToolbarActionType
    icon: LucideIcon
    label: string
    /** For link type */
    href?: string
    /** Badge count to show */
    badge?: number
    /** Whether this is a primary action (filled button) */
    primary?: boolean
    /** For popover/modal/sheet types - the content to render */
    content?: ReactNode
    /** Sheet side */
    sheetSide?: 'left' | 'right' | 'top' | 'bottom'
    /** Sheet width class */
    sheetWidth?: string
    /** Modal/sheet title */
    title?: string
    /** Modal/sheet description */
    description?: string
    /** onClick handler for button type */
    onClick?: () => void
}

export interface ToolbarConfig {
    /** Left section items (typically branding/context info) */
    leftContent?: ReactNode
    /** Center actions */
    actions: ToolbarAction[]
    /** Whether to show the command search */
    showSearch?: boolean
    /** Command items for search */
    commandItems?: Array<{
        id: string
        label: string
        description?: string
        href: string
        group?: string
        icon?: LucideIcon
    }>
    /** Notification count (shows bell icon if provided) */
    notificationCount?: number
    /** Notification href */
    notificationHref?: string
}

// ============================================================================
// Context for toolbar state
// ============================================================================

interface ToolbarContextValue {
    openPopover: string | null
    setOpenPopover: (id: string | null) => void
    openModal: string | null
    setOpenModal: (id: string | null) => void
    openSheet: string | null
    setOpenSheet: (id: string | null) => void
}

const ToolbarContext = createContext<ToolbarContextValue | null>(null)

function useToolbarContext() {
    const ctx = useContext(ToolbarContext)
    if (!ctx) throw new Error('useToolbarContext must be used within ToolbarProvider')
    return ctx
}

// ============================================================================
// Action Button Component
// ============================================================================

function ToolbarActionButton({ action }: { action: ToolbarAction }) {
    const { openPopover, setOpenPopover, setOpenModal, setOpenSheet } = useToolbarContext()

    const buttonContent = (
        <>
            <action.icon className="size-4" />
            {action.badge !== undefined && action.badge > 0 && (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {action.badge > 99 ? '99+' : action.badge}
                </span>
            )}
            <span className="sr-only">{action.label}</span>
        </>
    )

    const buttonClass = cn(
        'rounded-full relative',
        action.primary ? '' : ''
    )

    // Link type
    if (action.type === 'link' && action.href) {
        return (
            <Button
                asChild
                type="button"
                variant={action.primary ? 'default' : 'outline'}
                size="icon"
                className={buttonClass}
            >
                <Link href={action.href}>{buttonContent}</Link>
            </Button>
        )
    }

    // Button type
    if (action.type === 'button') {
        return (
            <Button
                type="button"
                variant={action.primary ? 'default' : 'outline'}
                size="icon"
                className={buttonClass}
                onClick={action.onClick}
            >
                {buttonContent}
            </Button>
        )
    }

    // Popover type
    if (action.type === 'popover') {
        return (
            <Popover open={openPopover === action.id} onOpenChange={(open) => setOpenPopover(open ? action.id : null)}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant={action.primary ? 'default' : 'outline'}
                        size="icon"
                        className={buttonClass}
                    >
                        {buttonContent}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="center" side="top" sideOffset={12}>
                    {action.content}
                </PopoverContent>
            </Popover>
        )
    }

    // Modal type
    if (action.type === 'modal') {
        return (
            <Button
                type="button"
                variant={action.primary ? 'default' : 'outline'}
                size="icon"
                className={buttonClass}
                onClick={() => setOpenModal(action.id)}
            >
                {buttonContent}
            </Button>
        )
    }

    // Sheet type
    if (action.type === 'sheet') {
        return (
            <Button
                type="button"
                variant={action.primary ? 'default' : 'outline'}
                size="icon"
                className={buttonClass}
                onClick={() => setOpenSheet(action.id)}
            >
                {buttonContent}
            </Button>
        )
    }

    return null
}

// ============================================================================
// Main Toolbar Component
// ============================================================================

export function D380ContextToolbar({ config }: { config: ToolbarConfig }) {
    const router = useRouter()
    const [openPopover, setOpenPopover] = useState<string | null>(null)
    const [openModal, setOpenModal] = useState<string | null>(null)
    const [openSheet, setOpenSheet] = useState<string | null>(null)
    const [commandOpen, setCommandOpen] = useState(false)

    const contextValue: ToolbarContextValue = {
        openPopover,
        setOpenPopover,
        openModal,
        setOpenModal,
        openSheet,
        setOpenSheet,
    }

    // Find modal and sheet actions for rendering dialogs
    const modalActions = config.actions.filter(a => a.type === 'modal')
    const sheetActions = config.actions.filter(a => a.type === 'sheet')

    return (
        <ToolbarContext.Provider value={contextValue}>
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/90 p-2 shadow-lg backdrop-blur-xl">
                    {/* Left content */}
                    {config.leftContent && (
                        <div className="hidden items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm text-foreground/70 lg:flex">
                            {config.leftContent}
                        </div>
                    )}

                    {/* Search button */}
                    {config.showSearch && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-full"
                            onClick={() => setCommandOpen(true)}
                        >
                            <Search className="size-4" />
                            <span className="sr-only">Open command center</span>
                        </Button>
                    )}

                    {/* Action buttons */}
                    {config.actions.map(action => (
                        <ToolbarActionButton key={action.id} action={action} />
                    ))}

                    {/* Notifications */}
                    {config.notificationHref && (
                        <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="icon"
                            className="relative rounded-full"
                        >
                            <Link href={config.notificationHref}>
                                <BellRing className="size-4" />
                                {config.notificationCount !== undefined && config.notificationCount > 0 && (
                                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                        {config.notificationCount > 99 ? '99+' : config.notificationCount}
                                    </span>
                                )}
                                <span className="sr-only">Notifications</span>
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {/* Command Dialog */}
            {config.showSearch && config.commandItems && (
                <CommandDialog
                    open={commandOpen}
                    onOpenChange={setCommandOpen}
                    className="sm:max-w-2xl"
                    title="Command Center"
                    description="Search and navigate"
                >
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        {/* Group by group property */}
                        {Array.from(new Set(config.commandItems.map(i => i.group || 'Actions'))).map(group => (
                            <CommandGroup key={group} heading={group}>
                                {config.commandItems!
                                    .filter(item => (item.group || 'Actions') === group)
                                    .map(item => (
                                        <CommandItem
                                            key={item.id}
                                            value={`${item.label} ${item.description || ''}`}
                                            onSelect={() => {
                                                router.push(item.href)
                                                setCommandOpen(false)
                                            }}
                                        >
                                            {item.icon && <item.icon className="size-4" />}
                                            <div className="flex flex-col gap-0.5">
                                                <span>{item.label}</span>
                                                {item.description && (
                                                    <span className="text-xs text-muted-foreground">{item.description}</span>
                                                )}
                                            </div>
                                        </CommandItem>
                                    ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </CommandDialog>
            )}

            {/* Modal Dialogs */}
            {modalActions.map(action => (
                <Dialog
                    key={action.id}
                    open={openModal === action.id}
                    onOpenChange={(open) => setOpenModal(open ? action.id : null)}
                >
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{action.title || action.label}</DialogTitle>
                            {action.description && (
                                <DialogDescription>{action.description}</DialogDescription>
                            )}
                        </DialogHeader>
                        {action.content}
                    </DialogContent>
                </Dialog>
            ))}

            {/* Sheet Panels */}
            {sheetActions.map(action => (
                <Sheet
                    key={action.id}
                    open={openSheet === action.id}
                    onOpenChange={(open) => setOpenSheet(open ? action.id : null)}
                >
                    <SheetContent
                        side={action.sheetSide || 'right'}
                        className={cn('w-full gap-0 max-h-[88vh]', action.sheetWidth || 'sm:max-w-lg')}
                    >
                        <SheetHeader className="border-b border-border/70 pb-4">
                            <SheetTitle>{action.title || action.label}</SheetTitle>
                            {action.description && (
                                <SheetDescription>{action.description}</SheetDescription>
                            )}
                        </SheetHeader>
                        <div className="flex-1 overflow-auto p-4">
                            {action.content}
                        </div>
                    </SheetContent>
                </Sheet>
            ))}
        </ToolbarContext.Provider>
    )
}

// ============================================================================
// Hook for building toolbar config based on route
// ============================================================================

export function useToolbarConfig(): ToolbarConfig | null {
    const pathname = usePathname()

    // Return null for routes that don't need a toolbar
    if (pathname === '/380/startup' || pathname.startsWith('/380/startup/')) {
        return null
    }

    // Default empty config - routes should provide their own
    return null
}
