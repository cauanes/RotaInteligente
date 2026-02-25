/**
 * BestDeparturePanel — Painel flutuante com previsão do melhor horário de partida.
 *
 * Mostra os melhores e piores horários, feriados próximos, e recomendação.
 * Animado com Framer Motion.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiClock, FiCalendar, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiLoader, FiBarChart2 } from 'react-icons/fi'
import React from 'react'
import type { BestDepartureResult, BestDepartureHour } from '../services/api'

interface Props {
  open: boolean
  onClose: () => void
  loading: boolean
  data: BestDepartureResult | null
  error: string | null
}

const SAFETY_COLORS: Record<string, string> = {
  ideal: 'text-green-600 dark:text-green-400',
  bom: 'text-blue-600 dark:text-blue-400',
  aceitável: 'text-yellow-600 dark:text-yellow-400',
  'aceitavel': 'text-yellow-600 dark:text-yellow-400',
  ruim: 'text-orange-600 dark:text-orange-400',
  péssimo: 'text-red-600 dark:text-red-400',
  'pessimo': 'text-red-600 dark:text-red-400',
}

function DepartureRow({ hour, rank }: { hour: BestDepartureHour; rank: number }) {
  const safetyColor = SAFETY_COLORS[hour.safety?.toLowerCase()] || 'text-gray-600'
  const isTop3 = rank <= 3

  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg transition
                     ${isTop3 ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
      <span className={`text-lg font-bold w-8 text-center
                       ${isTop3 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
        {rank}º
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800 dark:text-white">
            {hour.departure_label}
          </span>
          <span className={`text-xs font-medium ${safetyColor}`}>
            {hour.safety}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span>🕐 Total: {Math.floor(hour.estimated_total_min / 60)}h{Math.round(hour.estimated_total_min % 60).toString().padStart(2, '0')}min</span>
          {hour.estimated_extra_delay_min > 0 && (
            <span className="text-orange-500">+{hour.estimated_extra_delay_min.toFixed(0)}min atraso</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-gray-500">Chegada</div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {hour.estimated_arrival}
        </div>
      </div>
    </div>
  )
}

export default function BestDeparturePanel({ open, onClose, loading, data, error }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[60]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="ui-scale fixed top-0 right-0 bottom-0 z-[70] w-full max-w-md
                       bg-white dark:bg-gray-900 shadow-2xl border-l
                       border-gray-200 dark:border-gray-700 overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md
                           px-5 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FiClock className="w-5 h-5 text-blue-500" />
                  Melhor Horário de Partida
                </h2>
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Fechar">
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-500">
                  <FiLoader className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm">Calculando melhores horários...</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
                               rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Data */}
              {data && !loading && (
                <>
                  {/* Info do dia */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FiCalendar className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        {new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                        {data.day_type}
                      </span>
                      {data.is_holiday && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200">
                          🎉 {data.holiday_name || 'Feriado'}
                        </span>
                      )}
                      {data.is_extended_holiday && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200">
                          🌉 Feriado prolongado
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        Base: {Math.floor(data.base_duration_minutes / 60)}h{Math.round(data.base_duration_minutes % 60).toString().padStart(2, '0')}min
                      </span>
                    </div>
                  </div>

                  {/* Recomendação */}
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      💡 {data.recommendation}
                    </p>
                  </div>

                  {/* Melhores horários */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <FiTrendingUp className="w-4 h-4 text-green-500" />
                      Melhores Horários
                    </h3>
                    <div className="space-y-1">
                      {data.best_departures.map((h, i) => (
                        <DepartureRow key={h.departure_hour} hour={h} rank={i + 1} />
                      ))}
                    </div>
                  </div>

                  {/* Piores horários */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <FiTrendingDown className="w-4 h-4 text-red-500" />
                      Piores Horários (evitar)
                    </h3>
                    <div className="space-y-1">
                      {data.worst_departures.map((h, i) => (
                        <DepartureRow key={h.departure_hour} hour={h} rank={data.best_departures.length + i + 1} />
                      ))}
                    </div>
                  </div>

                  {/* Gráfico simplificado de 24h */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <FiBarChart2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      Fluxo por Hora (24h)
                    </h3>
                    <div className="flex items-end gap-0.5 h-20" role="img" aria-label="Gráfico de fluxo por hora">
                      {(() => {
                        const defaultHours = Array.from({ length: 24 }, (_, i) => ({
                          departure_hour: i,
                          departure_label: `${String(i).padStart(2, '0')}:00`,
                          avg_flow_ratio: 0.1,
                          estimated_total_min: data.base_duration_minutes,
                          estimated_extra_delay_min: 0,
                          score: 0,
                          estimated_arrival: '',
                          safety: '',
                        }))

                        const hours = (data.all_hours && data.all_hours.length > 0 ? data.all_hours : defaultHours)
                          .slice()
                          .sort((a, b) => (a.departure_hour ?? 0) - (b.departure_hour ?? 0))

                        return hours.map((h) => {
                          const ratio = h.avg_flow_ratio ?? 0
                          const barH = Math.max(4, ratio * 80)
                          const isBest = data.best_departures.some((b) => b.departure_hour === h.departure_hour)
                          const isWorst = data.worst_departures.some((w) => w.departure_hour === h.departure_hour)

                          let color = 'bg-blue-300 dark:bg-blue-600'
                          if (isBest) color = 'bg-green-400 dark:bg-green-500'
                          if (isWorst) color = 'bg-red-400 dark:bg-red-500'

                          return (
                            <div
                              key={h.departure_hour}
                              className="group relative flex-1 min-w-[8px] flex items-end"
                              style={{ height: '80px' }}
                            >
                              <div
                                className={`w-full rounded-t-sm ${color} transition-all duration-200
                                           group-hover:opacity-70 cursor-pointer`}
                                style={{ height: `${barH}px` }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                             bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5
                                             whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100
                                             transition-opacity pointer-events-none z-50">
                                <strong>{h.departure_label}</strong>
                                <br />
                                Total: {Math.floor(h.estimated_total_min / 60)}h{Math.round(h.estimated_total_min % 60).toString().padStart(2, '0')}
                                <br />
                                {h.safety}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>0h</span>
                      <span>6h</span>
                      <span>12h</span>
                      <span>18h</span>
                      <span>23h</span>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-green-400" /> Melhor
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-blue-300" /> Normal
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-red-400" /> Pior
                      </div>
                    </div>
                  </div>

                  {/* Feriados próximos */}
                  {data.upcoming_holidays && data.upcoming_holidays.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <FiCalendar className="w-4 h-4 text-orange-500" />
                        Próximos Feriados
                      </h3>
                      <div className="space-y-1">
                        {data.upcoming_holidays.map((h: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1.5
                                                   border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <span className="text-gray-700 dark:text-gray-300">{h.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              {h.is_extended && ' 🌉'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
