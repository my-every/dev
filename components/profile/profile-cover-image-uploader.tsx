'use client'

import * as React from 'react'
import { Camera, Upload, Trash2, Move } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ============================================================================
// PROFILE COVER IMAGE UPLOADER
// ============================================================================

interface ProfileCoverImageUploaderProps {
  onImageChange?: (file: File) => void
  onRemove?: () => void
  onReposition?: () => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function ProfileCoverImageUploader({
  onImageChange,
  onRemove,
  onReposition,
  isOpen,
  onOpenChange,
  className,
}: ProfileCoverImageUploaderProps) {
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
            size="sm"
            className={cn(
              'absolute right-4 top-4 gap-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70',
              className
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit Cover</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Cover
          </DropdownMenuItem>
          {onReposition && (
            <DropdownMenuItem onClick={() => { onReposition(); onOpenChange?.(false) }}>
              <Move className="mr-2 h-4 w-4" />
              Reposition
            </DropdownMenuItem>
          )}
          {onRemove && (
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Cover
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
