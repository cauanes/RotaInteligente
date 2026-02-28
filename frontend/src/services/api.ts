/**
 * Serviço de API — cliente Axios configurado para o backend FastAPI.
 *
 * Em dev, o Vite proxy redireciona /api → http://localhost:8000.
 * Em produção, configure VITE_API_URL para o endereço real do backend.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

/* ── Types ──────────────────────────────────────────────── */

export interface Coordinates {
  lat: number
  lon: number
}

export interface RouteRequest {
  origin: Coordinates
  destination: Coordinates
  departure_time?: string
  profile?: string
  avoid?: string[]
}

export interface WeatherSample {
  lat: number
  lon: number
  timestamp: string
  precip_mm: number
  precip_prob: number
  temperature_c: number | null
  wind_speed_kmh: number | null
  humidity_percent: number | null
  visibility_m: number | null
  fog_risk: string           // 'none' | 'low' | 'moderate' | 'high'
  rain_risk: string
  source: string
  description: string
}

export interface RouteSummary {
  distance_km: number
  duration_minutes: number
  total_samples: number
  rain_samples: number
  overall_risk: string
  recommendation: string
  confidence: number
  sources: string[]
  fog_risk: string                        // 'none' | 'low' | 'moderate' | 'high'
  traffic_lights_delay_minutes: number    // atraso estimado em semáforos
}

export interface TollPoint {
  lat: number
  lon: number
  name: string
  operator: string
}

export interface AccidentPoint {
  lat: number
  lon: number
  type: string
  severity: string
  description: string
  delay_minutes: number
}

export interface CongestionSegment {
  coordinates: number[][]   // [[lon, lat], ...]
  congestion_level: string  // free | light | moderate | heavy | severe
  congestion_ratio: number
  avg_speed_kmh: number
  color: string             // hex color for rendering
}

export interface TrafficLightPoint {
  lat: number
  lon: number
  osm_id: number
  name: string
  green_duration: number
  yellow_duration: number
  red_duration: number
  distance_m?: number       // present when querying nearby-signals
}

export interface RouteResult {
  route_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  route_geometry?: { type: string; coordinates: number[][] }
  summary?: RouteSummary
  samples?: WeatherSample[]
  segments?: any[]
  traffic_summary?: TrafficSummary
  traffic_samples?: TrafficSample[]
  toll_points?: TollPoint[]
  accident_points?: AccidentPoint[]
  congestion_segments?: CongestionSegment[]
  traffic_light_points?: TrafficLightPoint[]
}

export interface TrafficSummary {
  avg_speed_kmh: number
  avg_congestion_ratio: number
  overall_congestion: string
  total_delay_minutes: number
  samples_count: number
}

export interface TrafficSample {
  lat: number
  lon: number
  eta: string
  current_speed_kmh: number
  free_flow_speed_kmh: number
  congestion_ratio: number
  congestion_level: string
  delay_minutes: number
  source: string
}

export interface BestDepartureHour {
  departure_hour: number
  departure_label: string
  score: number
  avg_flow_ratio: number
  estimated_extra_delay_min: number
  estimated_total_min: number
  estimated_arrival: string
  safety: string
}

export interface BestDepartureResult {
  date: string
  day_type: string
  is_holiday: boolean
  holiday_name?: string
  is_extended_holiday: boolean
  base_duration_minutes: number
  best_departures: BestDepartureHour[]
  worst_departures: BestDepartureHour[]
  all_hours: BestDepartureHour[]
  recommendation: string
  upcoming_holidays: any[]
}

/* ── API functions ──────────────────────────────────────── */

export async function createRoute(req: RouteRequest): Promise<{ route_id: string }> {
  const { data } = await api.post('/routes', req)
  return data
}

export async function getRouteResult(routeId: string): Promise<RouteResult> {
  const { data } = await api.get(`/routes/${routeId}`)
  return data
}

/**
 * Poll até status final (completed | failed).
 * Intervalo padrão: 1.5s, máx 60 tentativas.
 */
export async function pollRoute(
  routeId: string,
  interval = 1500,
  maxAttempts = 60,
): Promise<RouteResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getRouteResult(routeId)
    if (result.status === 'completed' || result.status === 'failed') {
      return result
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('Timeout: análise não concluiu a tempo.')
}

export async function getTrafficHistory(lat: number, lon: number, date: string) {
  const { data } = await api.get('/traffic-history', { params: { lat, lon, date } })
  return data
}

export async function getHealth() {
  const { data } = await api.get('/health')
  return data
}

export async function getBestDeparture(
  originLat: number, originLon: number,
  destLat: number, destLon: number,
  date: string, baseDurationMin: number = 300,
): Promise<BestDepartureResult> {
  const { data } = await api.get('/best-departure', {
    params: {
      origin_lat: originLat, origin_lon: originLon,
      dest_lat: destLat, dest_lon: destLon,
      date, base_duration_min: baseDurationMin,
    },
  })
  return data
}

export async function getHolidays(year?: number) {
  const { data } = await api.get('/holidays', { params: year ? { year } : {} })
  return data
}

export async function getNearbySignals(
  lat: number, lon: number, radiusM: number = 500,
): Promise<{ signals: TrafficLightPoint[]; count: number }> {
  const { data } = await api.get('/nearby-signals', {
    params: { lat, lon, radius_m: radiusM },
  })
  return data
}

export default api
