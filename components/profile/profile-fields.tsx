'use client'

import * as React from 'react'
import {
    Mail,
    MapPin,
    Calendar,
    Building,
    Clock,
    Phone,
    Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import type { UserProfile, UserStatus } from '@/types/profile'
import { STATUS_DISPLAY_CONFIG } from '@/types/profile'
import { ProfileAvatarUploader } from './profile-avatar-uploader'
import { getAvatarColor, getAvatarInitials } from '@/lib/profile/avatar-utils'


// ============================================================================
// ProfileAvatar — Reusable avatar with initials fallback + status dot
// ============================================================================

interface ProfileAvatarProps {
    fullName: string
    preferredName?: string
    avatarUrl?: string
    status?: UserStatus
    size?: 'sm' | 'md' | 'lg'
    /** Show the editable camera button overlay */
    editable?: boolean
    onImageChange?: (file: File) => void
    isEditOpen?: boolean
    onEditOpenChange?: (open: boolean) => void
    /** Stable key for deterministic color (e.g. badge number) */
    colorKey?: string
    className?: string
}

const AVATAR_SIZE_CLASSES = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32',
} as const

const AVATAR_TEXT_CLASSES = {
    sm: 'text-xs',
    md: 'text-base',
    lg: 'text-xl sm:text-2xl',
} as const

const STATUS_DOT_SIZE = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
} as const

const STATUS_DOT_POSITION = {
    sm: 'top-1 right-0',
    md: 'top-3 right-0.5',
    lg: 'top-5 right-1',
} as const

// getInitials moved to @/lib/profile/avatar-utils as getAvatarInitials

export function ProfileAvatar({
    fullName,
    preferredName,
    avatarUrl,
    status,
    size = 'lg',
    editable,
    onImageChange,
    isEditOpen,
    onEditOpenChange,
    colorKey,
    className,
}: ProfileAvatarProps) {
    const initials = React.useMemo(
        () => getAvatarInitials(fullName, preferredName),
        [fullName, preferredName],
    )

    const color = React.useMemo(
        () => getAvatarColor(colorKey || fullName),
        [colorKey, fullName],
    )

    const statusConfig = status ? STATUS_DISPLAY_CONFIG[status] : null

    return (
        <div className={cn('relative max-w-max', className)}>
            <Avatar className={cn('border-4 border-background shadow-xl', AVATAR_SIZE_CLASSES[size])}>
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
                <AvatarFallback className={cn('font-bold', color.bg, color.text, AVATAR_TEXT_CLASSES[size])}>
                    {initials}
                </AvatarFallback>

            </Avatar>

            {editable && (
                <ProfileAvatarUploader
                    onImageChange={onImageChange}
                    isOpen={isEditOpen}
                    onOpenChange={onEditOpenChange}
                />
            )}

            {statusConfig && (
                <span className={cn(
                    'absolute flex items-center justify-center',
                    STATUS_DOT_POSITION[size],
                    STATUS_DOT_SIZE[size],
                )}>
                    {/* Ping ring */}
                    <motion.span
                        className={cn(
                            'absolute inset-0 rounded-full',
                            statusConfig.dotColor,
                        )}
                        animate={{ scale: [1, 1.8, 1.8], opacity: [0.6, 0, 0] }}
                        transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: 'easeOut',
                        }}
                    />
                    {/* Solid dot */}
                    <motion.span
                        className={cn(
                            'relative rounded-full border-background w-full h-full',
                            statusConfig.dotColor,
                            size === 'sm' ? 'border' : 'border-2',
                        )}
                        animate={{ scale: 1.15 }}
                        transition={{
                            type: 'spring',
                            duration: 0.9,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            bounce: 0.4,
                        }}
                    />
                </span>
            )}

        </div>
    )
}

// ============================================================================
// ProfileIdentity — Name heading + role badge + status badge
// ============================================================================

interface ProfileIdentityProps {
    preferredName?: string
    fullName: string
    title?: string
    children?: React.ReactNode
    className?: string
}

export function ProfileIdentity({
    preferredName,
    fullName,
    title,
    children,
    className,
}: ProfileIdentityProps) {
    return (
        <div className={cn('space-y-0.5', className)}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                    {preferredName || fullName}
                </h1>
                {children}
            </div>

            {!preferredName && (
                <p className="text-sm text-muted-foreground">{fullName}</p>
            )}

            {title && (
                <p className="mt-1 text-sm font-medium text-muted-foreground">{title}</p>
            )}
        </div>
    )
}

// ============================================================================
// ProfileMetaItem — A single icon + text chip for the meta info row
// ============================================================================

interface ProfileMetaItemProps {
    icon: React.ElementType
    children: React.ReactNode
    className?: string
}

export function ProfileMetaItem({ icon: Icon, children, className }: ProfileMetaItemProps) {
    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="text-xs">{children}</span>
        </div>
    )
}

// ============================================================================
// ProfileMetaRow — Flex-wrap row of meta items built from a UserProfile
// ============================================================================

interface ProfileMetaRowProps {
    profile: Pick<UserProfile, 'badgeId' | 'email' | 'location' | 'department' | 'shift' | 'joinedAt'>
    className?: string
}

export function ProfileMetaRow({ profile, className }: ProfileMetaRowProps) {
    return (
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground', className)}>
            <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="font-mono text-xs">
                    {profile.badgeId}
                </Badge>
            </div>

            {profile.email && (
                <ProfileMetaItem icon={Mail}>{profile.email}</ProfileMetaItem>
            )}

            {profile.location && (
                <ProfileMetaItem icon={MapPin}>{profile.location}</ProfileMetaItem>
            )}

            {profile.department && (
                <ProfileMetaItem icon={Building}>{profile.department}</ProfileMetaItem>
            )}

            {profile.shift && (
                <ProfileMetaItem icon={Clock}>{profile.shift} Shift</ProfileMetaItem>
            )}

            {profile.joinedAt && (
                <ProfileMetaItem icon={Calendar}>
                    Started {new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </ProfileMetaItem>
            )}
        </div>
    )
}

// ============================================================================
// ProfileBio — Bio paragraph
// ============================================================================

interface ProfileBioProps {
    bio?: string
    className?: string
}

export function ProfileBio({ bio, className }: ProfileBioProps) {
    if (!bio) return null
    return (
        <p className={cn('text-sm leading-relaxed text-muted-foreground', className)}>
            {bio}
        </p>
    )
}

// ============================================================================
// ProfileStatusBadge — Standalone status badge with dot
// ============================================================================

interface ProfileStatusBadgeProps {
    status: UserStatus
    className?: string
}

export function ProfileStatusBadge({ status, className }: ProfileStatusBadgeProps) {
    const config = STATUS_DISPLAY_CONFIG[status]
    if (!config) return null
    return (
        <Badge variant="outline" className={cn('w-fit text-xs', config.color, className)}>
            <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', config.dotColor)} />
            {config.label}
        </Badge>
    )
}

// ============================================================================
// IconInput — Input with a properly centered leading icon
// ============================================================================

interface IconInputProps extends React.ComponentProps<typeof Input> {
    icon: React.ElementType
}

export function IconInput({ icon: Icon, className, ...props }: IconInputProps) {
    return (
        <div className="relative">
            <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input className={cn('pl-9', className)} {...props} />
        </div>
    )
}

// ============================================================================
// ProfileField — Label + input pair with optional icon
// ============================================================================

interface ProfileFieldProps {
    id: string
    label: string
    icon?: React.ElementType
    value: string
    placeholder?: string
    type?: string
    onChange?: (value: string) => void
    disabled?: boolean
    className?: string
}

export function ProfileField({
    id,
    label,
    icon,
    value,
    placeholder,
    type,
    onChange,
    disabled,
    className,
}: ProfileFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={id} className="text-xs">{label}</Label>
            {icon ? (
                <IconInput
                    id={id}
                    icon={icon}
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange?.(e.target.value)}
                />
            ) : (
                <Input
                    id={id}
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange?.(e.target.value)}
                />
            )}
        </div>
    )
}

// ============================================================================
// ProfileTextareaField — Label + textarea pair
// ============================================================================

interface ProfileTextareaFieldProps {
    id: string
    label: string
    value: string
    placeholder?: string
    rows?: number
    onChange?: (value: string) => void
    className?: string
}

export function ProfileTextareaField({
    id,
    label,
    value,
    placeholder,
    rows = 3,
    onChange,
    className,
}: ProfileTextareaFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={id} className="text-xs">{label}</Label>
            <Textarea
                id={id}
                rows={rows}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                className="resize-none"
            />
        </div>
    )
}

// ============================================================================
// ProfileAvatarMenu — Avatar trigger with dropdown menu for shell navigation
// ============================================================================

export interface ProfileAvatarMenuItem {
    id: string
    label: string
    onClick?: () => void
    href?: string
    separator?: boolean
}

interface ProfileAvatarMenuProps {
    fullName: string
    preferredName?: string
    avatarUrl?: string
    status?: UserStatus
    subtitle?: string
    items?: ProfileAvatarMenuItem[]
    size?: 'sm' | 'md'
    side?: 'right' | 'top' | 'bottom' | 'left'
    className?: string
}

export function ProfileAvatarMenu({
    fullName,
    preferredName,
    avatarUrl,
    status,
    subtitle,
    items = [],
    size = 'sm',
    side = 'right',
    className,
}: ProfileAvatarMenuProps) {
    const initials = React.useMemo(
        () => getAvatarInitials(fullName, preferredName),
        [fullName, preferredName],
    )

    const statusConfig = status ? STATUS_DISPLAY_CONFIG[status] : null
    const avatarSize = size === 'sm' ? 'size-7' : 'size-9'
    const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'relative flex size-11 items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:bg-accent/80',
                        className,
                    )}
                    aria-label="Account"
                >
                    <Avatar className={avatarSize}>
                        {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
                        <AvatarFallback className="text-xs font-semibold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    {statusConfig && (
                        <span
                            className={cn(
                                'absolute bottom-1.5 right-1.5 rounded-full border-2 border-background',
                                dotSize,
                                statusConfig.dotColor,
                            )}
                        />
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={side} className="w-56">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{preferredName || fullName}</p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.map((item) => (
                    <React.Fragment key={item.id}>
                        {item.separator && <DropdownMenuSeparator />}
                        <DropdownMenuItem onClick={item.onClick}>
                            {item.label}
                        </DropdownMenuItem>
                    </React.Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
