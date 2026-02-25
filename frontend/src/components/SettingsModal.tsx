/**
 * SettingsModal — Modal de configurações.
 *
 * Permite configurar chaves de API e preferências.
 * Animado com Framer Motion (backdrop + slide).
 */

import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiKey, FiInfo } from 'react-icons/fi'
import React from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="ui-scale fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                       w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl
                       border border-gray-200 dark:border-gray-700"
            role="dialog"
            aria-label="Configurações"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">⚙️ Configurações</h2>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Fechar">
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5">
              {/* Info */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FiInfo className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold">Chaves de API</p>
                  <p className="text-xs mt-1">
                    As chaves são configuradas no servidor via variáveis de ambiente (.env).
                    O frontend não requer nenhum token (usa MapLibre + tiles gratuitos).
                  </p>
                </div>
              </div>

              {/* Status das APIs */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <FiKey className="w-4 h-4" /> Status dos Serviços
                </h3>
                <div className="space-y-2">
                  {[
                    { name: 'Open-Meteo', status: '✅ Gratuito, sempre disponível' },
                    { name: 'OSRM Routing', status: '✅ Gratuito, sem chave necessária' },
                    { name: 'TomTom Traffic', status: '⚙️ Gratuito (2500 req/dia), fallback heurístico' },
                    { name: 'OpenRouteService', status: '⚙️ Requer ORS_API_KEY no backend' },
                    { name: 'OpenWeather', status: '⚙️ Opcional (OPENWEATHER_API_KEY)' },
                    { name: 'MapLibre GL', status: '✅ Open-source, sem token necessário' },
                  ].map((api) => (
                    <div key={api.name} className="flex items-center justify-between text-sm py-1.5
                                                    border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <span className="text-gray-700 dark:text-gray-300">{api.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{api.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sobre */}
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p><strong>Weather Route Planner v2.0</strong></p>
                <p>Backend: FastAPI · Frontend: React + Vite + Tailwind + MapLibre</p>
                <p>Cache: Redis (com fallback local) · Trânsito: TomTom + heurística BR</p>
                <p>Fuso horário: America/Sao_Paulo (BRT/BRST)</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
