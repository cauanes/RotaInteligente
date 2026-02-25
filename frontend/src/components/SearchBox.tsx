/**
 * SearchBox — Campo de busca com geocoding via Nominatim.
 *
 * Debounce de 400ms para evitar chamadas excessivas.
 * Mostra sugestões ao digitar, selecionar atualiza coordenadas.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { FiMapPin, FiX } from 'react-icons/fi'
import React, { useState, useRef, useEffect } from 'react'
import type { Coordinates } from '../services/api'

interface Props {
  label: string
  placeholder?: string
  onSelect: (coords: Coordinates, displayName: string) => void
  value?: string
}

interface Suggestion {
  display_name: string
  lat: string
  lon: string
  importance: number
  address?: Record<string, string>
}

export default function SearchBox({ label, placeholder, onSelect, value }: Props) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync prop
  useEffect(() => { if (value) setQuery(value) }, [value])

  function handleChange(text: string) {
    setQuery(text)
    clearTimeout(timer.current)
    if (text.length < 2) { setSuggestions([]); return }

    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6`,
          { headers: { 'User-Agent': 'WeatherRoutePlanner/2.0' } },
        )
        const data: Suggestion[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function formatPlaceName(s: Suggestion) {
    // Prefer structured address parts when available
    const addr = s.address || {}
    let city = addr.city || addr.town || addr.village || addr.municipality || addr.county || null
    
    // Remove "Região Metropolitana de" and similar prefixes
    if (city && city.toLowerCase().includes('região metropolitana')) {
      // Extract the actual city name after "de"
      const match = city.match(/região metropolitana de (.+)/i)
      if (match) city = match[1]
    }
    
    // state can be 'state' (full name) or 'state_code' depending on provider
    const state = addr.state_code || addr.state || null

    if (city && state) return `${city}, ${state}`
    if (city) return city

    // Fallback: take first token before comma (usually city)
    let fallback = s.display_name.split(',')[0]
    if (fallback.toLowerCase().includes('região metropolitana')) {
      const parts = s.display_name.split(',')
      fallback = parts.length > 1 ? parts[1].trim() : parts[0]
    }
    return fallback
  }

  function pick(s: Suggestion) {
    const name = formatPlaceName(s)
    setQuery(name)
    setOpen(false)
    onSelect({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) }, name)
  }

  return (
    <div ref={ref} className="relative w-full">
      <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
        {label}
      </label>
      <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                      rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
        <FiMapPin className="w-3.5 h-3.5 ml-2 text-gray-400 shrink-0" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || 'Digite uma cidade...'}
          className="w-full px-1.5 py-1 bg-transparent outline-none text-[11px]
                     text-gray-800 dark:text-white placeholder-gray-400"
          aria-label={label}
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]) }} className="px-2" aria-label="Limpar">
            <FiX className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Dropdown de sugestões */}
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800
                       border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg
                       max-h-60 overflow-y-auto z-50"
            role="listbox"
          >
            {suggestions.map((s, i) => (
              <li
                key={i}
                role="option"
                tabIndex={0}
                onClick={() => pick(s)}
                onKeyDown={(e) => e.key === 'Enter' && pick(s)}
                className="px-2 py-1.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700
                           text-xs text-gray-700 dark:text-gray-200 flex items-center gap-2
                           border-b last:border-b-0 border-gray-100 dark:border-gray-700"
              >
                <FiMapPin className="w-3 h-3 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-xs">{formatPlaceName(s)}</div>
                  <div className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.display_name}</div>
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {loading && (
        <div className="absolute right-3 top-8">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
