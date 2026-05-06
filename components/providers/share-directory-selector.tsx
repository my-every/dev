'use client'

import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Loader2 } from 'lucide-react'

import { useAppRuntime } from '@/components/providers/app-runtime-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ShareDirectorySource = 'env' | 'config' | 'default'

interface ShareDirectorySettings {
  shareDirectory: string
  source: ShareDirectorySource
}

export function ShareDirectorySelector() {
  const { isElectron, chooseWorkspaceRoot, isSelectingWorkspace } = useAppRuntime()
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<ShareDirectorySettings | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/runtime/share-directory', { cache: 'no-store' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load Share directory settings')
      }

      const nextSettings = await response.json() as ShareDirectorySettings
      setSettings(nextSettings)
      setInputValue(nextSettings.shareDirectory)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load Share directory settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void loadSettings()
  }, [isOpen, loadSettings])

  const handleBrowse = useCallback(async () => {
    setErrorMessage(null)
    setStatusMessage(null)

    const selected = await chooseWorkspaceRoot()
    if (!selected) {
      return
    }

    setInputValue(selected)
  }, [chooseWorkspaceRoot])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const response = await fetch('/api/runtime/share-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shareDirectory: inputValue || null }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save Share directory settings')
      }

      const nextSettings = await response.json() as ShareDirectorySettings
      setSettings(nextSettings)
      setInputValue(nextSettings.shareDirectory)
      setStatusMessage(`Share directory set to ${nextSettings.shareDirectory}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save Share directory settings')
    } finally {
      setIsSaving(false)
    }
  }, [inputValue])

  if (!mounted || !isElectron) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='fixed bottom-4 left-4 z-40 h-9 gap-1.5 bg-background/95 backdrop-blur'
        >
          <FolderOpen className='h-4 w-4' />
          Share Folder
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Share Folder Location</DialogTitle>
          <DialogDescription>
            Choose where Share files are read and written. New saves will use this folder.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3 py-2'>
          <div className='grid gap-2'>
            <Label htmlFor='share-directory-path'>Share Directory</Label>
            <Input
              id='share-directory-path'
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder='/path/to/Share'
              disabled={isLoading || isSaving}
            />
          </div>

          <div className='text-xs text-muted-foreground'>
            Source: {settings?.source ?? 'unknown'}
          </div>

          {errorMessage ? (
            <div className='rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700'>
              {errorMessage}
            </div>
          ) : null}

          {statusMessage ? (
            <div className='rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700'>
              {statusMessage}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='secondary'
            onClick={() => void handleBrowse()}
            disabled={isLoading || isSaving || isSelectingWorkspace}
          >
            {isSelectingWorkspace ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            Browse
          </Button>
          <Button
            type='button'
            onClick={() => void handleSave()}
            disabled={isLoading || isSaving}
          >
            {isSaving ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
