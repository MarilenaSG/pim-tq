'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Este page crea un borrador y redirige automáticamente al paso 1.
// Se usa si alguien navega directamente a /lanzamiento/nuevo.
export default function NuevoLanzamientoPage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/lanzamiento', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    })
      .then(r => r.json())
      .then(d => router.replace(`/lanzamiento/${d.id}/paso/1`))
      .catch(() => router.replace('/lanzamiento'))
  }, [router])

  return (
    <div className="flex items-center justify-center h-full gap-3">
      <span className="inline-block w-4 h-4 border-2 border-[rgba(0,85,127,0.3)] border-t-[#00557f] rounded-full animate-spin" />
      <p className="text-sm" style={{ color: '#8fa8b8' }}>Preparando el wizard…</p>
    </div>
  )
}
