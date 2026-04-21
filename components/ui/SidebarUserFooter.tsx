'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SidebarUserFooter() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!email) return null

  return (
    <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2.5">
      <span className="text-xs opacity-50">👤</span>
      <span className="text-xs text-white/50 flex-1 truncate">{email}</span>
      <button
        onClick={handleLogout}
        className="text-xs text-white/40 hover:text-white/80 transition-colors shrink-0"
        aria-label="Cerrar sesión"
      >
        Salir →
      </button>
    </div>
  )
}
