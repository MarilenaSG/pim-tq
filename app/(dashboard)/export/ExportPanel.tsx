'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────

interface ProductPickerItem {
  codigo_modelo: string
  description:   string | null
  metal:         string | null
  familia:       string | null
}

interface ExportPanelProps {
  metals:     string[]
  familias:   string[]
  categories: string[]
  abcs:       string[]
  marcas:     string[]
  products:   ProductPickerItem[]
}

interface ParsedRow {
  [key: string]: string
}

// ── MultiSelect Component ─────────────────────────────────────

interface MultiSelectProps {
  label:    string
  options:  string[]
  selected: string[]
  onChange: (val: string[]) => void
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt]
    )
  }

  const hasSelection = selected.length > 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors select-none whitespace-nowrap"
        style={{
          background:   hasSelection ? '#00557f' : '#fff',
          borderColor:  hasSelection ? '#00557f' : 'rgba(0,85,127,0.2)',
          color:        hasSelection ? '#fff'     : '#00557f',
        }}
      >
        {label}
        {hasSelection && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold bg-white text-[#00557f]">
            {selected.length}
          </span>
        )}
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1 left-0 z-20 rounded-xl shadow-lg border bg-white py-1 min-w-[160px]"
            style={{ borderColor: 'rgba(0,85,127,0.15)' }}
          >
            {options.map(opt => (
              <label
                key={opt}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[rgba(0,85,127,0.04)] text-sm text-[#00557f]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="rounded"
                  style={{ accentColor: '#00557f' }}
                />
                {opt}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0"
      style={{ background: value ? '#C8842A' : 'rgba(0,85,127,0.15)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: value ? '1.25rem' : '0.125rem' }}
      />
    </div>
  )
}

// ── Tab Bar ───────────────────────────────────────────────────

const TABS = ['Exportar', 'Shopify CSV', 'Actualizar en lote'] as const
type Tab = typeof TABS[number]

// ── ExportPanel ───────────────────────────────────────────────

export function ExportPanel({ metals, familias, categories, abcs, marcas, products }: ExportPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Exportar')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(0,85,127,0.12)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: activeTab === tab ? '#C8842A' : 'transparent',
              color:       activeTab === tab ? '#C8842A' : '#00557f',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Exportar' && (
        <ExportTab
          metals={metals}
          familias={familias}
          categories={categories}
          abcs={abcs}
          marcas={marcas}
          products={products}
        />
      )}
      {activeTab === 'Shopify CSV' && (
        <ShopifyCsvTab metals={metals} familias={familias} abcs={abcs} />
      )}
      {activeTab === 'Actualizar en lote' && <BatchUpdateTab products={products} />}
    </div>
  )
}

// ── ExportTab ─────────────────────────────────────────────────

function ExportTab({
  metals, familias, categories, abcs, marcas, products,
}: Omit<ExportPanelProps, 'products'> & { products: ProductPickerItem[] }) {
  const [selMetals,     setSelMetals]     = useState<string[]>([])
  const [selFamilias,   setSelFamilias]   = useState<string[]>([])
  const [selCategories, setSelCategories] = useState<string[]>([])
  const [selAbcs,       setSelAbcs]       = useState<string[]>([])
  const [selMarcas,     setSelMarcas]     = useState<string[]>([])
  const [includeFinancials, setIncludeFinancials] = useState(false)

  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [basket,      setBasket]      = useState<ProductPickerItem[]>([])

  const [loading,     setLoading]     = useState(false)
  const [loadingPdf,  setLoadingPdf]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  const hasFilters = selMetals.length > 0 || selFamilias.length > 0 ||
                     selCategories.length > 0 || selAbcs.length > 0 || selMarcas.length > 0
  const hasBasket  = basket.length > 0

  const clearFilters = () => {
    setSelMetals([])
    setSelFamilias([])
    setSelCategories([])
    setSelAbcs([])
    setSelMarcas([])
  }

  const pickerResults = products
    .filter(p => {
      const q = pickerQuery.toLowerCase()
      return (
        p.codigo_modelo.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      )
    })
    .filter(p => !basket.find(b => b.codigo_modelo === p.codigo_modelo))
    .slice(0, 20)

  const addToBasket = (p: ProductPickerItem) =>
    setBasket(prev => [...prev, p])

  const removeFromBasket = (codigo: string) =>
    setBasket(prev => prev.filter(p => p.codigo_modelo !== codigo))

  function buildBody(extraFields?: Record<string, unknown>) {
    const manualCodes = hasBasket ? basket.map(p => p.codigo_modelo) : undefined
    return {
      metals:     selMetals.length     > 0 ? selMetals     : undefined,
      familias:   selFamilias.length   > 0 ? selFamilias   : undefined,
      categories: selCategories.length > 0 ? selCategories : undefined,
      abcs:       selAbcs.length       > 0 ? selAbcs       : undefined,
      marcas:     selMarcas.length     > 0 ? selMarcas     : undefined,
      manualCodes,
      ...extraFields,
    }
  }

  async function downloadFile(endpoint: string, body: object, fallbackName: string) {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? 'Error desconocido')
    }
    const blob     = await res.blob()
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? fallbackName
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    return filename
  }

  async function handleExport() {
    setLoading(true); setError(null); setSuccess(null)
    try {
      const filename = await downloadFile('/api/export/excel', buildBody({ includeFinancials }), 'Catalogo-TQ.xlsx')
      setSuccess(filename)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red') }
    finally { setLoading(false) }
  }

  async function handlePdf() {
    setLoadingPdf(true); setError(null); setSuccess(null)
    try {
      const filename = await downloadFile('/api/export/pdf', buildBody(), 'Catalogo-TQ.pdf')
      setSuccess(filename)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red') }
    finally { setLoadingPdf(false) }
  }


  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="tq-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-tq-snorkel">Filtros</h2>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-tq-sky underline underline-offset-2 hover:opacity-70"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <MultiSelect label="Metal"     options={metals}     selected={selMetals}     onChange={setSelMetals}     />
          <MultiSelect label="Familia"   options={familias}   selected={selFamilias}   onChange={setSelFamilias}   />
          <MultiSelect label="Categoría" options={categories} selected={selCategories} onChange={setSelCategories} />
          <MultiSelect label="ABC"       options={abcs}       selected={selAbcs}       onChange={setSelAbcs}       />
          <MultiSelect label="Marca"     options={marcas}     selected={selMarcas}     onChange={setSelMarcas}     />
        </div>
      </div>

      {/* Manual picker */}
      <div className="tq-card">
        <button
          type="button"
          onClick={() => setPickerOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-tq-snorkel"
        >
          <span>
            Selección manual
            {hasBasket && (
              <span className="ml-2 text-xs font-normal" style={{ color: '#b2b2b2' }}>
                ({basket.length} seleccionado{basket.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>
          <svg
            className="w-4 h-4 opacity-40 transition-transform"
            style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {pickerOpen && (
          <div className="px-6 pb-6 border-t" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
            {/* Basket chips */}
            {hasBasket && (
              <div className="flex flex-wrap gap-2 pt-4 pb-3">
                {basket.map(p => (
                  <span
                    key={p.codigo_modelo}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}
                  >
                    <span className="font-bold">{p.codigo_modelo}</span>
                    <span className="opacity-60 max-w-[120px] truncate">{p.description}</span>
                    <button
                      onClick={() => removeFromBasket(p.codigo_modelo)}
                      className="ml-0.5 opacity-50 hover:opacity-100 font-bold"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="pt-3">
              <input
                type="text"
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder="Buscar por código o descripción…"
                className="w-full rounded-lg border px-3 py-2 text-sm text-tq-snorkel focus:outline-none"
                style={{ borderColor: 'rgba(0,85,127,0.2)' }}
              />
            </div>

            {/* Results */}
            {pickerQuery.length > 0 && (
              <div
                className="mt-2 rounded-lg border overflow-hidden"
                style={{ borderColor: 'rgba(0,85,127,0.1)' }}
              >
                {pickerResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-center" style={{ color: '#b2b2b2' }}>
                    Sin resultados
                  </p>
                ) : (
                  pickerResults.map(p => (
                    <button
                      key={p.codigo_modelo}
                      type="button"
                      onClick={() => { addToBasket(p); setPickerQuery('') }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[rgba(0,85,127,0.04)] border-b last:border-b-0"
                      style={{ borderColor: 'rgba(0,85,127,0.06)' }}
                    >
                      <span className="font-bold text-tq-snorkel shrink-0">{p.codigo_modelo}</span>
                      <span className="text-xs truncate" style={{ color: '#00557f', opacity: 0.7 }}>
                        {p.description}
                      </span>
                      <span className="ml-auto text-xs shrink-0" style={{ color: '#b2b2b2' }}>
                        {p.metal} · {p.familia}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Financials toggle */}
      <div className="tq-card px-6 py-4">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <Toggle value={includeFinancials} onChange={setIncludeFinancials} />
          <span className="text-sm text-tq-snorkel">Incluir ingresos 12m</span>
          <span className="text-xs" style={{ color: '#b2b2b2' }}>(solo uso interno)</span>
        </label>
      </div>

      {/* Summary */}
      <div
        className="rounded-xl px-5 py-4 text-sm"
        style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)' }}
      >
        <span className="font-medium text-tq-snorkel">
          {!hasFilters && !hasBasket && 'Export completo del catálogo'}
          {hasFilters && !hasBasket && 'Filtrado por selección activa'}
          {!hasFilters && hasBasket && `${basket.length} producto${basket.length !== 1 ? 's' : ''} seleccionado${basket.length !== 1 ? 's' : ''} manualmente`}
          {hasFilters && hasBasket && `Filtros activos + ${basket.length} producto${basket.length !== 1 ? 's' : ''} manuales (unión)`}
        </span>
        <span className="text-xs ml-2" style={{ color: '#b2b2b2' }}>
          · Código · Descripción · Metal · Familia · ABC · Shopify · URL imagen
          {includeFinancials ? ' · Ingresos 12m' : ''}
        </span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleExport}
          disabled={loading || loadingPdf}
          className="py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: '#C8842A' }}
        >
          {loading ? 'Generando…' : '↓ Excel'}
        </button>
        <button
          onClick={handlePdf}
          disabled={loading || loadingPdf}
          className="py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: '#00557f' }}
        >
          {loadingPdf ? 'Generando PDF…' : '↓ PDF Catálogo'}
        </button>
      </div>

      {success && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'rgba(58,158,106,0.07)', border: '1px solid rgba(58,158,106,0.25)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#2d7a54' }}>
            ✓ Descargado: {success}
          </p>
          <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>
            Ábrelo en Excel o Google Sheets. La columna &quot;Imagen URL&quot; se puede convertir en imágenes con{' '}
            <code>=IMAGE(A1)</code> en Sheets.
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.25)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: '#992d22' }}>Error al generar el export</p>
          <p className="text-xs font-mono" style={{ color: '#C0392B' }}>{error}</p>
        </div>
      )}
    </div>
  )
}

// ── BatchUpdateTab ────────────────────────────────────────────

function BatchUpdateTab({ products }: { products: ProductPickerItem[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [parsed,   setParsed]   = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null)
  const [parseErr, setParseErr] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<{ ok: true; updated: number } | { ok: false; error: string } | null>(null)

  const parseCSV = useCallback((text: string) => {
    setParseErr(null)
    setParsed(null)
    setResult(null)

    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) {
      setParseErr('El archivo debe tener al menos una fila de encabezado y una fila de datos.')
      return
    }

    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.trim())

    if (!headers.includes('codigo_modelo')) {
      setParseErr('El CSV debe tener una columna "codigo_modelo".')
      return
    }

    const rows: ParsedRow[] = lines.slice(1).map(line => {
      const cells = line.split(sep)
      const row: ParsedRow = {}
      headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim() })
      return row
    }).filter(r => r['codigo_modelo'])

    setParsed({ headers, rows })
  }, [])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => parseCSV(e.target?.result as string)
    reader.readAsText(file, 'utf-8')
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleApply() {
    if (!parsed) return
    setLoading(true)
    setResult(null)

    const fields = parsed.headers.filter(h => h !== 'codigo_modelo')

    try {
      const res = await fetch('/api/batch/update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: parsed.rows, fields }),
      })
      const data = await res.json() as { ok: boolean; updated?: number; error?: string }
      if (data.ok) {
        setResult({ ok: true, updated: data.updated ?? 0 })
      } else {
        setResult({ ok: false, error: data.error ?? 'Error desconocido' })
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setLoading(false)
    }
  }

  const extraFields = parsed?.headers.filter(h => h !== 'codigo_modelo') ?? []
  const previewRows = parsed?.rows.slice(0, 5) ?? []

  async function downloadTemplate() {
    const res = await fetch('/api/export/csv-template')
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'plantilla-campos-TQ.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Download template */}
      <div className="tq-card p-6">
        <h2 className="text-sm font-semibold text-tq-snorkel mb-1">1. Descarga la plantilla</h2>
        <p className="text-xs mb-4" style={{ color: '#b2b2b2' }}>
          Descarga un CSV con todos los códigos de modelo. Añade columnas con los nombres de los campos
          que quieras rellenar (ej: <code>campaña_activa</code>, <code>colección</code>, <code>promo_verano</code>).
        </p>

        {/* Example visual */}
        <div
          className="rounded-lg px-4 py-3 mb-4 font-mono text-xs overflow-x-auto"
          style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)', color: '#00557f' }}
        >
          <div className="font-bold mb-1 opacity-50 text-[10px] uppercase tracking-widest">Ejemplo de CSV</div>
          <div className="flex gap-4">
            <span>codigo_modelo</span>
            <span style={{ color: '#C8842A' }}>mi_campo</span>
            <span style={{ color: '#C8842A' }}>otro_campo</span>
          </div>
          <div className="flex gap-4 opacity-60">
            <span>002AA</span>
            <span>valor</span>
            <span>valor2</span>
          </div>
          <div className="flex gap-4 opacity-60">
            <span>003BB</span>
            <span>valor</span>
            <span></span>
          </div>
        </div>

        <button
          onClick={downloadTemplate}
          className="px-5 py-2.5 rounded-lg border text-sm font-semibold text-tq-snorkel transition-colors hover:bg-[rgba(0,85,127,0.04)]"
          style={{ borderColor: 'rgba(0,85,127,0.2)' }}
        >
          Descargar plantilla CSV ({products.length} modelos)
        </button>
      </div>

      {/* Section 2: Upload */}
      <div className="tq-card p-6">
        <h2 className="text-sm font-semibold text-tq-snorkel mb-1">2. Sube el CSV con los valores</h2>
        <p className="text-xs mb-4" style={{ color: '#b2b2b2' }}>
          El archivo debe incluir la columna <code>codigo_modelo</code> más las columnas con los valores a actualizar.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed px-8 py-10 text-center transition-colors"
          style={{
            borderColor: dragging ? '#00557f' : 'rgba(0,85,127,0.2)',
            background:  dragging ? 'rgba(0,85,127,0.04)' : '#fafafa',
          }}
        >
          <div className="text-2xl mb-2">📄</div>
          <p className="text-sm font-medium text-tq-snorkel">
            Arrastra tu CSV aquí, o haz clic para seleccionar
          </p>
          <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>
            Formato CSV con separador coma o punto y coma · UTF-8
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        {parseErr && (
          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.25)' }}
          >
            <p className="text-xs font-semibold" style={{ color: '#992d22' }}>{parseErr}</p>
          </div>
        )}

        {/* Preview */}
        {parsed && (
          <div className="mt-5 space-y-4">
            {/* Summary */}
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)' }}
            >
              <span className="font-medium text-tq-snorkel">
                {parsed.rows.length} modelos
              </span>
              <span className="mx-2 opacity-30">·</span>
              <span className="text-tq-snorkel">
                {extraFields.length} campo{extraFields.length !== 1 ? 's' : ''} a actualizar:
              </span>
              <span className="ml-2 font-mono text-xs" style={{ color: '#C8842A' }}>
                {extraFields.join(', ')}
              </span>
            </div>

            {/* Table preview */}
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'rgba(0,85,127,0.04)' }}>
                    {parsed.headers.map(h => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-bold text-tq-snorkel whitespace-nowrap"
                        style={{ color: h === 'codigo_modelo' ? '#00557f' : '#C8842A' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t"
                      style={{ borderColor: 'rgba(0,85,127,0.06)' }}
                    >
                      {parsed.headers.map(h => (
                        <td key={h} className="px-3 py-2 text-tq-snorkel whitespace-nowrap">
                          {row[h] || <span className="opacity-25">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {parsed.rows.length > 5 && (
                    <tr>
                      <td
                        colSpan={parsed.headers.length}
                        className="px-3 py-2 text-center text-xs"
                        style={{ color: '#b2b2b2' }}
                      >
                        …y {parsed.rows.length - 5} filas más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Apply button */}
            <button
              onClick={handleApply}
              disabled={loading || extraFields.length === 0}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: '#00557f' }}
            >
              {loading ? 'Aplicando…' : `Aplicar actualización (${parsed.rows.length} modelos)`}
            </button>
          </div>
        )}

        {/* Result */}
        {result?.ok && (
          <div
            className="mt-4 rounded-xl px-5 py-4"
            style={{ background: 'rgba(58,158,106,0.07)', border: '1px solid rgba(58,158,106,0.25)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#2d7a54' }}>
              ✓ {result.updated} registros actualizados correctamente
            </p>
          </div>
        )}
        {result && !result.ok && (
          <div
            className="mt-4 rounded-xl px-5 py-4"
            style={{ background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.25)' }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: '#992d22' }}>Error al aplicar</p>
            <p className="text-xs font-mono" style={{ color: '#C0392B' }}>{result.error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ShopifyCsvTab ─────────────────────────────────────────────

const IA_FIELDS = [
  { key: 'title',       label: 'Título de producto',  field: 'shopify_title_ia',       warn: false },
  { key: 'description', label: 'Descripción HTML',     field: 'shopify_description_ia', warn: false },
  { key: 'seo_title',   label: 'Título SEO',           field: 'seo_title_ia',           warn: false },
  { key: 'seo_desc',    label: 'Descripción SEO',      field: 'seo_desc_ia',            warn: false },
  { key: 'tags',        label: 'Tags',                 field: 'tags_ia',                warn: false },
  { key: 'precio',      label: 'Precio de venta',      field: 'precio_sugerido_ia',     warn: true  },
  { key: 'precio',      label: 'Precio tachado',       field: 'precio_tachado_sugerido_ia', warn: true },
] as const

function ShopifyCsvTab({
  metals, familias, abcs,
}: {
  metals: string[]
  familias: string[]
  abcs: string[]
}) {
  const [familia,   setFamilia]   = useState('')
  const [metal,     setMetal]     = useState('')
  const [abc,       setAbc]       = useState('')
  const [soloIa,    setSoloIa]    = useState(true)
  const [campos,    setCampos]    = useState<string[]>(['title', 'description', 'seo_title', 'seo_desc', 'tags'])
  const [count,     setCount]     = useState<number | null>(null)
  const [sinHandle, setSinHandle] = useState(0)
  const [loading,   setLoading]   = useState(false)

  // Fetch count when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (familia) params.set('familia', familia)
    if (metal)   params.set('metal', metal)
    if (abc)     params.set('abc', abc)
    params.set('solo_ia', String(soloIa))

    fetch(`/api/export/shopify-csv/count?${params}`)
      .then(r => r.json())
      .then(d => { setCount(d.count ?? 0); setSinHandle(d.sin_handle ?? 0) })
      .catch(() => {})
  }, [familia, metal, abc, soloIa])

  function toggleCampo(key: string) {
    setCampos(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    )
  }

  async function handleDownload() {
    setLoading(true)
    const params = new URLSearchParams()
    if (familia)       params.set('familia', familia)
    if (metal)         params.set('metal', metal)
    if (abc)           params.set('abc', abc)
    params.set('solo_ia', String(soloIa))
    params.set('campos', Array.from(new Set(campos)).join(','))

    const res = await fetch(`/api/export/shopify-csv?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `shopify-import-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setLoading(false)
  }

  const uniqueFields = IA_FIELDS.filter((f, i, arr) => arr.findIndex(x => x.key === f.key) === i)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="tq-card p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-tq-snorkel mb-1">Shopify CSV — Importación nativa</h2>
          <p className="text-xs" style={{ color: '#b2b2b2' }}>
            Genera un CSV con el formato exacto de Shopify. Solo incluye productos con al menos un campo generado por IA.
          </p>
        </div>

        {/* Filters */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Filtros</p>
          <div className="flex flex-wrap gap-3">
            <select
              value={familia}
              onChange={e => setFamilia(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
              style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
            >
              <option value="">Familia: todas</option>
              {familias.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              value={metal}
              onChange={e => setMetal(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
              style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
            >
              <option value="">Metal: todos</option>
              {metals.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={abc}
              onChange={e => setAbc(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
              style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
            >
              <option value="">ABC: todos</option>
              {abcs.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#00557f' }}>
              <input
                type="checkbox"
                checked={soloIa}
                onChange={e => setSoloIa(e.target.checked)}
                style={{ accentColor: '#00557f' }}
              />
              Solo con contenido IA
            </label>
          </div>
        </div>

        {/* Fields */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Campos a incluir</p>
          <div className="space-y-2">
            {uniqueFields.map(f => (
              <label key={f.key + f.field} className="flex items-center gap-3 text-sm cursor-pointer" style={{ color: '#00557f' }}>
                <input
                  type="checkbox"
                  checked={campos.includes(f.key)}
                  onChange={() => toggleCampo(f.key)}
                  style={{ accentColor: '#00557f' }}
                />
                <span>{f.label}</span>
                <span className="text-[10px] font-mono" style={{ color: '#b2b2b2' }}>{f.field}</span>
                {f.warn && (
                  <span className="text-[10px] font-semibold" style={{ color: '#C8842A' }}>⚠ revisar antes</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Count + warnings */}
        <div className="space-y-2">
          {count !== null && count > 30 && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(200,132,42,0.08)', color: '#a06818' }}>
              ⚠ Estás exportando {count} productos. Por SEO, recomendamos importar en lotes de máximo 30 al día.
            </p>
          )}
          {sinHandle > 0 && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(192,57,43,0.06)', color: '#992d22' }}>
              {sinHandle} producto{sinHandle !== 1 ? 's' : ''} sin Shopify handle serán omitidos del CSV.
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4 pt-1">
          <span className="text-sm font-medium text-tq-snorkel">
            {count === null ? '…' : count} productos con contenido IA listo
          </span>
          <button
            onClick={handleDownload}
            disabled={loading || count === 0}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#C8842A' }}
          >
            {loading ? 'Generando…' : 'Descargar CSV para Shopify ↓'}
          </button>
        </div>
      </div>
    </div>
  )
}
