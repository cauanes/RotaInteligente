/**
 * MapView — Mapa MapLibre GL com camadas GeoJSON nativas.
 *
 * Usa circle + symbol layers (NÃO HTML markers).
 * Garante que os pontos SEMPRE ficam sobre a rota,
 * independente de zoom in/out.
 */

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { WeatherSample, TrafficSample } from '../services/api'
import { useTheme } from '../contexts/ThemeContext'
import { FiLayers, FiList, FiX, FiTarget } from 'react-icons/fi'
import MapLegend from './MapLegend'

const TZ = 'America/Sao_Paulo'

const RISK_COLORS: Record<string, string> = {
  none: '#16a34a',
  low: '#ca8a04',
  moderate: '#ea580c',
  high: '#dc2626',
  very_high: '#7c3aed',
}

const RISK_LABELS: Record<string, string> = {
  none: 'Sem chuva',
  low: 'Chuva leve',
  moderate: 'Moderada',
  high: 'Forte',
  very_high: 'Muito forte',
}

const MAP_STYLES: Record<string, { name: string; url: string; raster?: boolean }> = {
  streets: {
    name: 'Ruas (CARTO)',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  dark: {
    name: 'Escuro',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  voyager: {
    name: 'Voyager',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  satellite: {
    name: 'Satélite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    raster: true,
  },
}

interface Props {
  routeGeometry?: { type: string; coordinates: number[][] }
  samples?: WeatherSample[]
  trafficSamples?: TrafficSample[]
}

function rasterStyle(tileUrl: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'raster-tiles': { type: 'raster', tiles: [tileUrl], tileSize: 256, attribution: '&copy; Esri' },
    },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 19 }],
  }
}

export default function MapView({ routeGeometry, samples, trafficSamples }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const clickPopupRef = useRef<maplibregl.Popup | null>(null)
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null)
  const { theme } = useTheme()
  const [style, setStyle] = useState<string>('streets')
  const [showLayerMenu, setShowLayerMenu] = useState(false)
  const [showPointsList, setShowPointsList] = useState(false)
  const [cityNames, setCityNames] = useState<Record<string, string>>({})
  const routeGeomRef = useRef<{ type: string; coordinates: number[][] } | null>(null)
  const samplesRef = useRef<WeatherSample[] | null>(null)
  const cityNamesRef = useRef<Record<string, string>>({})

  // Keep refs in sync
  useEffect(() => { if (routeGeometry) routeGeomRef.current = routeGeometry }, [routeGeometry])
  useEffect(() => { samplesRef.current = samples || null }, [samples])
  useEffect(() => { cityNamesRef.current = cityNames }, [cityNames])

  const fitToRoute = useCallback(() => {
    if (!map.current || !routeGeomRef.current?.coordinates?.length) return
    const bounds = new maplibregl.LngLatBounds()
    routeGeomRef.current.coordinates.forEach((c) => bounds.extend(c as [number, number]))
    // Compute dynamic padding based on visible UI elements INCLUDING timeline
    let topPad = 60
    let bottomPad = 60
    let leftPad = 60
    try {
      const wt = document.getElementById('weather-timeline')
      if (wt) bottomPad = Math.round(wt.getBoundingClientRect().height) + 8
      const rp = document.getElementById('route-panel')
      if (rp) leftPad = Math.round(rp.getBoundingClientRect().width) + 16
      const tb = document.querySelector('header')
      if (tb) topPad = Math.round((tb as HTMLElement).getBoundingClientRect().height) + 8
    } catch (e) { /* ignore */ }

    map.current.fitBounds(bounds, {
      padding: { top: topPad, bottom: bottomPad, left: leftPad, right: 60 },
      duration: 1000,
    })
  }, [])

  function getStyleSpec(key: string): string | maplibregl.StyleSpecification {
    const entry = MAP_STYLES[key]
    return entry.raster ? rasterStyle(entry.url) : entry.url
  }

  // ── Rebuild all layers (route + samples) ─────────────────────
  function rebuildLayers() {
    addRouteLayers()
    addSampleLayers()
  }

  function addRouteLayers() {
    const m = map.current
    const geom = routeGeomRef.current
    if (!m || !geom) return

    if (m.getLayer('route-line')) m.removeLayer('route-line')
    if (m.getLayer('route-outline')) m.removeLayer('route-outline')
    if (m.getSource('route')) m.removeSource('route')

    m.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: geom as any },
    })
    m.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#1d4ed8', 'line-width': 7, 'line-opacity': 0.35 },
    })
    m.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.9 },
    })
  }

  function addSampleLayers() {
    const m = map.current
    const s = samplesRef.current
    const names = cityNamesRef.current
    if (!m) return

    // Clean
    ;['samples-labels', 'samples-circles', 'samples-circles-stroke'].forEach((id) => {
      if (m.getLayer(id)) m.removeLayer(id)
    })
    if (m.getSource('samples')) m.removeSource('samples')

    if (!s || s.length === 0) return

    const features = s.map((sample, i) => {
      const cityKey = `${sample.lat.toFixed(2)},${sample.lon.toFixed(2)}`
      const cityName = names[cityKey] || ''
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [sample.lon, sample.lat] },
        properties: {
          idx: i,
          color: RISK_COLORS[sample.rain_risk] || RISK_COLORS.none,
          risk: sample.rain_risk,
          riskLabel: RISK_LABELS[sample.rain_risk] || '',
          city: cityName,
          precip_prob: sample.precip_prob,
          precip_mm: sample.precip_mm,
          temperature_c: sample.temperature_c,
          wind_speed_kmh: sample.wind_speed_kmh,
          timestamp: sample.timestamp,
          source: sample.source,
          description: sample.description,
        },
      }
    })

    m.addSource('samples', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    })

    // White stroke
    m.addLayer({
      id: 'samples-circles-stroke',
      type: 'circle',
      source: 'samples',
      paint: {
        'circle-radius': 7,
        'circle-color': '#ffffff',
        'circle-opacity': 1,
      },
    })

    // Colored circle
    m.addLayer({
      id: 'samples-circles',
      type: 'circle',
      source: 'samples',
      paint: {
        'circle-radius': 5,
        'circle-color': ['get', 'color'],
        'circle-opacity': 1,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    })

    // City labels
    m.addLayer({
      id: 'samples-labels',
      type: 'symbol',
      source: 'samples',
      layout: {
        'text-field': ['get', 'city'],
        'text-size': 10,
        'text-offset': [0, -1.4],
        'text-anchor': 'bottom',
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': theme === 'dark' ? '#e5e7eb' : '#1f2937',
        'text-halo-color': theme === 'dark' ? '#111827' : '#ffffff',
        'text-halo-width': 1.5,
      },
    })
  }

  // ── Init map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return
    const defaultStyle = theme === 'dark' ? 'dark' : style
    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: getStyleSpec(defaultStyle),
      center: [-49.0, -23.5],
      zoom: 5,
    })
    m.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    m.once('load', () => m.resize())

    // Click handler for sample circles
    m.on('click', 'samples-circles', (e) => {
      if (!e.features?.[0]) return
      const f = e.features[0]
      const coords = (f.geometry as any).coordinates.slice()
      const p = f.properties!
      // Show persistent popup on click (with close button)
      clickPopupRef.current?.remove()
      hoverPopupRef.current?.remove()
      clickPopupRef.current = new maplibregl.Popup({ offset: 10, maxWidth: '210px', closeButton: true })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:system-ui;font-size:11px;line-height:1.5">
            ${p.city ? `<b>${p.city}</b><br/>` : ''}
            <span style="display:inline-block;background:${p.color};color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:8px">${p.riskLabel}</span><br/>
            🌧️ ${p.precip_prob}% · ${p.precip_mm}mm<br/>
            ${p.temperature_c != null ? `🌡️ ${p.temperature_c}°C<br/>` : ''}
            ${p.wind_speed_kmh != null ? `💨 ${p.wind_speed_kmh} km/h<br/>` : ''}
            ⏰ ${new Date(p.timestamp).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: TZ })}<br/>
            📡 ${p.source}
          </div>`
        )
        .addTo(m)
    })
    // Hover: show transient popup with full info
    m.on('mouseenter', 'samples-circles', (e) => {
      if (!e.features?.[0]) return
      const f = e.features[0]
      const coords = (f.geometry as any).coordinates.slice()
      const p = f.properties!
      m.getCanvas().style.cursor = 'pointer'
      // Don't show hover if there's already a click popup
      if (clickPopupRef.current) return
      hoverPopupRef.current?.remove()
      hoverPopupRef.current = new maplibregl.Popup({ offset: 8, closeButton: false, maxWidth: '210px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:system-ui;font-size:11px;line-height:1.5">
            ${p.city ? `<b>${p.city}</b><br/>` : ''}
            <span style="display:inline-block;background:${p.color};color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:8px">${p.riskLabel}</span><br/>
            🌧️ ${p.precip_prob}% · ${p.precip_mm}mm<br/>
            ${p.temperature_c != null ? `🌡️ ${p.temperature_c}°C<br/>` : ''}
            ${p.wind_speed_kmh != null ? `💨 ${p.wind_speed_kmh} km/h<br/>` : ''}
            ⏰ ${new Date(p.timestamp).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: TZ })}<br/>
            📡 ${p.source}
          </div>
        `)
        .addTo(m)
    })
    m.on('mouseleave', 'samples-circles', () => {
      m.getCanvas().style.cursor = ''
      // Remove hover popup only
      hoverPopupRef.current?.remove()
      hoverPopupRef.current = null
    })

    map.current = m
    return () => { m.remove() }
  }, [])

  // ── Theme/style ──────────────────────────────────────────────
  useEffect(() => {
    if (!map.current) return
    const key = theme === 'dark' ? 'dark' : style
    map.current.setStyle(getStyleSpec(key))
    map.current.once('styledata', rebuildLayers)
  }, [theme, style])

  // ── Route geometry change ────────────────────────────────────
  useEffect(() => {
    if (!map.current || !routeGeometry) return
    const doIt = () => { addRouteLayers(); addSampleLayers() }
    if (map.current.isStyleLoaded()) doIt()
    else map.current.once('styledata', doIt)
  }, [routeGeometry])

  // ── Samples change ───────────────────────────────────────────
  useEffect(() => {
    if (!map.current) return
    if (map.current.isStyleLoaded()) addSampleLayers()
    else map.current.once('styledata', () => addSampleLayers())
  }, [samples, cityNames])

  // ── Reverse geocode ──────────────────────────────────────────
  useEffect(() => {
    if (!samples || samples.length === 0) return
    const newNames: Record<string, string> = {}
    const toFetch = samples.filter((s) => {
      const key = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`
      return !cityNames[key]
    })
    if (toFetch.length === 0) return

    toFetch.forEach((s, idx) => {
      const key = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`
      setTimeout(async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${s.lat}&lon=${s.lon}&format=json&zoom=10&addressdetails=1`,
            { headers: { 'User-Agent': 'WeatherRoutePlanner/2.0' } },
          )
          const data = await res.json()
          const addr = data.address || {}
          let city = addr.city || addr.town || addr.village || addr.municipality || addr.county || data.display_name?.split(',')[0] || ''
          if (city.toLowerCase().includes('região metropolitana')) {
            const m2 = city.match(/região metropolitana de (.+)/i)
            if (m2) city = m2[1]
          }
          const state = addr.state_code || addr.ISO3166_2_lvl4?.split('-')[1] || ''
          newNames[key] = state ? `${city}, ${state}` : city
          if (idx === toFetch.length - 1 || Object.keys(newNames).length === toFetch.length) {
            setCityNames((prev) => ({ ...prev, ...newNames }))
          }
        } catch { /* ignore */ }
      }, idx * 1100)
    })
  }, [samples])

  // ── Fit bounds ───────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !routeGeometry?.coordinates?.length) return
    const bounds = new maplibregl.LngLatBounds()
    routeGeometry.coordinates.forEach((c) => bounds.extend(c as [number, number]))
    // Compute dynamic padding (sidebar and top bar only; exclude timeline from bottom)
    let topPad = 60
    let bottomPad = 60
    let leftPad = 60
    try {
      const rp = document.getElementById('route-panel')
      if (rp) leftPad = Math.round(rp.getBoundingClientRect().width) + 16
      const tb = document.querySelector('header')
      if (tb) topPad = Math.round((tb as HTMLElement).getBoundingClientRect().height) + 8
    } catch (e) { /* ignore */ }

    map.current.fitBounds(bounds, {
      padding: { top: topPad, bottom: bottomPad, left: leftPad, right: 60 },
      duration: 1000,
    })
  }, [routeGeometry])

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Compact legend (moved out from timeline) */}
      <MapLegend />

      {/* Controls */}
      <div className="absolute top-14 right-3 z-30 flex flex-col gap-2">
        {routeGeometry && (
          <button onClick={fitToRoute} className="p-2.5 bg-blue-600 hover:bg-blue-700 rounded-md shadow-md transition" title="Ajustar visualização da rota">
            <FiTarget className="w-5 h-5 text-white" />
          </button>
        )}
        <button
          onClick={() => { setShowLayerMenu(!showLayerMenu); if (!showLayerMenu) setShowPointsList(false) }}
          className="p-2.5 bg-white dark:bg-gray-800 rounded-md shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          title="Alterar estilo do mapa"
        >
          <FiLayers className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        {samples && samples.length > 0 && (
          <button
            onClick={() => { setShowPointsList(!showPointsList); if (!showPointsList) setShowLayerMenu(false) }}
            className="p-2.5 bg-white dark:bg-gray-800 rounded-md shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            title="Ver lista de pontos da rota"
          >
            <FiList className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {showLayerMenu && (
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-0.5">
            {Object.entries(MAP_STYLES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setStyle(key); setShowLayerMenu(false) }}
                className={`block w-full text-left px-2 py-1 text-xs rounded transition
                  ${style === key ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {cfg.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Points List */}
      {showPointsList && samples && samples.length > 0 && (
        <div className="absolute top-14 right-12 z-30 w-52 max-h-[55vh] bg-white/95 dark:bg-gray-900/95
                       backdrop-blur-md rounded-lg shadow-xl border border-gray-200 dark:border-gray-700
                       overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200 dark:border-gray-700">
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">📍 Pontos ({samples.length})</span>
            <button onClick={() => setShowPointsList(false)} className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <FiX className="w-3 h-3 text-gray-500" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {samples.map((s, i) => {
              const color = RISK_COLORS[s.rain_risk] || RISK_COLORS.none
              const cityKey = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`
              const city = cityNames[cityKey] || `Ponto ${i + 1}`
              return (
                <button
                  key={i}
                  onClick={() => map.current?.flyTo({ center: [s.lon, s.lat], zoom: 10, duration: 800 })}
                  onMouseEnter={() => {
                    hoverPopupRef.current?.remove()
                    if (!map.current) return
                    hoverPopupRef.current = new maplibregl.Popup({ offset: 8, maxWidth: '190px', closeButton: false })
                      .setLngLat([s.lon, s.lat])
                      .setHTML(`<div style="font-size:10px;font-family:system-ui"><b>${city}</b><br/>🌧️ ${s.precip_prob}% · ${s.precip_mm}mm${s.temperature_c != null ? `<br/>🌡️ ${s.temperature_c}°C` : ''}</div>`)
                      .addTo(map.current)
                  }}
                  onMouseLeave={() => hoverPopupRef.current?.remove()}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-gray-50
                             dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 last:border-0 transition"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 0 1px white, 0 0 0 2px ${color}` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{city}</div>
                    <div className="text-[9px] text-gray-400">
                      {s.precip_prob}% · {s.temperature_c != null ? `${s.temperature_c}°C · ` : ''}
                      {new Date(s.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
