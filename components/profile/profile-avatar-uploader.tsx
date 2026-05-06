'use client'

import * as React from 'react'
import { Camera, Upload, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ============================================================================
// PROFILE AVATAR UPLOADER
// ============================================================================

interface ProfileAvatarUploaderProps {
  onImageChange?: (file: File) => void
  onRemove?: () => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function ProfileAvatarUploader({
  onImageChange,
  onRemove,
  isOpen,
  onOpenChange,
  className,
}: ProfileAvatarUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && onImageChange) {
      onImageChange(file)
    }
    onOpenChange?.(false)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              'absolute bottom-0 right-0 h-8 w-8 rounded-full border-2 border-background shadow-md',
              className
            )}
          >
            <Camera className="h-4 w-4" />
            <span className="sr-only">Change avatar</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Photo
          </DropdownMenuItem>
          {onRemove && (
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
