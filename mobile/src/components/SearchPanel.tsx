/**
 * SearchPanel — Bottom sheet with origin/destination inputs.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  FlatList,
} from 'react-native'
import type { Coordinates } from '../services/api'

interface Props {
  onAnalyze: (origin: Coordinates, destination: Coordinates) => void
  loading: boolean
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
}

export default function SearchPanel({ onAnalyze, loading }: Props) {
  const [originText, setOriginText] = useState('')
  const [destText, setDestText] = useState('')
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(null)
  const [destCoords, setDestCoords] = useState<Coordinates | null>(null)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [activeField, setActiveField] = useState<'origin' | 'dest' | null>(null)

  async function search(text: string, field: 'origin' | 'dest') {
    if (field === 'origin') setOriginText(text)
    else setDestText(text)
    setActiveField(field)

    if (text.length < 3) { setSuggestions([]); return }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'RotaInteligente-Mobile/1.0' } },
      )
      const data: SearchResult[] = await res.json()
      setSuggestions(data)
    } catch { setSuggestions([]) }
  }

  function selectSuggestion(item: SearchResult) {
    const coords: Coordinates = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) }
    const name = item.display_name.split(',').slice(0, 2).join(',')
    if (activeField === 'origin') {
      setOriginText(name)
      setOriginCoords(coords)
    } else {
      setDestText(name)
      setDestCoords(coords)
    }
    setSuggestions([])
    Keyboard.dismiss()
  }

  function handleAnalyze() {
    if (!originCoords || !destCoords) return
    Keyboard.dismiss()
    onAnalyze(originCoords, destCoords)
  }

  return (
    <View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
      elevation: 10,
    }}>
      <TextInput
        placeholder="🟢 Origem (ex: São Paulo, SP)"
        value={originText}
        onChangeText={(t) => search(t, 'origin')}
        onFocus={() => setActiveField('origin')}
        style={{
          borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
          marginBottom: 8, backgroundColor: '#f9fafb',
        }}
      />
      <TextInput
        placeholder="🔴 Destino (ex: Rio de Janeiro, RJ)"
        value={destText}
        onChangeText={(t) => search(t, 'dest')}
        onFocus={() => setActiveField('dest')}
        style={{
          borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
          marginBottom: 8, backgroundColor: '#f9fafb',
        }}
      />

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(_, i) => String(i)}
          style={{ maxHeight: 150, marginBottom: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => selectSuggestion(item)}
              style={{
                paddingVertical: 8, paddingHorizontal: 10,
                borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
              }}
            >
              <Text style={{ fontSize: 12, color: '#374151' }} numberOfLines={1}>
                {item.display_name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        onPress={handleAnalyze}
        disabled={!originCoords || !destCoords || loading}
        style={{
          backgroundColor: originCoords && destCoords && !loading ? '#3b82f6' : '#d1d5db',
          paddingVertical: 12, borderRadius: 10, alignItems: 'center',
          flexDirection: 'row', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
            🗺️ Analisar Rota
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}
