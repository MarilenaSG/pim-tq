'use client'

import { useState, useRef, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui'
import type { CustomFieldDefinition } from '@/types'

type RowData = {
  codigo_modelo:   string
  description:     string
  supplier_name:   string
  metal:           string
  familia:         string
  category:        string
  is_discontinued: string   // '0' | '1'
  [key: string]:   string
}

interface FilterOptions {
  suppliers:  string[]
  metals:     string[]
  familias:   string[]
  categories: string[]
}

interface Filters {
  search:      string
  supplier:    string
  metal:       string
  familia:     string
  category:    string
  enCatalogo:  boolean   // true = solo no discontinuados
}

const EMPTY_FILTERS: Filters = {
  search:     '',
  supplier:   '',
  metal:      '',
  familia:    '',
  category:   '',
  enCatalogo: false,
}

interface Props {
  fieldDefs:     CustomFieldDefinition[]
  initialRows:   RowData[]
  filterOptions: FilterOptions
}

export function BatchCustomFieldsTable({ fieldDefs, initialRows, filterOptions }: Props) {
  const { toast } = useToast()
  const [rows, setRows]   = useState<RowData[]>(initialRows)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [isSaving, startSave]       = useTransition()
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const dirtyCount = dirty.size

  // ── Filtered view (client-side) ────────────────────────────────

  const visibleRows = useMemo(() => {
    const q = filters.search.toLowerCase().trim()
    return rows.filter(r => {
      if (filters.enCatalogo && r.is_discontinued === '1') return false
      if (filters.supplier && r.supplier_name !== filters.supplier)  return false
      if (filters.metal    && r.metal         !== filters.metal)     return false
      if (filters.familia  && r.familia        !== filters.familia)   return false
      if (filters.category && r.category       !== filters.category)  return false
      if (q) {
        const matchesCodigo = r.codigo_modelo.toLowerCase().includes(q)
        const matchesDesc   = r.description.toLowerCase().includes(q)
        if (!matchesCodigo && !matchesDesc) return false
      }
      return true
    })
  }, [rows, filters])

  const hasFilters =
    filters.search || filters.supplier || filters.metal ||
    filters.familia || filters.category || filters.enCatalogo

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
  }

  // ── Cell editing ───────────────────────────────────────────────

  function updateCell(codigoModelo: string, fieldKey: string, value: string) {
    setRows(prev =>
      prev.map(r => r.codigo_modelo === codigoModelo ? { ...r, [fieldKey]: value } : r)
    )
    setDirty(prev => { const next = new Set(prev); next.add(`${codigoModelo}|${fieldKey}`); return next })
  }

  // ── Save ───────────────────────────────────────────────────────

  function handleSave() {
    if (dirty.size === 0) return

    const dirtyFields = new Set<string>()
    const dirtyModels = new Set<string>()
    dirty.forEach(key => {
      const [model, field] = key.split('|')
      dirtyModels.add(model)
      dirtyFields.add(field)
    })

    const dirtyRows = rows.filter(r => dirtyModels.has(r.codigo_modelo))

    startSave(async () => {
      try {
        const res = await fetch('/api/batch/update', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ rows: dirtyRows, fields: Array.from(dirtyFields) }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error ?? 'Error desconocido')
        setDirty(new Set())
        toast(`${data.updated} campos guardados`, 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al guardar', 'error')
      }
    })
  }

  // ── Export ─────────────────────────────────────────────────────

  async function handleExport() {
    try {
      const res = await fetch('/api/products/batch-custom-fields')
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `campos-custom-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('No se pudo descargar el Excel', 'error')
    }
  }

  // ── Import ─────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res  = await fetch('/api/products/batch-custom-fields', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)

      const importedMap: Record<string, Record<string, string>> = {}
      for (const row of data.rows as Record<string, string>[]) {
        if (row.codigo_modelo) importedMap[row.codigo_modelo] = row
      }

      const importedFields: string[] = data.fields as string[]
      const newDirty = new Set(dirty)

      setRows(prev =>
        prev.map(r => {
          const imported = importedMap[r.codigo_modelo]
          if (!imported) return r
          const updated = { ...r }
          for (const field of importedFields) {
            if (field in imported && imported[field] !== '') {
              updated[field] = imported[field]
              newDirty.add(`${r.codigo_modelo}|${field}`)
            }
          }
          return updated
        })
      )
      setDirty(newDirty)
      toast(`${Object.keys(importedMap).length} modelos importados — revisa y guarda`, 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al importar', 'error')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Empty field defs ───────────────────────────────────────────

  if (fieldDefs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3" style={{ color: '#e8e3df' }}>≡</p>
          <p className="font-medium text-tq-snorkel">Sin campos custom activos</p>
          <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>
            Define campos en{' '}
            <Link href="/settings/fields" className="text-tq-sky hover:underline">
              Configuración → Campos
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 pb-6 gap-3">

      {/* ── Filter bar ── */}
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap items-end gap-3"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,32,60,0.07)' }}
      >
        {/* Búsqueda */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>
            Buscar modelo / descripción
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="Ej. 002AA o anillo oro…"
            className="px-2.5 py-1.5 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-tq-sky"
            style={{ borderColor: 'rgba(0,85,127,0.18)', color: '#00557f' }}
          />
        </div>

        {/* Marca */}
        <FilterSelect
          label="Marca"
          value={filters.supplier}
          options={filterOptions.suppliers}
          onChange={v => setFilter('supplier', v)}
        />

        {/* Metal */}
        <FilterSelect
          label="Metal"
          value={filters.metal}
          options={filterOptions.metals}
          onChange={v => setFilter('metal', v)}
        />

        {/* Familia */}
        <FilterSelect
          label="Familia"
          value={filters.familia}
          options={filterOptions.familias}
          onChange={v => setFilter('familia', v)}
        />

        {/* Categoría */}
        <FilterSelect
          label="Categoría"
          value={filters.category}
          options={filterOptions.categories}
          onChange={v => setFilter('category', v)}
        />

        {/* En catálogo */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>
            En catálogo
          </label>
          <button
            onClick={() => setFilter('enCatalogo', !filters.enCatalogo)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={
              filters.enCatalogo
                ? { background: '#00557f', color: 'white', borderColor: '#00557f' }
                : { background: 'white', color: '#00557f', borderColor: 'rgba(0,85,127,0.2)' }
            }
          >
            {filters.enCatalogo ? 'Solo activos' : 'Todos'}
          </button>
        </div>

        {/* Limpiar */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="self-end px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: '#C8842A', background: '#FDF3E4' }}
          >
            Limpiar filtros
          </button>
        )}

        {/* Spacer + contador */}
        <div className="flex-1" />
        <p className="self-end text-xs pb-0.5" style={{ color: '#b2b2b2' }}>
          {visibleRows.length} de {rows.length} modelos
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/products" className="text-sm flex items-center gap-1" style={{ color: '#6b8a9a' }}>
          ← Volver a productos
        </Link>
        <div className="flex-1" />

        {dirtyCount > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: '#FDF3E4', color: '#C8842A' }}>
            {dirtyCount} {dirtyCount === 1 ? 'celda modificada' : 'celdas modificadas'}
          </span>
        )}

        <button
          onClick={handleExport}
          className="text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-slate-50"
          style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
        >
          ↓ Exportar Excel
        </button>

        <label
          className="text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer"
          style={{
            borderColor: 'rgba(0,85,127,0.2)',
            color:       isImporting ? '#b2b2b2' : '#00557f',
            background:  isImporting ? '#f9f9f9'  : undefined,
          }}
        >
          {isImporting ? 'Importando…' : '↑ Importar Excel'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={handleImport}
            disabled={isImporting}
          />
        </label>

        <button
          onClick={handleSave}
          disabled={dirtyCount === 0 || isSaving}
          className="text-sm px-4 py-1.5 rounded-lg font-semibold text-white transition-all"
          style={{
            background: dirtyCount > 0 && !isSaving ? '#C8842A' : '#d4cfc9',
            cursor:     dirtyCount > 0 && !isSaving ? 'pointer' : 'not-allowed',
          }}
        >
          {isSaving ? 'Guardando…' : dirtyCount > 0 ? `Guardar cambios (${dirtyCount})` : 'Guardar cambios'}
        </button>
      </div>

      {/* ── Table ── */}
      <div
        className="flex-1 overflow-auto rounded-xl border"
        style={{ borderColor: 'rgba(0,85,127,0.12)', minHeight: 0 }}
      >
        {visibleRows.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm" style={{ color: '#b2b2b2' }}>
              Ningún producto coincide con los filtros aplicados.
            </p>
          </div>
        ) : (
          <table className="text-sm border-collapse" style={{ minWidth: '100%' }}>
            <thead className="sticky top-0 z-10">
              <tr style={{ background: '#00557f' }}>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold text-white whitespace-nowrap sticky left-0 z-20"
                  style={{ background: '#00557f', minWidth: 110 }}
                >
                  Modelo
                </th>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold text-white sticky z-20"
                  style={{
                    background: '#00557f',
                    minWidth: 240,
                    left: 110,
                    borderRight: '2px solid rgba(255,255,255,0.15)',
                  }}
                >
                  Descripción
                </th>
                {fieldDefs.map(f => (
                  <th
                    key={f.field_key}
                    className="text-left px-3 py-2.5 text-xs font-semibold text-white whitespace-nowrap"
                    style={{ minWidth: 190 }}
                  >
                    {f.label}
                    <span className="ml-1.5 text-[9px] font-normal opacity-50">{f.field_type}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={row.codigo_modelo}
                  style={{ background: i % 2 === 0 ? 'white' : 'rgba(0,85,127,0.025)' }}
                  className="hover:bg-sky-50/50 group"
                >
                  <td
                    className="px-3 py-1.5 sticky left-0 z-10 whitespace-nowrap"
                    style={{ background: 'inherit', minWidth: 110 }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/products/${row.codigo_modelo}`}
                        className="text-xs font-mono font-bold hover:underline"
                        style={{ color: '#C8842A' }}
                        target="_blank"
                      >
                        {row.codigo_modelo}
                      </Link>
                      {row.is_discontinued === '1' && (
                        <span className="text-[9px] font-medium px-1 rounded"
                              style={{ background: '#f0eeec', color: '#999' }}>
                          descatalogado
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-3 py-1.5 sticky z-10"
                    style={{
                      background: 'inherit',
                      minWidth: 240,
                      left: 110,
                      borderRight: '1px solid rgba(0,85,127,0.08)',
                    }}
                  >
                    <span className="text-xs text-tq-snorkel line-clamp-1">{row.description}</span>
                  </td>
                  {fieldDefs.map(f => {
                    const isDirty = dirty.has(`${row.codigo_modelo}|${f.field_key}`)
                    return (
                      <td key={f.field_key} className="px-1.5 py-1" style={{ minWidth: 190 }}>
                        <CellInput
                          fieldDef={f}
                          value={row[f.field_key] ?? ''}
                          isDirty={isDirty}
                          onChange={v => updateCell(row.codigo_modelo, f.field_key, v)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs" style={{ color: '#b2b2b2' }}>
        Edita directamente en la tabla o importa un Excel. Los cambios (marcados en naranja) se aplican al hacer clic en &quot;Guardar cambios&quot;.
      </p>
    </div>
  )
}

// ── Filter select helper ──────────────────────────────────────────

function FilterSelect({
  label, value, options, onChange,
}: {
  label:    string
  value:    string
  options:  string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-tq-sky"
        style={{
          borderColor: value ? '#00557f' : 'rgba(0,85,127,0.18)',
          color: value ? '#00557f' : '#6b8a9a',
          background: value ? 'rgba(0,85,127,0.04)' : 'white',
          minWidth: 130,
        }}
      >
        <option value="">Todas</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Cell input by field type ──────────────────────────────────────

function CellInput({
  fieldDef, value, isDirty, onChange,
}: {
  fieldDef: CustomFieldDefinition
  value:    string
  isDirty:  boolean
  onChange: (v: string) => void
}) {
  const base = 'w-full px-2 py-1 rounded text-xs border transition-colors focus:outline-none focus:ring-1 focus:ring-amber-300'
  const style = isDirty
    ? { borderColor: '#C8842A', background: '#FDF3E4', color: '#8B5E1A' }
    : { borderColor: 'rgba(0,85,127,0.12)', background: 'transparent', color: '#00557f' }

  if (fieldDef.field_type === 'boolean') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={base} style={style}>
        <option value="">—</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    )
  }

  if (fieldDef.field_type === 'select') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={base} style={style}>
        <option value="">—</option>
        {(fieldDef.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      type={fieldDef.field_type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="—"
      className={base}
      style={style}
    />
  )
}
