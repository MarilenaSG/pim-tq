'use client'

import { ReactNode } from 'react'

interface ChartCardProps {
  title:     string
  subtitle?: string
  children:  ReactNode
  height?:   number
}

export function ChartCard({ title, subtitle, children, height = 300 }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#00557f] uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs text-[#b2b2b2] mt-0.5">{subtitle}</p>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}
