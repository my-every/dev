'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UserProfile, UserRole } from '@/types/profile'
import { ROLE_DISPLAY_CONFIG } from '@/types/profile'
import { ProfileRoleBadge } from './profile-role-badge'

// ============================================================================
// PERSONA SWITCHER - DROPDOWN VARIANT
// ============================================================================

interface PersonaSwitcherDropdownProps {
  profiles: UserProfile[]
  selectedProfile: UserProfile
  onSelect: (profile: UserProfile) => void
  className?: string
}

export function PersonaSwitcherDropdown({
  profiles,
  selectedProfile,
  onSelect,
  className,
}: PersonaSwitcherDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn('gap-2 rounded-full px-4', className)}
        >
          <ProfileRoleBadge role={selectedProfile.role} size="sm" />
          <span className="font-medium">
            {selectedProfile.preferredName || selectedProfile.fullName}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Persona</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profiles.map((profile) => {
          const config = ROLE_DISPLAY_CONFIG[profile.role]
          const isSelected = profile.id === selectedProfile.id

          return (
            <DropdownMenuItem
              key={profile.id}
              onClick={() => onSelect(profile)}
              className={cn(
                'flex items-center gap-3 py-2',
                isSelected && 'bg-muted'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                  config.bgColor,
                  config.color
                )}
              >
                {(profile.preferredName || profile.fullName)
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {profile.preferredName || profile.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {config.label}
                </p>
              </div>
              {isSelected && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================================================
// PERSONA SWITCHER - TABS VARIANT
// ============================================================================

interface PersonaSwitcherTabsProps {
  profiles: UserProfile[]
  selectedProfile: UserProfile
  onSelect: (profile: UserProfile) => void
  className?: string
}

export function PersonaSwitcherTabs({
  profiles,
  selectedProfile,
  onSelect,
  className,
}: PersonaSwitcherTabsProps) {
  return (
    <Tabs
      value={selectedProfile.id}
      onValueChange={(value) => {
        const profile = profiles.find((p) => p.id === value)
        if (profile) onSelect(profile)
      }}
      className={className}
    >
      <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
        {profiles.map((profile) => {
          const config = ROLE_DISPLAY_CONFIG[profile.role]

          return (
            <TabsTrigger
              key={profile.id}
              value={profile.id}
              className={cn(
                'gap-2 rounded-full border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-sm'
              )}
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                  config.bgColor,
                  config.color
                )}
              >
                {config.label[0]}
              </div>
              <span className="text-xs font-medium">{config.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

// ============================================================================
// PERSONA SWITCHER - SEGMENTED VARIANT
// ============================================================================

interface PersonaSwitcherSegmentedProps {
  roles: UserRole[]
  selectedRole: UserRole
  onSelect: (role: UserRole) => void
  className?: string
}

export function PersonaSwitcherSegmented({
  roles,
  selectedRole,
  onSelect,
  className,
}: PersonaSwitcherSegmentedProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-border bg-muted/50 p-1',
        className
      )}
    >
      {roles.map((role) => {
        const config = ROLE_DISPLAY_CONFIG[role]
        const isSelected = role === selectedRole

        return (
          <button
            key={role}
            onClick={() => onSelect(role)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              isSelected
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {config.label}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// COMBINED PROFILE PERSONA SWITCHER
// ============================================================================

interface ProfilePersonaSwitcherProps {
  profiles: UserProfile[]
  selectedProfile: UserProfile
  onSelect: (profile: UserProfile) => void
  variant?: 'dropdown' | 'tabs' | 'segmented'
  className?: string
}

export function ProfilePersonaSwitcher({
  profiles,
  selectedProfile,
  onSelect,
  variant = 'tabs',
  className,
}: ProfilePersonaSwitcherProps) {
  if (variant === 'dropdown') {
    return (
      <PersonaSwitcherDropdown
        profiles={profiles}
        selectedProfile={selectedProfile}
        onSelect={onSelect}
        className={className}
      />
    )
  }

  if (variant === 'segmented') {
    return (
      <PersonaSwitcherSegmented
        roles={profiles.map((p) => p.role)}
        selectedRole={selectedProfile.role}
        onSelect={(role) => {
          const profile = profiles.find((p) => p.role === role)
          if (profile) onSelect(profile)
        }}
        className={className}
      />
    )
  }

  return (
    <PersonaSwitcherTabs
      profiles={profiles}
      selectedProfile={selectedProfile}
      onSelect={onSelect}
      className={className}
    />
  )
}
