/**
 * API service for mobile — mirrors the web frontend api.ts
 */

import axios from 'axios'

// In development, point to your local backend
// In production, replace with your deployed backend URL
const API_URL = __DEV__
  ? 'http://192.168.0.100:8000'  // Replace with your LAN IP
  : 'https://your-backend.com'

const api = axios.create({
  baseURL: API_URL,
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
  fog_risk: string
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
  fog_risk: string
  traffic_lights_delay_minutes: number
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
  coordinates: number[][]
  congestion_level: string
  congestion_ratio: number
  avg_speed_kmh: number
  color: string
}

export interface TrafficLightPoint {
  lat: number
  lon: number
  osm_id: number
  name: string
  green_duration: number
  yellow_duration: number
  red_duration: number
  distance_m?: number
}

export interface TrafficSummary {
  avg_speed_kmh: number
  avg_congestion_ratio: number
  overall_congestion: string
  total_delay_minutes: number
  samples_count: number
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
  congestion_segments?: CongestionSegment[]
  traffic_light_points?: TrafficLightPoint[]
  toll_points?: TollPoint[]
  accident_points?: AccidentPoint[]
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

export async function pollRoute(
  routeId: string,
  interval = 2000,
  maxAttempts = 40,
): Promise<RouteResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getRouteResult(routeId)
    if (result.status === 'completed' || result.status === 'failed') return result
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('Timeout: análise não concluiu a tempo.')
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
