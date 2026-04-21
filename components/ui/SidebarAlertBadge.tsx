'use client'

import { useEffect, useState } from 'react'

export function SidebarAlertBadge() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/alerts/summary')
      .then(r => r.json())
      .then(d => setCount(d.total ?? 0))
      .catch(() => {})
  }, [])

  if (!count) return null

  return (
    <span
      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold"
      style={{ background: '#C0392B', color: '#fff' }}
    >
      {count}
    </span>
  )
}
