import React from 'react'

export default function MapLegend() {
  return (
    <div className="absolute left-4 bottom-20 z-50 ui-scale">
      <div className="bg-white/90 dark:bg-gray-900/90 text-xs rounded-md shadow-md border border-gray-200 dark:border-gray-700 px-2 py-1 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-green-400" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200">Sem chuva</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-yellow-400" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200">Leve</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-orange-400" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200">Moderada</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-red-500" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200">Forte</span>
        </div>
      </div>
    </div>
  )
}
