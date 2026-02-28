/**
 * RouteResults — Summary card shown after route analysis.
 */

import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import type { RouteSummary, TrafficSummary } from '../services/api'

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  none: { bg: '#dcfce7', text: '#166534' },
  low: { bg: '#fef9c3', text: '#854d0e' },
  moderate: { bg: '#ffedd5', text: '#9a3412' },
  high: { bg: '#fee2e2', text: '#991b1b' },
  very_high: { bg: '#f3e8ff', text: '#6b21a8' },
}

interface Props {
  summary: RouteSummary
  trafficSummary?: TrafficSummary
}

export default function RouteResults({ summary, trafficSummary }: Props) {
  const risk = RISK_COLORS[summary.overall_risk] || RISK_COLORS.none
  const hours = Math.floor(summary.duration_minutes / 60)
  const mins = Math.round(summary.duration_minutes % 60)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ position: 'absolute', top: 70, left: 0, right: 0 }}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
    >
      {/* Distance & Duration */}
      <View style={{
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        minWidth: 120, shadowColor: '#000', shadowOpacity: 0.08,
        shadowRadius: 6, elevation: 3,
      }}>
        <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600' }}>Distância</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
          {summary.distance_km.toFixed(0)} km
        </Text>
        <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Duração</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
          {hours}h{mins}min
        </Text>
      </View>

      {/* Weather risk */}
      <View style={{
        backgroundColor: risk.bg, borderRadius: 12, padding: 12,
        minWidth: 160, shadowColor: '#000', shadowOpacity: 0.08,
        shadowRadius: 6, elevation: 3,
      }}>
        <Text style={{ fontSize: 10, color: risk.text, fontWeight: '600' }}>Clima</Text>
        <Text style={{ fontSize: 12, color: risk.text, fontWeight: '500', marginTop: 2 }}>
          {summary.recommendation}
        </Text>
      </View>

      {/* Traffic */}
      {trafficSummary && (
        <View style={{
          backgroundColor: '#fff', borderRadius: 12, padding: 12,
          minWidth: 120, shadowColor: '#000', shadowOpacity: 0.08,
          shadowRadius: 6, elevation: 3,
        }}>
          <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600' }}>Trânsito</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
            {Math.round(trafficSummary.avg_congestion_ratio * 100)}%
          </Text>
          <View style={{
            height: 4, backgroundColor: '#e5e7eb', borderRadius: 2,
            marginTop: 4, overflow: 'hidden',
          }}>
            <View style={{
              height: '100%', borderRadius: 2,
              width: `${Math.round(trafficSummary.avg_congestion_ratio * 100)}%`,
              backgroundColor: trafficSummary.avg_congestion_ratio < 0.3 ? '#16a34a'
                : trafficSummary.avg_congestion_ratio < 0.6 ? '#ca8a04'
                : '#dc2626',
            }} />
          </View>
          <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
            +{trafficSummary.total_delay_minutes.toFixed(0)}min atraso
          </Text>
        </View>
      )}

      {/* Fog */}
      {summary.fog_risk && summary.fog_risk !== 'none' && (
        <View style={{
          backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12,
          minWidth: 100, shadowColor: '#000', shadowOpacity: 0.08,
          shadowRadius: 6, elevation: 3,
        }}>
          <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>Neblina</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>
            🌫️ {summary.fog_risk === 'high' ? 'Densa' : summary.fog_risk === 'moderate' ? 'Moderada' : 'Leve'}
          </Text>
        </View>
      )}

      {/* Traffic lights delay */}
      {summary.traffic_lights_delay_minutes > 0 && (
        <View style={{
          backgroundColor: '#fff', borderRadius: 12, padding: 12,
          minWidth: 100, shadowColor: '#000', shadowOpacity: 0.08,
          shadowRadius: 6, elevation: 3,
        }}>
          <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600' }}>Semáforos</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
            🚦 ~{Math.round(summary.traffic_lights_delay_minutes)}min
          </Text>
        </View>
      )}
    </ScrollView>
  )
}
