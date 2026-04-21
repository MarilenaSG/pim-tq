import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'

function fmtEuro(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}
function fmtPct(n: number | null) {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { items?: string }
}) {
  const raw = searchParams.items ?? ''
  const codes = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 4)

  if (codes.length < 2) {
    return (
      <div className="p-6 max-w-4xl">
        <Link href="/products" className="text-xs font-semibold text-tq-sky hover:underline">← Productos</Link>
        <div className="mt-8 text-center py-20" style={{ color: '#b2b2b2' }}>
          <p className="text-4xl mb-3">◧</p>
          <p className="text-sm font-medium">Selecciona al menos 2 productos para comparar</p>
          <p className="text-xs mt-1">Usa las casillas en la lista de productos y pulsa &ldquo;Comparar&rdquo;.</p>
          <Link href="/products" className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#00557f' }}>
            Ir a productos
          </Link>
        </div>
      </div>
    )
  }

  const supabase = createServerClient()

  const [productsRes, variantsRes, imagesRes, shopifyRes] = await Promise.all([
    supabase.from('products').select('*').in('codigo_modelo', codes),
    supabase.from('product_variants').select('*').in('codigo_modelo', codes),
    supabase.from('product_images').select('codigo_modelo, url').in('codigo_modelo', codes).eq('is_primary', true),
    supabase.from('product_shopify_data').select('codigo_modelo, shopify_status, shopify_vendor').in('codigo_modelo', codes),
  ])

  const products = (productsRes.data ?? [])
  const variants = (variantsRes.data ?? [])
  const imageMap = Object.fromEntries((imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url]))
  const shopifyMap = Object.fromEntries((shopifyRes.data ?? []).map(r => [r.codigo_modelo, r]))

  // Order by codes param order
  const ordered = codes.map(c => products.find(p => p.codigo_modelo === c)).filter(Boolean) as typeof products

  // Get leader variant per model
  function leader(codigo: string) {
    return variants.find(v => v.codigo_modelo === codigo && v.es_variante_lider) ?? variants.find(v => v.codigo_modelo === codigo)
  }

  const ROWS: { label: string; render: (p: typeof ordered[number]) => React.ReactNode }[] = [
    { label: 'Familia',       render: p => p.familia ?? '—' },
    { label: 'Metal',         render: p => p.metal ?? '—' },
    { label: 'Quilates',      render: p => p.karat ?? '—' },
    { label: 'Categoría',     render: p => p.category ?? '—' },
    { label: 'Proveedor',     render: p => p.supplier_name ?? '—' },
    { label: 'Shopify',       render: p => shopifyMap[p.codigo_modelo]?.shopify_status ?? '—' },
    { label: 'Marca',         render: p => shopifyMap[p.codigo_modelo]?.shopify_vendor ?? '—' },
    { label: 'ABC ventas',    render: p => {
      const abc = p.abc_ventas
      if (!abc) return <span style={{ color: '#d0cdc9' }}>—</span>
      const color = abc === 'A' ? '#3A9E6A' : abc === 'B' ? '#0099f2' : '#C8842A'
      return <span className="font-bold" style={{ color }}>{abc}</span>
    }},
    { label: 'Ingresos 12m',  render: p => <span className="font-mono">{fmtEuro(p.ingresos_12m)}</span> },
    { label: 'Precio venta',  render: p => <span className="font-mono">{fmtEuro(leader(p.codigo_modelo)?.precio_venta ?? null)}</span> },
    { label: 'Precio tachado', render: p => <span className="font-mono">{fmtEuro(leader(p.codigo_modelo)?.precio_tachado ?? null)}</span> },
    { label: 'Descuento',     render: p => fmtPct(leader(p.codigo_modelo)?.descuento_aplicado ?? null) },
    { label: '% Margen',      render: p => {
      const m = leader(p.codigo_modelo)?.pct_margen_bruto ?? null
      if (m == null) return '—'
      return <span className="font-bold" style={{ color: m >= 40 ? '#3A9E6A' : '#C8842A' }}>{fmtPct(m)}</span>
    }},
    { label: 'Stock total',   render: p => {
      const total = variants.filter(v => v.codigo_modelo === p.codigo_modelo).reduce((s, v) => s + (v.stock_variante ?? 0), 0)
      return <span className={total === 0 ? '' : 'font-bold text-tq-snorkel'} style={total === 0 ? { color: '#C0392B' } : undefined}>{total}</span>
    }},
    { label: 'Variantes',     render: p => p.num_variantes ?? '—' },
    { label: '1ª entrada',    render: p => p.primera_entrada ? new Date(p.primera_entrada).toLocaleDateString('es-ES') : '—' },
  ]

  return (
    <div className="p-6 max-w-[1300px]">
      <div className="mb-5">
        <Link href="/products" className="text-xs font-semibold text-tq-sky hover:underline">← Productos</Link>
        <h1 className="text-2xl font-bold text-tq-snorkel mt-2">Comparar productos</h1>
        <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>{ordered.length} modelos seleccionados</p>
      </div>

      <div className="bg-white rounded-xl overflow-x-auto" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
              <th className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase w-32" style={{ color: '#b2b2b2' }}>Campo</th>
              {ordered.map(p => (
                <th key={p.codigo_modelo} className="px-4 py-3 text-left w-52">
                  {/* Product header */}
                  <div className="flex items-center gap-2 mb-1">
                    {imageMap[p.codigo_modelo] ? (
                      <img src={imageMap[p.codigo_modelo]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ background: '#f5f3f0' }} />
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-lg" style={{ background: 'rgba(0,85,127,0.06)', color: '#d0cdc9' }}>◫</div>
                    )}
                    <div>
                      <Link href={`/products/${p.codigo_modelo}`} className="font-mono text-xs font-bold text-tq-sky hover:underline block">
                        {p.codigo_modelo}
                      </Link>
                      <p className="text-[10px] leading-tight mt-0.5 line-clamp-2 font-normal" style={{ color: '#00557f' }}>{p.description}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} style={{ borderBottom: i < ROWS.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none', background: i % 2 === 1 ? 'rgba(0,85,127,0.015)' : 'white' }}>
                <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#b2b2b2' }}>{row.label}</td>
                {ordered.map(p => (
                  <td key={p.codigo_modelo} className="px-4 py-2.5 text-sm text-tq-snorkel">{row.render(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
