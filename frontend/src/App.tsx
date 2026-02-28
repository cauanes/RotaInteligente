/**
 * App.tsx — Componente raiz.
 *
 * Orquestra o estado global da aplicação:
 *  - Coordenadas de origem/destino
 *  - Resultado da análise de rota
 *  - Loading / Error
 *
 * O fluxo é:
 *  1. Usuário digita origem e destino no RoutePanel
 *  2. Clica "Analisar Rota"
 *  3. POST /routes → recebe route_id
 *  4. Poll GET /routes/{route_id} até completed
 *  5. Renderiza rota no MapView + WeatherTimeline
 */

import React, { useState, useRef } from 'react'
import TopBar from './components/TopBar'
import RoutePanel from './components/RoutePanel'
import MapView from './components/MapView'
import WeatherTimeline from './components/WeatherTimeline'
import SettingsModal from './components/SettingsModal'
import BestDeparturePanel from './components/BestDeparturePanel'
import { createRoute, pollRoute, getBestDeparture } from './services/api'
import type { Coordinates, RouteResult, BestDepartureResult } from './services/api'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RouteResult | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navigationMode, setNavigationMode] = useState(false)

  // Best departure state
  const [bestDepOpen, setBestDepOpen] = useState(false)
  const [bestDepLoading, setBestDepLoading] = useState(false)
  const [bestDepData, setBestDepData] = useState<BestDepartureResult | null>(null)
  const [bestDepError, setBestDepError] = useState<string | null>(null)

  // Keep refs to origin/dest/departure for best-departure queries
  const lastOrigin = useRef<Coordinates | null>(null)
  const lastDest = useRef<Coordinates | null>(null)
  const lastDeparture = useRef<string>('')

  async function handleAnalyze(
    origin: Coordinates,
    destination: Coordinates,
    departure: string,
    profile: string,
  ) {
    setLoading(true)
    setError(null)
    setResult(null)

    // Store for best-departure
    lastOrigin.current = origin
    lastDest.current = destination
    lastDeparture.current = departure

    try {
      // Send departure as a naive local datetime string in BRT (YYYY-MM-DDTHH:mm[:ss])
      const depPayload = departure && departure.length === 16 ? `${departure}:00` : departure
      const { route_id } = await createRoute({
        origin,
        destination,
        departure_time: depPayload,
        profile,
      })

      const routeResult = await pollRoute(route_id)

      if (routeResult.status === 'failed') {
        setError(routeResult.error || 'Erro desconhecido na análise da rota.')
      } else {
        setResult(routeResult)
      }
    } catch (err: any) {
      console.error('Route analysis error:', err)
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Erro ao analisar rota. Verifique se o backend está rodando.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleBestDeparture() {
    if (!lastOrigin.current || !lastDest.current) return

    setBestDepOpen(true)
    setBestDepLoading(true)
    setBestDepError(null)
    setBestDepData(null)

    try {
      // Use the stored naive departure date (BRT) if available, otherwise today's date in BRT
      const date = lastDeparture.current
        ? lastDeparture.current.slice(0, 10)
        : new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

      const baseDuration = result?.summary?.duration_minutes || 300

      const data = await getBestDeparture(
        lastOrigin.current.lat,
        lastOrigin.current.lon,
        lastDest.current.lat,
        lastDest.current.lon,
        date,
        baseDuration,
      )
      setBestDepData(data)
    } catch (err: any) {
      console.error('Best departure error:', err)
      setBestDepError(
        err.response?.data?.detail ||
        err.message ||
        'Erro ao calcular melhor horário.',
      )
    } finally {
      setBestDepLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <TopBar onSettingsClick={() => setSettingsOpen(true)} />

      <div className="flex-1 relative pt-12">
        {/* Mapa ocupa toda a área */}
        <MapView
          routeGeometry={result?.route_geometry}
          samples={result?.samples}
          trafficSamples={result?.traffic_samples}
          tollPoints={result?.toll_points}
          accidentPoints={result?.accident_points}
          congestionSegments={result?.congestion_segments}
          trafficLightPoints={result?.traffic_light_points}
          navigationMode={navigationMode}
          onNavigationEnd={() => setNavigationMode(false)}
        />

        {/* Painel lateral flutuante */}
        <RoutePanel
          onAnalyze={handleAnalyze}
          onBestDeparture={handleBestDeparture}
          loading={loading}
          error={error}
          summary={result?.summary || null}
          trafficSummary={result?.traffic_summary || null}
        />

        {/* Timeline de chuva na parte inferior */}
        {result?.samples && result.samples.length > 0 && (
          <WeatherTimeline samples={result.samples} summary={result.summary} />
        )}
      </div>

      {/* Best Departure Panel (slide-in from right) */}
      <BestDeparturePanel
        open={bestDepOpen}
        onClose={() => setBestDepOpen(false)}
        loading={bestDepLoading}
        data={bestDepData}
        error={bestDepError}
      />

      {/* Modal de configurações */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
