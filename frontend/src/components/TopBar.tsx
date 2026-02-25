/**
 * TopBar — Barra superior fixa com título, status e toggle de tema.
 * Inclui indicador de conexão com o backend.
 */

import { motion } from 'framer-motion'
import { WiDayCloudy } from 'react-icons/wi'
import { FiMoon, FiSun, FiSettings } from 'react-icons/fi'
import React, { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { getHealth } from '../services/api'

interface Props {
  onSettingsClick: () => void
}

export default function TopBar({ onSettingsClick }: Props) {
  const { theme, toggle } = useTheme()
  const [healthy, setHealthy] = useState<boolean | null>(null)

  useEffect(() => {
    getHealth()
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false))
    const id = setInterval(() => {
      getHealth()
        .then(() => setHealthy(true))
        .catch(() => setHealthy(false))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="ui-scale fixed top-0 left-0 right-0 z-50 flex items-center justify-between
                 px-3 py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md
                 border-b border-gray-200 dark:border-gray-700 shadow-sm"
    >
      {/* Logo + título */}
      <div className="flex items-center gap-1.5">
        <WiDayCloudy className="w-6 h-6 text-blue-500" aria-hidden />
        <h1 className="text-sm font-bold text-gray-800 dark:text-white">
          Weather Route Planner
        </h1>
        {/* Status dot */}
        <span
          className={`w-2 h-2 rounded-full ${
            healthy === true ? 'bg-green-500' : healthy === false ? 'bg-red-500' : 'bg-gray-400'
          }`}
          title={healthy ? 'API online' : 'API offline'}
          aria-label={healthy ? 'API online' : 'API offline'}
        />
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          aria-label={`Alternar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
        >
          {theme === 'light' ? <FiMoon className="w-5 h-5" /> : <FiSun className="w-5 h-5 text-yellow-400" />}
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          aria-label="Configurações"
        >
          <FiSettings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>
    </motion.header>
  )
}
