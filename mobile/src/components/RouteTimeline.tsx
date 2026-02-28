/**
 * RouteTimeline — Horizontal scrollable weather timeline for mobile.
 */

import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import type { WeatherSample } from '../services/api'

const RISK_COLORS: Record<string, string> = {
  none: '#16a34a',
  low: '#ca8a04',
  moderate: '#ea580c',
  high: '#dc2626',
  very_high: '#7c3aed',
}

interface Props {
  samples: WeatherSample[]
}

export default function RouteTimeline({ samples }: Props) {
  if (!samples || samples.length === 0) return null

  return (
    <View style={{ position: 'absolute', bottom: 160, left: 0, right: 0 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
      >
        {samples.map((s, i) => {
          const color = RISK_COLORS[s.rain_risk] || RISK_COLORS.none
          const time = new Date(s.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
          return (
            <View
              key={i}
              style={{
                backgroundColor: '#fff',
                borderRadius: 10,
                padding: 8,
                minWidth: 70,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
                borderLeftWidth: 3,
                borderLeftColor: color,
              }}
            >
              <Text style={{ fontSize: 9, color: '#6b7280', fontWeight: '600' }}>{time}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#111827', marginTop: 2 }}>
                {s.precip_prob}%
              </Text>
              {s.temperature_c != null && (
                <Text style={{ fontSize: 10, color: '#374151' }}>{s.temperature_c}°C</Text>
              )}
              <View
                style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: color, marginTop: 4,
                }}
              />
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
