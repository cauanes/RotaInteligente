/**
 * TrafficBadge — Badge visual de nível de congestionamento.
 */

import React from 'react'
import type { TrafficSummary } from '../services/api'

const CONGESTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  free: {
    label: 'Livre',
    icon: '🟢',
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  },
  light: {
    label: 'Leve',
    icon: '🟡',
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
  },
  moderate: {
    label: 'Moderado',
    icon: '🟠',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
  },
  heavy: {
    label: 'Intenso',
    icon: '🔴',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  },
  severe: {
    label: 'Severo',
    icon: '🟣',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
  },
}

interface Props {
  traffic: TrafficSummary
  compact?: boolean
}

export default function TrafficBadge({ traffic, compact = false }: Props) {
  const cfg = CONGESTION_CONFIG[traffic.overall_congestion] || CONGESTION_CONFIG.free

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </span>
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${cfg.color}`}>
          {cfg.icon} Trânsito: {cfg.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {traffic.samples_count} pontos
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Vel. média</span>
          <p className={`font-bold ${cfg.color}`}>{traffic.avg_speed_kmh.toFixed(0)} km/h</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Atraso estimado</span>
          <p className={`font-bold ${cfg.color}`}>
            {traffic.total_delay_minutes > 0
              ? `+${traffic.total_delay_minutes.toFixed(0)} min`
              : '0 min'}
          </p>
        </div>
      </div>
    </div>
  )
}
