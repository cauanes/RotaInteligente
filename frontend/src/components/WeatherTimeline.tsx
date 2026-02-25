/**
 * WeatherTimeline — Timeline horizontal de chuva ao longo do trajeto.
 *
 * Exibe barras verticais coloridas por risco com tooltip detalhado.
 * Animada com Framer Motion para entrada suave.
 */

import { motion } from 'framer-motion'
import React from 'react'
import type { WeatherSample, RouteSummary } from '../services/api'

const RISK_COLORS: Record<string, string> = {
  none: 'bg-green-400',
  low: 'bg-yellow-400',
  moderate: 'bg-orange-400',
  high: 'bg-red-500',
  very_high: 'bg-purple-500',
}

const RISK_LABELS: Record<string, string> = {
  none: 'Sem chuva',
  low: 'Chuva leve',
  moderate: 'Chuva moderada',
  high: 'Chuva forte',
  very_high: 'Chuva muito forte',
}

interface Props {
  samples: WeatherSample[]
  summary?: RouteSummary
}

export default function WeatherTimeline({ samples, summary }: Props) {
  if (!samples.length) return null

  const maxPrecip = Math.max(...samples.map((s) => s.precip_prob), 1)
  const hasRain = samples.some((s) => s.precip_prob > 0)

  return (
    <motion.div id="weather-timeline"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 150 }}
      className="ui-scale fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95
                 backdrop-blur-md border-t border-gray-200 dark:border-gray-700
                 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
    >
      <div className={`px-2 ${hasRain ? 'py-1' : 'py-0.5'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1">
            🌧️ Precipitação
          </h3>
          {summary && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {summary.rain_samples}/{summary.total_samples} pontos com chuva
            </span>
          )}
        </div>

        {hasRain ? (
          <>
            {/* Barras */}
            <div className="flex items-end gap-0.5 h-6 overflow-x-auto pb-0.5" role="img" aria-label="Timeline de chuva">
              {samples.map((s, i) => {
                const height = Math.max(8, (s.precip_prob / maxPrecip) * 100)
                const color = RISK_COLORS[s.rain_risk] || RISK_COLORS.none

                return (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="group relative flex-1 min-w-[6px] max-w-[20px] origin-bottom"
                  >
                    <div
                      className={`w-full rounded-t-sm ${color} transition-all duration-200
                                 group-hover:opacity-80 cursor-pointer`}
                      style={{ height: `${height}%` }}
                    />

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                   bg-gray-900 text-white text-xs rounded-lg px-3 py-2
                                   whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100
                                   transition-opacity pointer-events-none z-50">
                      <strong>{s.description}</strong>
                      <br />
                      🌧️ {s.precip_prob}% · {s.precip_mm}mm
                      {s.temperature_c != null && <><br />🌡️ {s.temperature_c}°C</>}
                      <br />
                      ⏰ {new Date(s.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                      <br />
                      📡 {s.source}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2
                                     bg-gray-900 rotate-45 -mt-1" />
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Legend moved to compact MapLegend overlay */}
          </>
        ) : (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            ☀️ Sem chuva prevista no trajeto
          </p>
        )}
      </div>
    </motion.div>
  )
}
