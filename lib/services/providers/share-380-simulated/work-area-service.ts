import type {
  FloorLayoutConfig,
  IWorkAreaService,
  WorkArea,
  WorkAreaKind,
  WorkAreaWithState,
} from '@/lib/services/contracts/work-area-service'
import type { LwcSectionId, ServiceResult } from '@/lib/services/contracts'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function toState(area: WorkArea): WorkAreaWithState {
  return {
    ...area,
    loadState: 'idle',
    loadRatio: 0,
    assignedMemberBadges: [],
    activeAssignmentIds: [],
  }
}

function createWorkAreas(): WorkArea[] {
  return [
    {
      id: 'wa-onskid-1',
      label: 'Onskid Wiring 1',
      stationCode: 'W1',
      lwc: 'ONSKID',
      kind: 'WIRING_TABLE',
      capacity: 2,
      supportedStages: [],
      position: { row: 1, col: 1 },
      notes: '',
      available: true,
      dataMode: 'mock',
    },
  ]
}

export class WorkAreaServiceImpl implements IWorkAreaService {
  private areas: WorkArea[] = createWorkAreas()

  async getWorkAreas(): Promise<ServiceResult<WorkArea[]>> {
    return ok(this.areas)
  }

  async getWorkAreasWithState(): Promise<ServiceResult<WorkAreaWithState[]>> {
    return ok(this.areas.map(toState))
  }

  async getWorkAreasByLwc(lwc: LwcSectionId): Promise<ServiceResult<WorkAreaWithState[]>> {
    return ok(this.areas.filter(area => area.lwc === lwc).map(toState))
  }

  async getWorkAreasByKind(kind: WorkAreaKind): Promise<ServiceResult<WorkAreaWithState[]>> {
    return ok(this.areas.filter(area => area.kind === kind).map(toState))
  }

  async getWorkAreaById(id: string): Promise<ServiceResult<WorkAreaWithState | null>> {
    const area = this.areas.find(item => item.id === id)
    return ok(area ? toState(area) : null)
  }

  async getFloorLayout(lwc: LwcSectionId): Promise<ServiceResult<FloorLayoutConfig | null>> {
    const areas = this.areas.filter(area => area.lwc === lwc)
    if (areas.length === 0) return ok(null)

    return ok({
      id: `layout-${lwc.toLowerCase()}`,
      label: `${lwc} Layout`,
      lwc,
      grid: { rows: 4, cols: 6 },
      placements: areas.map((area, index) => ({
        workAreaId: area.id,
        row: 1,
        col: index + 1,
      })),
      blockedCells: [],
      specialZones: [],
    })
  }

  async getAllFloorLayouts(): Promise<ServiceResult<FloorLayoutConfig[]>> {
    const lwcs = Array.from(new Set(this.areas.map(area => area.lwc)))
    const layouts: FloorLayoutConfig[] = []

    for (const lwc of lwcs) {
      const layout = await this.getFloorLayout(lwc)
      if (layout.data) layouts.push(layout.data)
    }

    return ok(layouts)
  }

  async setWorkAreaAvailability(id: string, available: boolean): Promise<ServiceResult<WorkArea>> {
    const index = this.areas.findIndex(area => area.id === id)
    if (index < 0) {
      return {
        data: null,
        error: `Work area ${id} not found`,
        source: 'mock',
        timestamp: new Date().toISOString(),
      }
    }

    this.areas[index] = { ...this.areas[index], available }
    return ok(this.areas[index])
  }

  async updateWorkAreaNotes(id: string, notes: string): Promise<ServiceResult<WorkArea>> {
    const index = this.areas.findIndex(area => area.id === id)
    if (index < 0) {
      return {
        data: null,
        error: `Work area ${id} not found`,
        source: 'mock',
        timestamp: new Date().toISOString(),
      }
    }

    this.areas[index] = { ...this.areas[index], notes }
    return ok(this.areas[index])
  }
}
