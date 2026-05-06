'use client'

/**
 * Data Mode Indicator
 *
 * A dev-only UI indicator showing the current data mode (mock/share/electron).
 * Only renders in development environment.
 *
 * Position: Fixed to bottom-right corner
 * Visibility: Development only
 */

import { useEffect, useState } from 'react'

import { useAppRuntime } from '@/components/providers/app-runtime-provider'

type DataMode = 'mock' | 'share' | 'electron' | 'unknown'

const modeConfig: Record<DataMode, { label: string; bgClass: string; description: string }> = {
  mock: {
    label: 'MOCK',
    bgClass: 'bg-amber-500/90',
    description: 'Using TypeScript mock data',
  },
  share: {
    label: 'SHARE',
    bgClass: 'bg-emerald-500/90',
    description: 'Reading from Share/ files',
  },
  electron: {
    label: 'ELECTRON',
    bgClass: 'bg-blue-500/90',
    description: 'Running in the Electron desktop shell',
  },
  unknown: {
    label: 'DATA',
    bgClass: 'bg-neutral-500/90',
    description: 'Unknown data mode',
  },
}

export function DataModeIndicator() {
  const { dataMode, isElectron, providerId } = useAppRuntime()
  const [mode, setMode] = useState<DataMode>('unknown')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (dataMode === 'mock' || dataMode === 'share' || dataMode === 'electron') {
      setMode(dataMode)
      return
    }

    setMode('unknown')
  }, [dataMode])

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const config = modeConfig[mode]

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs font-medium text-white shadow-lg transition-all ${config.bgClass} hover:opacity-100 ${expanded ? 'opacity-100' : 'opacity-75'}`}
        title={config.description}
      >
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        {config.label}
      </button>

      {expanded && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-2 text-xs font-medium text-neutral-900 dark:text-neutral-100">Data Mode: {config.label}</div>
          <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">{config.description}</p>

          <div className="space-y-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Environment</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">{process.env.NODE_ENV}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">NEXT_PUBLIC_DATA_MODE</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">{process.env.NEXT_PUBLIC_DATA_MODE || 'unset'}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-neutral-500">Runtime</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">{isElectron ? 'electron' : 'browser'}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-neutral-500">Provider</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300">{providerId}</span>
            </div>
          </div>

          <div className="mt-3 rounded bg-neutral-100 p-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            <strong className="text-neutral-800 dark:text-neutral-200">Tip:</strong> Set{' '}
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-700">NEXT_PUBLIC_DATA_MODE=share</code> to test with real files.
          </div>
        </div>
      )}
    </div>
  )
}
