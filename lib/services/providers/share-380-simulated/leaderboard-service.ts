import type {
  ILeaderboardService,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardSnapshot,
  PerformerHighlight,
} from '@/lib/services/contracts/leaderboard-service'
import type { ServiceResult } from '@/lib/services/contracts'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

export class LeaderboardServiceImpl implements ILeaderboardService {
  private buildSnapshot(period: LeaderboardPeriod, metric: LeaderboardMetric): LeaderboardSnapshot {
    const entries: LeaderboardEntry[] = []
    const now = new Date().toISOString()
    return {
      period,
      periodStart: now,
      periodEnd: now,
      metric,
      entries,
      generatedAt: now,
      dataMode: 'mock',
    }
  }

  async getLeaderboard(
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'wires_completed',
    limit = 25
  ): Promise<ServiceResult<LeaderboardSnapshot>> {
    const snapshot = this.buildSnapshot(period, metric)
    return ok({
      ...snapshot,
      entries: snapshot.entries.slice(0, limit),
    })
  }

  async getTopPerformers(limit = 3): Promise<ServiceResult<PerformerHighlight[]>> {
    const highlights: PerformerHighlight[] = []
    return ok(highlights.slice(0, limit))
  }

  async getMemberRanking(
    _badge: string,
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'wires_completed'
  ): Promise<ServiceResult<LeaderboardEntry | null>> {
    const snapshot = this.buildSnapshot(period, metric)
    return ok(snapshot.entries[0] ?? null)
  }

  async getRankingHistory(_badge: string, periods: number): Promise<ServiceResult<LeaderboardEntry[]>> {
    return ok(Array.from({ length: Math.max(0, periods) }, () => ({
      rank: 0,
      badge: '',
      fullName: '',
      initials: '',
      avatarPath: null,
      metricValue: 0,
      metricLabel: '',
      changeFromPrevious: 0,
      trend: 'stable' as const,
      stats: {
        wiresCompleted: 0,
        sheetsCompleted: 0,
        qualityScore: 0,
        efficiency: 0,
      },
    })))
  }

  async refreshCache(): Promise<ServiceResult<void>> {
    return ok(undefined)
  }
}
