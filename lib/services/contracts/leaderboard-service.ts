/**
 * Leaderboard Service Contract
 * 
 * Manages leaderboard rankings and performance metrics.
 * Reads from Share/380/State/leaderboard/ and aggregates from history.
 */

import type { ServiceResult } from './index'

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time'
export type LeaderboardMetric = 'wires_completed' | 'sheets_completed' | 'quality_score' | 'efficiency'

export interface LeaderboardEntry {
  /** Rank position */
  rank: number
  /** Member badge */
  badge: string
  /** Member full name */
  fullName: string
  /** Member initials */
  initials: string
  /** Avatar path */
  avatarPath: string | null
  /** Primary metric value */
  metricValue: number
  /** Metric display label */
  metricLabel: string
  /** Change from previous period */
  changeFromPrevious: number
  /** Trend direction */
  trend: 'up' | 'down' | 'stable'
  /** Additional stats */
  stats: {
    wiresCompleted: number
    sheetsCompleted: number
    qualityScore: number
    efficiency: number
  }
}

export interface LeaderboardSnapshot {
  /** Period type */
  period: LeaderboardPeriod
  /** Period start date */
  periodStart: string
  /** Period end date */
  periodEnd: string
  /** Metric used for ranking */
  metric: LeaderboardMetric
  /** Ranked entries */
  entries: LeaderboardEntry[]
  /** Generated timestamp */
  generatedAt: string
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface PerformerHighlight {
  /** Member badge */
  badge: string
  /** Member full name */
  fullName: string
  /** Member initials */
  initials: string
  /** Avatar path */
  avatarPath: string | null
  /** Highlight title */
  highlightTitle: string
  /** Highlight value */
  highlightValue: string
  /** Achievement badge */
  achievementBadge: string | null
}

export interface ILeaderboardService {
  /**
   * Get leaderboard for a period.
   */
  getLeaderboard(
    period: LeaderboardPeriod,
    metric?: LeaderboardMetric,
    limit?: number
  ): Promise<ServiceResult<LeaderboardSnapshot>>

  /**
   * Get top performers for dashboard hero.
   */
  getTopPerformers(limit?: number): Promise<ServiceResult<PerformerHighlight[]>>

  /**
   * Get ranking for a specific member.
   */
  getMemberRanking(
    badge: string,
    period: LeaderboardPeriod,
    metric?: LeaderboardMetric
  ): Promise<ServiceResult<LeaderboardEntry | null>>

  /**
   * Get historical rankings for trend analysis.
   */
  getRankingHistory(
    badge: string,
    periods: number
  ): Promise<ServiceResult<LeaderboardEntry[]>>

  /**
   * Refresh leaderboard cache.
   */
  refreshCache(): Promise<ServiceResult<void>>
}
