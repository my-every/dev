'use client'

import { useCallback, useRef, useState, type WheelEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Minus, Plus, RotateCcw, Maximize2 } from 'lucide-react'

import { NewflexFloorLayout } from '@/components/d380/project-board/newflex-floor-layout'
import { OffskidFloorLayout } from '@/components/d380/project-board/offskid-floor-layout'
import { OnskidFloorLayout } from '@/components/d380/project-board/onskid-floor-layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ProjectBoardAssignmentViewModel,
  ProjectBoardWorkAreaCardViewModel,
} from '@/types/d380-project-board'

type ZoneTab = 'all' | 'onskid' | 'offskid' | 'newflex'

interface ZoneData {
  buildupTables: ProjectBoardWorkAreaCardViewModel[]
  wiringTables: ProjectBoardWorkAreaCardViewModel[]
  testStations: ProjectBoardWorkAreaCardViewModel[]
}

// OFFSKID zone data with fixed workarea props
interface OffskidZoneData {
  buildUpTable1?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable2?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable3?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable4?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable5?: ProjectBoardWorkAreaCardViewModel | null
  buildUpTable6?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable1?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable2?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable3?: ProjectBoardWorkAreaCardViewModel | null
  wiringTable4?: ProjectBoardWorkAreaCardViewModel | null
  station1?: ProjectBoardWorkAreaCardViewModel | null
  station2?: ProjectBoardWorkAreaCardViewModel | null
  station3?: ProjectBoardWorkAreaCardViewModel | null
  station4?: ProjectBoardWorkAreaCardViewModel | null
  station5?: ProjectBoardWorkAreaCardViewModel | null
  station6?: ProjectBoardWorkAreaCardViewModel | null
  station7?: ProjectBoardWorkAreaCardViewModel | null
  station8?: ProjectBoardWorkAreaCardViewModel | null
}

interface ProjectBoardCanvasProps {
  onskid: ZoneData
  offskid: OffskidZoneData
  newflex: ZoneData
  availableProjects: ProjectBoardAssignmentViewModel[]
  onAssignProject: (workAreaId: string, projectId: string) => void
}

const ZONE_TABS: { id: ZoneTab; label: string; color: string }[] = [
  { id: 'all', label: 'All Zones', color: 'bg-slate-600' },
  { id: 'onskid', label: 'ONSKID', color: 'bg-[#3b9dd9]' },
  { id: 'offskid', label: 'OFFSKID', color: 'bg-amber-500' },
  { id: 'newflex', label: 'NEW/FLEX', color: 'bg-emerald-500' },
]

export function ProjectBoardCanvas({
  onskid,
  offskid,
  newflex,
  availableProjects,
  onAssignProject,
}: ProjectBoardCanvasProps) {
  const [activeTab, setActiveTab] = useState<ZoneTab>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(0.5) // Start zoomed out to see all
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  const minZoom = 0.25
  const maxZoom = 1.5

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom((prev) => Math.min(maxZoom, Math.max(minZoom, prev + delta)))
  }, [])

  // Pan with mouse drag
  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Zoom controls
  const zoomIn = () => setZoom((prev) => Math.min(maxZoom, prev + 0.1))
  const zoomOut = () => setZoom((prev) => Math.max(minZoom, prev - 0.1))
  const resetView = () => {
    setZoom(0.5)
    setPosition({ x: 0, y: 0 })
  }
  const fitAll = () => {
    setZoom(0.4)
    setPosition({ x: 0, y: 0 })
  }

  const showOnskid = activeTab === 'all' || activeTab === 'onskid'
  const showOffskid = activeTab === 'all' || activeTab === 'offskid'
  const showNewflex = activeTab === 'all' || activeTab === 'newflex'

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
        {ZONE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              // Reset view when switching tabs
              if (tab.id === 'all') {
                setZoom(0.4)
              } else {
                setZoom(0.7)
              }
              setPosition({ x: 0, y: 0 })
            }}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
              activeTab === tab.id
                ? `${tab.color} text-white shadow-md`
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className={cn(
          'relative flex-1 overflow-hidden bg-muted/30',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={contentRef}
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <div className="flex gap-8 p-8">
            {showOnskid && (
              <OnskidFloorLayout
                buildupTables={onskid.buildupTables}
                wiringTables={onskid.wiringTables}
                testStations={onskid.testStations}
                availableProjects={availableProjects}
                onAssignProject={onAssignProject}
                title="ONSKID"
                className="shrink-0"
              />
            )}

            {showOffskid && (
              <OffskidFloorLayout
                buildUpTable1={offskid.buildUpTable1}
                buildUpTable2={offskid.buildUpTable2}
                buildUpTable3={offskid.buildUpTable3}
                buildUpTable4={offskid.buildUpTable4}
                buildUpTable5={offskid.buildUpTable5}
                buildUpTable6={offskid.buildUpTable6}
                wiringTable1={offskid.wiringTable1}
                wiringTable2={offskid.wiringTable2}
                wiringTable3={offskid.wiringTable3}
                wiringTable4={offskid.wiringTable4}
                station1={offskid.station1}
                station2={offskid.station2}
                station3={offskid.station3}
                station4={offskid.station4}
                station5={offskid.station5}
                station6={offskid.station6}
                station7={offskid.station7}
                station8={offskid.station8}
                availableProjects={availableProjects}
                onAssignProject={onAssignProject}
                title="OFFSKID"
                className="shrink-0"
              />
            )}

            {showNewflex && (
              <NewflexFloorLayout
                buildupTables={newflex.buildupTables}
                wiringTables={newflex.wiringTables}
                testStations={newflex.testStations}
                availableProjects={availableProjects}
                onAssignProject={onAssignProject}
                title="NEW/FLEX"
                className="shrink-0"
              />
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-background/95 p-2 shadow-lg backdrop-blur">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={zoom <= minZoom}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-sm font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={zoom >= maxZoom}>
            <Plus className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fitAll} title="Fit all zones">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Reset view">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Help text */}
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground">
          Scroll to zoom, drag to pan
        </div>
      </div>
    </div>
  )
}
