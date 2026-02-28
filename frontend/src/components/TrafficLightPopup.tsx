/**
 * TrafficLightPopup — Popup de semáforo próximo com countdown timer.
 *
 * Quando o usuário está no modo navegação e se aproxima de um semáforo
 * (< 200m), este componente exibe um popup flutuante com:
 *  - Indicador visual do estado atual (verde/amarelo/vermelho)
 *  - Countdown timer para a próxima mudança
 *  - Nome do semáforo (se disponível)
 *  - Distância aproximada
 *
 * O ciclo é simulado localmente baseado nos tempos do backend.
 */

import React, { useEffect, useState, useRef } from 'react'
import type { TrafficLightPoint } from '../services/api'

interface Props {
  signal: TrafficLightPoint | null
  visible: boolean
}

type LightPhase = 'green' | 'yellow' | 'red'

const PHASE_COLORS: Record<LightPhase, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
}

const PHASE_LABELS: Record<LightPhase, string> = {
  green: 'Verde',
  yellow: 'Amarelo',
  red: 'Vermelho',
}

export default function TrafficLightPopup({ signal, visible }: Props) {
  const [phase, setPhase] = useState<LightPhase>('green')
  const [countdown, setCountdown] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!signal || !visible) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const { green_duration, yellow_duration, red_duration } = signal
    const totalCycle = green_duration + yellow_duration + red_duration

    // Determine current phase based on "simulated" time
    // Start from a random offset so it looks realistic
    const startOffset = Math.floor(Math.random() * totalCycle)
    let elapsed = startOffset

    function getPhaseAndRemaining(t: number): { phase: LightPhase; remaining: number } {
      const pos = t % totalCycle
      if (pos < green_duration) {
        return { phase: 'green', remaining: green_duration - pos }
      } else if (pos < green_duration + yellow_duration) {
        return { phase: 'yellow', remaining: green_duration + yellow_duration - pos }
      } else {
        return { phase: 'red', remaining: totalCycle - pos }
      }
    }

    const { phase: initPhase, remaining: initRemaining } = getPhaseAndRemaining(elapsed)
    setPhase(initPhase)
    setCountdown(initRemaining)

    intervalRef.current = setInterval(() => {
      elapsed += 1
      const { phase: p, remaining } = getPhaseAndRemaining(elapsed)
      setPhase(p)
      setCountdown(remaining)
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [signal, visible])

  if (!visible || !signal) return null

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50
                    bg-white/95 dark:bg-gray-900/95 backdrop-blur-md
                    rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700
                    px-5 py-4 flex items-center gap-4 min-w-[260px]
                    animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Traffic light visual */}
      <div className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl px-2 py-2">
        {(['red', 'yellow', 'green'] as LightPhase[]).map((p) => (
          <div
            key={p}
            className="w-6 h-6 rounded-full transition-all duration-300"
            style={{
              background: phase === p ? PHASE_COLORS[p] : '#374151',
              boxShadow: phase === p ? `0 0 12px 2px ${PHASE_COLORS[p]}` : 'none',
            }}
          />
        ))}
      </div>

      {/* Info */}
      <div className="flex-1">
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          🚦 {signal.name || 'Semáforo próximo'}
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: PHASE_COLORS[phase] }}
          >
            {countdown}s
          </span>
          <span className="text-sm font-medium" style={{ color: PHASE_COLORS[phase] }}>
            {PHASE_LABELS[phase]}
          </span>
        </div>
        {signal.distance_m != null && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            📍 {signal.distance_m < 1000
              ? `${signal.distance_m}m`
              : `${(signal.distance_m / 1000).toFixed(1)}km`
            }
          </div>
        )}
      </div>
    </div>
  )
}
