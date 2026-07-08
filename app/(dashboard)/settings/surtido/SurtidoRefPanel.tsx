'use client'

import { useState, useTransition } from 'react'
import { saveRolCategoria, saveStoreCluster } from './actions'
import type { RolCategoriaFamilia, Store } from '@/types'

const ROLES = ['Destino', 'Rutina', 'Ocasional', 'Conveniencia']
const CLUSTERS = ['A', 'B', 'C']

export function SurtidoRefPanel({ roles, stores }: { roles: RolCategoriaFamilia[]; stores: Store[] }) {
  return (
    <div className="space-y-8">
      <RolCategoriaTable roles={roles} />
      <StoresTable stores={stores} />
    </div>
  )
}

// ── Rol de categoría por familia ──────────────────────────────
function RolCategoriaTable({ roles }: { roles: RolCategoriaFamilia[] }) {
  const [isPending, startTrans] = useTransition()
  const [savedFam, setSavedFam] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>, familia: string) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTrans(async () => {
      const res = await saveRolCategoria(fd)
      if (res.ok) { setSavedFam(familia); setTimeout(() => setSavedFam(null), 1500) }
      else setError(res.error ?? 'Error')
    })
  }

  return (
    <section>
      <h3 className="text-[15px] font-semibold text-[#00264d] mb-1">Rol de categoría por familia</h3>
      <p className="text-[12px] text-[#8fa8b8] mb-3">
        Eje de referencia (Destino / Rutina / Ocasional / Conveniencia). No modifica la clasificación de surtido — sirve para lectura estratégica.
      </p>
      {error && <p className="text-[12px] text-[#C0392B] mb-2">{error}</p>}
      <div className="tq-table-wrap">
        <table className="tq-table">
          <thead>
            <tr>
              <th>Familia</th>
              <th>Rol de categoría</th>
              <th>Justificación</th>
              <th className="right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.familia}>
                <td className="font-medium" style={{ color: '#00557f' }}>{r.familia}</td>
                <td colSpan={3}>
                  <form onSubmit={e => submit(e, r.familia)} className="flex items-center gap-2">
                    <input type="hidden" name="familia" value={r.familia} />
                    <select
                      name="rol_categoria"
                      defaultValue={r.rol_categoria ?? ''}
                      className="border rounded-md px-2 py-1 text-[13px]"
                      style={{ borderColor: 'rgba(0,85,127,0.2)' }}
                    >
                      <option value="">—</option>
                      {ROLES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input
                      name="justificacion"
                      defaultValue={r.justificacion ?? ''}
                      placeholder="Justificación"
                      className="border rounded-md px-2 py-1 text-[13px] flex-1"
                      style={{ borderColor: 'rgba(0,85,127,0.2)' }}
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-3 py-1 rounded-md text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ background: '#0099f2' }}
                    >
                      {savedFam === r.familia ? '✓ Guardado' : 'Guardar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Cluster de tienda ─────────────────────────────────────────
function StoresTable({ stores }: { stores: Store[] }) {
  const [isPending, startTrans] = useTransition()
  const [savedTienda, setSavedTienda] = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>, tienda: string) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTrans(async () => {
      const res = await saveStoreCluster(fd)
      if (res.ok) { setSavedTienda(tienda); setTimeout(() => setSavedTienda(null), 1500) }
      else setError(res.error ?? 'Error')
    })
  }

  return (
    <section>
      <h3 className="text-[15px] font-semibold text-[#00264d] mb-1">Cluster de tienda</h3>
      <p className="text-[12px] text-[#8fa8b8] mb-3">
        18 tiendas físicas. El cluster (A/B/C) sale del ranking de ingresos 12M y se edita a mano. Tabla analítica para CM — no afecta a la zona Tiendas.
      </p>
      {error && <p className="text-[12px] text-[#C0392B] mb-2">{error}</p>}
      <div className="tq-table-wrap">
        <table className="tq-table">
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Localización</th>
              <th className="right">Ingresos 12M</th>
              <th className="right">Uds 12M</th>
              <th>Cluster</th>
              <th className="right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {stores.map(s => (
              <tr key={s.tienda}>
                <td className="font-medium" style={{ color: '#00557f' }}>{s.tienda}</td>
                <td>{s.tipo_localizacion ?? '—'}{s.tamano_m2 ? ` · ${s.tamano_m2}` : ''}</td>
                <td className="right">{s.ingresos_12m != null ? Number(s.ingresos_12m).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}</td>
                <td className="right">{s.unidades_12m != null ? Number(s.unidades_12m).toLocaleString('es-ES') : '—'}</td>
                <td colSpan={2}>
                  <form onSubmit={e => submit(e, s.tienda)} className="flex items-center gap-2 justify-end">
                    <input type="hidden" name="tienda" value={s.tienda} />
                    <select
                      name="cluster"
                      defaultValue={s.cluster ?? ''}
                      className="border rounded-md px-2 py-1 text-[13px]"
                      style={{ borderColor: 'rgba(0,85,127,0.2)' }}
                    >
                      <option value="">—</option>
                      {CLUSTERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-3 py-1 rounded-md text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ background: '#0099f2' }}
                    >
                      {savedTienda === s.tienda ? '✓ Guardado' : 'Guardar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
