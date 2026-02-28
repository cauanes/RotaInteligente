/**
 * App.tsx — Entry point do aplicativo mobile Rota Inteligente.
 *
 * Estrutura principal:
 *  - Mapa (react-native-maps)
 *  - Painel de busca (SearchPanel)
 *  - Resultados de rota (RouteResults)
 *  - Navegação GPS com expo-location
 */

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native'
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import * as Location from 'expo-location'
import { createRoute, pollRoute, getNearbySignals } from './src/services/api'
import SearchPanel from './src/components/SearchPanel'
import RouteResults from './src/components/RouteResults'
import RouteTimeline from './src/components/RouteTimeline'
import type { RouteResult, CongestionSegment, Coordinates } from './src/services/api'

const CONGESTION_COLORS: Record<string, string> = {
  free: '#16a34a',
  light: '#84cc16',
  moderate: '#eab308',
  heavy: '#f97316',
  severe: '#dc2626',
}

export default function App() {
  const mapRef = useRef<MapView>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [navigationMode, setNavigationMode] = useState(false)

  // Request location permission on mount
  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da localização para navegação.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({})
      setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude })
    })()
  }, [])

  // GPS tracking in navigation mode
  useEffect(() => {
    if (!navigationMode) return
    let sub: Location.LocationSubscription | null = null
    ;(async () => {
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 10,
          timeInterval: 2000,
        },
        (loc) => {
          setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude })
          mapRef.current?.animateCamera({
            center: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            zoom: 16,
            heading: loc.coords.heading ?? 0,
          })
        },
      )
    })()
    return () => { sub?.remove() }
  }, [navigationMode])

  async function handleAnalyze(origin: Coordinates, destination: Coordinates) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const now = new Date().toISOString()
      const { route_id } = await createRoute({
        origin,
        destination,
        departure_time: now,
        profile: 'driving-car',
      })
      const routeResult = await pollRoute(route_id)
      if (routeResult.status === 'failed') {
        setError(routeResult.error || 'Erro na análise')
      } else {
        setResult(routeResult)
        // Fit map to route
        if (routeResult.route_geometry?.coordinates) {
          const coords = routeResult.route_geometry.coordinates
          const lats = coords.map((c: number[]) => c[1])
          const lons = coords.map((c: number[]) => c[0])
          mapRef.current?.fitToCoordinates(
            coords.map((c: number[]) => ({ latitude: c[1], longitude: c[0] })),
            { edgePadding: { top: 100, right: 50, bottom: 200, left: 50 }, animated: true },
          )
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao analisar rota')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#1d4ed8', flexDirection: 'row',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
          🗺️ Rota Inteligente
        </Text>
        {result && (
          <TouchableOpacity
            onPress={() => setNavigationMode(!navigationMode)}
            style={{
              backgroundColor: navigationMode ? '#ef4444' : '#22c55e',
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              {navigationMode ? '⏹ Parar' : '▶️ Navegar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map */}
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: userLocation?.lat || -23.55,
            longitude: userLocation?.lon || -46.63,
            latitudeDelta: 5,
            longitudeDelta: 5,
          }}
          showsUserLocation={navigationMode}
          showsMyLocationButton={false}
          followsUserLocation={navigationMode}
        >
          {/* Congestion-colored route segments */}
          {result?.congestion_segments?.map((seg: CongestionSegment, idx: number) => (
            <Polyline
              key={`cong-${idx}`}
              coordinates={seg.coordinates.map((c) => ({
                latitude: c[1], longitude: c[0],
              }))}
              strokeColor={seg.color || CONGESTION_COLORS[seg.congestion_level] || '#3b82f6'}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          ))}

          {/* Fallback: single blue route if no congestion data */}
          {result?.route_geometry && (!result.congestion_segments || result.congestion_segments.length === 0) && (
            <Polyline
              coordinates={result.route_geometry.coordinates.map((c) => ({
                latitude: c[1], longitude: c[0],
              }))}
              strokeColor="#3b82f6"
              strokeWidth={4}
              lineCap="round"
            />
          )}

          {/* Toll markers */}
          {result?.toll_points?.map((t, i) => (
            <Marker key={`toll-${i}`} coordinate={{ latitude: t.lat, longitude: t.lon }}
              title={t.name} description={t.operator} pinColor="#f59e0b" />
          ))}

          {/* Accident markers */}
          {result?.accident_points?.map((a, i) => (
            <Marker key={`acc-${i}`} coordinate={{ latitude: a.lat, longitude: a.lon }}
              title={a.type} description={`${a.severity} · +${a.delay_minutes}min`} pinColor="#ef4444" />
          ))}

          {/* Traffic light markers */}
          {result?.traffic_light_points?.map((s, i) => (
            <Marker key={`sig-${i}`} coordinate={{ latitude: s.lat, longitude: s.lon }}
              title="🚦 Semáforo" description={`🟢${s.green_duration}s 🟡${s.yellow_duration}s 🔴${s.red_duration}s`}
              pinColor="#22c55e" />
          ))}

          {/* Weather sample markers */}
          {result?.samples?.map((s, i) => (
            <Marker
              key={`sample-${i}`}
              coordinate={{ latitude: s.lat, longitude: s.lon }}
              title={s.description}
              description={`🌧${s.precip_prob}% · ${s.temperature_c ?? '?'}°C`}
              pinColor={
                s.rain_risk === 'high' || s.rain_risk === 'very_high' ? '#dc2626'
                : s.rain_risk === 'moderate' ? '#ea580c'
                : s.rain_risk === 'low' ? '#ca8a04'
                : '#16a34a'
              }
            />
          ))}
        </MapView>

        {/* Loading overlay */}
        {loading && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
          }}>
            <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16 }}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={{ marginTop: 8, fontSize: 14, color: '#374151' }}>Analisando rota...</Text>
            </View>
          </View>
        )}
      </View>

      {/* Search Panel (bottom sheet) */}
      <SearchPanel onAnalyze={handleAnalyze} loading={loading} />

      {/* Results panel */}
      {result?.summary && (
        <RouteResults summary={result.summary} trafficSummary={result.traffic_summary} />
      )}

      {/* Error */}
      {error && (
        <View style={{
          position: 'absolute', bottom: 100, left: 16, right: 16,
          backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
          borderRadius: 12, padding: 12,
        }}>
          <Text style={{ color: '#b91c1c', fontSize: 12 }}>⚠️ {error}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}
