'use client'

import { cn } from '@/lib/utils'

interface StationProgressBarProps {
  /** Progress from 0 to 100 */
  progress: number
  /** Optional variant for different stripe patterns */
  variant?: 'green' | 'blue' | 'mixed'
  className?: string
}

export function StationProgressBar({ 
  progress, 
  variant = 'green',
  className 
}: StationProgressBarProps) {
  const getStripeClasses = () => {
    switch (variant) {
      case 'green':
        return 'from-emerald-400 to-emerald-500'
      case 'blue':
        return 'from-sky-400 to-sky-500'
      case 'mixed':
        return 'from-emerald-400 via-sky-400 to-emerald-400'
      default:
        return 'from-emerald-400 to-emerald-500'
    }
  }

  return (
    <div className={cn('relative h-3 w-full overflow-hidden rounded-sm', className)}>
      {/* Background track */}
      <div className="absolute inset-0 bg-slate-200" />
      
      {/* Progress fill with diagonal stripes */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      >
        <div
          className={cn(
            'h-full w-full bg-gradient-to-r',
            getStripeClasses()
          )}
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 4px,
              rgba(255,255,255,0.3) 4px,
              rgba(255,255,255,0.3) 8px
            )`,
            backgroundSize: '11.3px 11.3px',
          }}
        />
      </div>
    </div>
  )
}
