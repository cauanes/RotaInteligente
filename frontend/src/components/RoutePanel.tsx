/**
 * RoutePanel — Painel lateral com campos de busca, opções e botão de análise.
 *
 * Layout inspirado no Google Maps: painel flutuante sobre o mapa.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { FiNavigation, FiClock, FiLoader, FiChevronDown, FiChevronUp, FiAlertTriangle, FiClock as FiTimer, FiChevronLeft, FiChevronRight, FiDollarSign } from 'react-icons/fi'
import React, { useState, useMemo } from 'react'
import SearchBox from './SearchBox'
import TrafficBadge from './TrafficBadge'
import type { Coordinates, RouteSummary, TrafficSummary } from '../services/api'

interface Props {
  onAnalyze: (origin: Coordinates, dest: Coordinates, departure: string, profile: string) => void
  onBestDeparture: () => void
  loading: boolean
  error: string | null
  summary: RouteSummary | null
  trafficSummary: TrafficSummary | null
}

const RISK_COLORS: Record<string, string> = {
  none: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  low: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  very_high: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

export default function RoutePanel({ onAnalyze, onBestDeparture, loading, error, summary, trafficSummary }: Props) {
  const [origin, setOrigin] = useState<{ coords: Coordinates; name: string } | null>(null)
  const [dest, setDest] = useState<{ coords: Coordinates; name: string } | null>(null)
  const [departure, setDeparture] = useState(() => {
    // Build a datetime-local string in America/Sao_Paulo (Brasília) regardless of browser TZ
    const now = new Date()
    const tz = 'America/Sao_Paulo'
    const dtf = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    // dtf.format returns "YYYY-MM-DD HH:mm" for sv-SE — convert to datetime-local format
    const parts = dtf.format(now).replace(' ', 'T')
    // default to current time in BRT (do not add an extra hour)
    try {
      const [datePart, timePart] = parts.split('T')
      let [hh, mm] = timePart.split(':').map((s) => parseInt(s, 10))
      const padded = (n: number) => n.toString().padStart(2, '0')
      return `${datePart}T${padded(hh)}:${padded(mm)}`
    } catch (e) {
      // fallback: current local ISO trimmed
      const d = new Date()
      return d.toISOString().slice(0, 16)
    }
  })
  const [profile, setProfile] = useState('driving-car')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showCosts, setShowCosts] = useState(false)
  const [fuelPrice, setFuelPrice] = useState('5.89')
  const [kmPerLiter, setKmPerLiter] = useState('12')

  // Helper: retorna string para `input[type=datetime-local]` no fuso America/Sao_Paulo
  function nowBRTDateTimeLocal(): string {
    try {
      const tz = 'America/Sao_Paulo'
      const now = new Date()
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now).replace(' ', 'T')
      return parts.slice(0, 16)
    } catch (e) {
      const d = new Date()
      return d.toISOString().slice(0, 16)
    }
  }

  // Estimativa de custos
  const costEstimate = useMemo(() => {
    if (!summary) return null
    const dist = summary.distance_km
    const price = parseFloat(fuelPrice) || 0
    const kml = parseFloat(kmPerLiter) || 1
    const fuelLiters = dist / kml
    const fuelCost = fuelLiters * price

    // Estimativa de pedágios: baseado na distância
    // Média brasileira: ~R$ 0.12/km em rodovias pedagiadas (~60% das interestaduais)
    // Internacional: ~R$ 0.08/km
    const tollRatePerKm = dist > 500 ? 0.10 : 0.12
    const tollEstimate = dist * tollRatePerKm
    const tollCount = Math.max(1, Math.round(dist / 80)) // ~1 pedágio a cada 80km

    return {
      fuelLiters: fuelLiters.toFixed(1),
      fuelCost: fuelCost.toFixed(2),
      tollEstimate: tollEstimate.toFixed(2),
      tollCount,
      totalCost: (fuelCost + tollEstimate).toFixed(2),
    }
  }, [summary, fuelPrice, kmPerLiter])

  function handleAnalyze() {
    if (!origin || !dest) return
    // Update the departure field to the current search time (BRT)
    const nowStr = nowBRTDateTimeLocal()
    setDeparture(nowStr)
    onAnalyze(origin.coords, dest.coords, nowStr, profile)
  }

  const canAnalyze = origin && dest && !loading

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      id="route-panel"
      className="ui-scale absolute top-16 left-4 z-40 bg-white/95 dark:bg-gray-900/95
                 backdrop-blur-md rounded-xl shadow-xl border border-gray-200 dark:border-gray-700
                 overflow-hidden transition-all duration-300"
      style={{ width: collapsed ? '44px' : '280px' }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800
                   hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        aria-label={collapsed ? 'Expandir painel' : 'Recolher painel'}
      >
        {collapsed ? <FiChevronRight className="w-4 h-4" /> : <FiChevronLeft className="w-4 h-4" />}
      </button>

      {collapsed ? (
        <div className="flex flex-col items-center pt-12 gap-3 pb-4 text-lg">
          <FiNavigation className="w-5 h-5 text-blue-500" />
        </div>
      ) : (
      <div className="p-3 space-y-2 text-lg">
        {/* Origem / Destino */}
        <SearchBox
          label="🟢 Origem"
          placeholder="Ex: São Paulo, SP"
          onSelect={(c, n) => setOrigin({ coords: c, name: n })}
          value={origin?.name}
        />
        <SearchBox
          label="🔴 Destino"
          placeholder="Ex: Rio de Janeiro, RJ"
          onSelect={(c, n) => setDest({ coords: c, name: n })}
          value={dest?.name}
        />

        {/* Data/hora de partida */}
        <div>
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <FiClock className="w-4 h-4" /> Partida
          </label>
          <input
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            className="w-full px-2 py-1.5 text-[12px] border border-gray-300 dark:border-gray-600
                       rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                       focus:ring-2 focus:ring-blue-500 outline-none"
            aria-label="Data e hora de partida"
          />
        </div>

        {/* Avançado */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showAdvanced ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />}
          Opções avançadas
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
                        <label className="block text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Perfil
              </label>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600
                           rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                aria-label="Perfil de roteamento"
              >
                <option value="driving-car">🚗 Carro</option>
                <option value="driving-hgv">🚛 Caminhão</option>
                <option value="cycling-regular">🚲 Bicicleta</option>
                <option value="foot-walking">🚶 A pé</option>
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão analisar */}
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     font-semibold text-sm transition-all duration-200
                     ${canAnalyze
                       ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                       : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                     }`}
          aria-label="Analisar rota"
        >
          {loading ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <FiNavigation className="w-4 h-4" />
              Analisar Rota
            </>
          )}
        </button>

        {/* Erro */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800
                         rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resumo */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-sm text-gray-500">Distância</p>
                  <p className="text-base font-bold text-gray-800 dark:text-white">
                    {summary.distance_km.toFixed(1)} km
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-sm text-gray-500">Duração</p>
                  <p className="text-base font-bold text-gray-800 dark:text-white">
                    {Math.floor(summary.duration_minutes / 60)}h{Math.round(summary.duration_minutes % 60)}min
                  </p>
                </div>
              </div>

              <div className={`px-3 py-2 rounded-lg text-sm font-medium ${RISK_COLORS[summary.overall_risk] || RISK_COLORS.none}`}>
                {summary.recommendation}
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Confiança: {(summary.confidence * 100).toFixed(0)}%</span>
                <span>Fontes: {summary.sources.join(', ')}</span>
              </div>

              {/* Trânsito */}
              {trafficSummary && (
                <TrafficBadge traffic={trafficSummary} />
              )}

              {/* Custos da viagem */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5">
                <button
                  onClick={() => setShowCosts(!showCosts)}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
                >
                  <span className="flex items-center gap-1">
                    <FiDollarSign className="w-3 h-3" />
                    Custos da Viagem
                  </span>
                  {showCosts ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />}
                </button>

                <AnimatePresence>
                  {showCosts && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1.5 space-y-1.5">
                        {/* Inputs */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">Preço/L (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={fuelPrice}
                              onChange={(e) => setFuelPrice(e.target.value)}
                              className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 dark:border-gray-600
                                         rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white outline-none
                                         focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">Km/Litro</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              value={kmPerLiter}
                              onChange={(e) => setKmPerLiter(e.target.value)}
                              className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 dark:border-gray-600
                                         rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white outline-none
                                         focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {/* Resultados */}
                        {costEstimate && (
                          <div className="space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-500 dark:text-gray-400">⛽ Combustível</span>
                              <span className="text-gray-800 dark:text-white font-medium">
                                {costEstimate.fuelLiters}L · R$ {costEstimate.fuelCost}
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-500 dark:text-gray-400">🛣️ Pedágios (~{costEstimate.tollCount})</span>
                              <span className="text-gray-800 dark:text-white font-medium">
                                ~R$ {costEstimate.tollEstimate}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-1 flex justify-between text-[11px] font-bold">
                              <span className="text-gray-700 dark:text-gray-300">Total estimado</span>
                              <span className="text-green-600 dark:text-green-400">R$ {costEstimate.totalCost}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botão Melhor Horário */}
              <button
                onClick={onBestDeparture}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                           text-sm font-medium border border-blue-300 dark:border-blue-700
                           text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30
                           hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <FiTimer className="w-3 h-3" />
                Melhor Horário de Partida
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}
    </motion.div>
  )
}
