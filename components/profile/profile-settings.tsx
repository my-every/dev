'use client'

import * as React from 'react'
import {
  User,
  Mail,
  Phone,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProfileField, ProfileTextareaField } from './profile-fields'
import type { ShareUserPreferences } from '@/lib/profile/share-profile-store'

// ============================================================================
// Types
// ============================================================================

export interface ProfileSettingsData {
  preferredName: string | null
  email: string | null
  phone: string | null
  bio: string | null
  department: string | null
  title: string | null
  location: string | null
  preferences: ShareUserPreferences
}

interface ProfileSettingsProps {
  initialData: ProfileSettingsData
  onFormChange?: (data: ProfileSettingsData, isDirty: boolean) => void
  className?: string
}

// ============================================================================
// Sub-components
// ============================================================================

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ProfileSettings({ initialData, onFormChange, className }: ProfileSettingsProps) {
  const [data, setData] = React.useState<ProfileSettingsData>(initialData)

  // Sync if parent data changes
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])

  const isDirty = React.useMemo(() => {
    return JSON.stringify(data) !== JSON.stringify(initialData)
  }, [data, initialData])

  React.useEffect(() => {
    onFormChange?.(data, isDirty)
  }, [data, isDirty, onFormChange])

  // ---- field updaters ----
  const updateField = React.useCallback(
    <K extends keyof ProfileSettingsData>(key: K, value: ProfileSettingsData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <SettingsSection
          title="Personal Information"
          description="Update your profile details visible to your team."
          icon={User}
        >
          <div className="space-y-3">
            <ProfileField
              id="preferredName"
              label="Preferred Name"
              placeholder="Enter preferred name"
              value={data.preferredName ?? ''}
              onChange={(v) => updateField('preferredName', v || null)}
            />

            <ProfileField
              id="title"
              label="Job Title"
              placeholder="—"
              value={data.title ?? ''}
              disabled
            />

            <ProfileField
              id="department"
              label="Department"
              placeholder="—"
              value={data.department ?? ''}
              disabled
            />


            <Separator />

            <ProfileField
              id="email"
              label="Email"
              icon={Mail}
              type="email"
              placeholder="email@solarturbines.com"
              value={data.email ?? ''}
              onChange={(v) => updateField('email', v || null)}
            />

            <ProfileField
              id="phone"
              label="Phone"
              icon={Phone}
              type="tel"
              placeholder="(555) 123-4567"
              value={data.phone ?? ''}
              onChange={(v) => updateField('phone', v || null)}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Bio"
          description="A short description about yourself."
          icon={FileText}
        >
          <ProfileTextareaField
            id="bio"
            label="About"
            rows={3}
            placeholder="Write a short bio..."
            value={data.bio ?? ''}
            onChange={(v) => updateField('bio', v || null)}
          />
        </SettingsSection>
      </div>
    </div>
  )
}
