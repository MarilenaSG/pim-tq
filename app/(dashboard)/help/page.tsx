import { PageHeader } from '@/components/ui'

interface Section {
  id:       string
  title:    string
  icon:     string
  content:  React.ReactNode
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-[#00557f] mt-5 mb-2">{children}</h3>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#1d1d1b] leading-relaxed mb-2">{children}</p>
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="text-sm text-[#1d1d1b] leading-relaxed space-y-1 mb-3 list-none">{children}</ul>
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-2"><span style={{ color: '#C8842A' }}>·</span><span>{children}</span></li>
}
function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'green' | 'amber' | 'red' }) {
  const cfg = {
    blue:  { bg: 'rgba(0,85,127,0.08)',   text: '#00557f' },
    green: { bg: 'rgba(58,158,106,0.1)',  text: '#2d7a54' },
    amber: { bg: 'rgba(200,132,42,0.1)',  text: '#a06818' },
    red:   { bg: 'rgba(192,57,43,0.1)',   text: '#C0392B' },
  }
  const c = cfg[color]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
      {children}
    </span>
  )
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: '#f0ece8', color: '#00557f' }}>{children}</code>
}
function Callout({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(200,132,42,0.06)', border: '1px solid rgba(200,132,42,0.15)' }}>
      <span className="text-lg shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-[#00557f] mb-0.5">{title}</p>
        <div className="text-sm text-[#1d1d1b] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

const SECTIONS: Section[] = [
  {
    id: 'intro', title: '¿Qué es el PIM?', icon: '◈',
    content: (
      <>
        <P>
          El PIM (Product Information Manager) de Te Quiero Joyerías es la <strong>fuente de verdad interna</strong> del equipo de producto.
          Agrega datos de Metabase en un único lugar, permite enriquecer fichas con campos propios y analizar el rendimiento del surtido desde distintas perspectivas.
        </P>
        <Callout icon="ℹ" title="Acceso libre">
          La aplicación es de uso interno y no requiere contraseña. Cualquier persona con la URL puede acceder.
        </Callout>
        <H3>Fuentes de datos</H3>
        <UL>
          <LI><strong>Metabase</strong> — precios, costes, márgenes, stock, ABC de ventas, variantes. Se sincroniza cada día a las 05:00 UTC. Solo lectura.</LI>
          <LI><strong>Campos custom</strong> — información adicional introducida manualmente por el equipo (campañas, colecciones, notas).</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'zonas', title: 'Zonas de trabajo', icon: '◧',
    content: (
      <>
        <P>El PIM está organizado en cuatro zonas pensadas para distintos perfiles del equipo. Puedes cambiar de zona en cualquier momento desde el selector en la barra lateral.</P>
        <UL>
          <LI><strong>Category Management</strong> — analítica avanzada: surtido, precio, ciclo de vida, rentabilidad y stock</LI>
          <LI><strong>Ventas</strong> — sell-out por tienda, campañas, rendimiento de familias</LI>
          <LI><strong>Stock y Compras</strong> — cobertura, rotación, alertas de rotura y exceso</LI>
          <LI><strong>Tiendas</strong> — boletín de novedades y catálogo sin datos financieros</LI>
        </UL>
        <Callout icon="ℹ" title="Zona Tiendas">
          La zona Tiendas nunca muestra costes, márgenes ni ingresos. Está pensada para que el equipo de tienda consulte disponibilidad y novedades.
        </Callout>
      </>
    ),
  },
  {
    id: 'productos', title: 'Productos', icon: '◻',
    content: (
      <>
        <P>La lista de productos muestra los ~440 modelos del catálogo con filtros por metal, familia, categoría, ABC y más.</P>
        <H3>Filtros disponibles</H3>
        <UL>
          <LI>Metal, Familia, Categoría, ABC ventas</LI>
          <LI>Búsqueda por código o descripción</LI>
          <LI>Los filtros se combinan (AND)</LI>
        </UL>
        <H3>Ficha de producto — tabs</H3>
        <UL>
          <LI><strong>Resumen</strong> — KPIs clave, datos del modelo, timestamp de última sync</LI>
          <LI><strong>Variantes</strong> — tabla con todos los SKUs: precios, costes, márgenes, stock, ABC por variante</LI>
          <LI><strong>Imágenes</strong> — galería de imágenes, añadir pegando URL</LI>
          <LI><strong>Campos custom</strong> — campos definidos por el equipo, editables inline</LI>
          <LI><strong>Ventas</strong> — histórico mensual de ingresos y unidades</LI>
          <LI><strong>Notas</strong> — comentarios internos del equipo</LI>
        </UL>
        <Callout icon="⚠" title="Datos de solo lectura">
          Los campos financieros (costes, márgenes, ingresos) provienen de Metabase y no se pueden editar desde el PIM.
        </Callout>
      </>
    ),
  },
  {
    id: 'exportar', title: 'Exportar', icon: '↗',
    content: (
      <>
        <P>Cada zona tiene sus propias opciones de exportación contextualizadas. Desde la sección de exportar puedes generar ficheros con los productos que necesites.</P>
        <H3>Filtros de selección</H3>
        <UL>
          <LI>Multi-selección de metal, familia, categoría, ABC</LI>
          <LI>Picker de productos sueltos — busca y añade modelos individuales</LI>
          <LI>Los filtros y el picker se combinan (unión)</LI>
        </UL>
        <H3>Formatos disponibles</H3>
        <UL>
          <LI><strong>Excel (.xlsx)</strong> — tabla completa con imagen URL, opción de incluir datos financieros</LI>
          <LI><strong>PDF Catálogo</strong> — catálogo visual A4, 4 productos por página. Ideal para presentaciones.</LI>
        </UL>
        <H3>Actualización en lote</H3>
        <P>La pestaña <strong>Actualizar en lote</strong> permite rellenar campos custom para múltiples productos a la vez mediante un CSV:</P>
        <UL>
          <LI>Descarga la plantilla con todos los códigos de modelo</LI>
          <LI>Rellena los campos en Excel y guarda como CSV</LI>
          <LI>Sube el CSV — los campos se guardan automáticamente</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'analitica', title: 'Analítica', icon: '▦',
    content: (
      <>
        <P>El módulo analítico tiene 5 secciones, todas con datos calculados en el servidor sobre el catálogo real.</P>
        <UL>
          <LI><strong>Surtido</strong> — amplitud (modelos/familia), profundidad (variantes/modelo), Pareto de ingresos, distribución ABC</LI>
          <LI><strong>Precio</strong> — precio medio y mediano, distribución por rangos, margen por familia, descuentos</LI>
          <LI><strong>Ciclo de vida</strong> — clasificación Nuevo/Crecimiento/Maduro/Declive, mapa scatter, anomalías</LI>
          <LI><strong>Rentabilidad</strong> — ingresos por familia y metal, scatter ingresos vs margen, top 10 modelos</LI>
          <LI><strong>Stock</strong> — existencias por familia, cobertura en meses, alertas de rotura (ABC-A sin stock) y exceso (+12m)</LI>
        </UL>
        <Callout icon="ℹ" title="Datos financieros en analítica">
          Los gráficos de margen solo muestran porcentajes agregados por familia, nunca costes unitarios. Los costes se calculan en el servidor y no se exponen al navegador.
        </Callout>
      </>
    ),
  },
  {
    id: 'sync', title: 'Sincronización', icon: '↻',
    content: (
      <>
        <P>Los datos se actualizan automáticamente cada día a las <strong>05:00 UTC</strong> (06:00–07:00 hora Canarias).</P>
        <H3>Sync manual</H3>
        <P>Desde <strong>Configuración → Sincronización</strong> puedes lanzar un sync manual en cualquier momento:</P>
        <UL>
          <LI><strong>Metabase</strong> — descarga el CSV y actualiza products + product_variants + imágenes</LI>
          <LI><strong>Ventas mensuales</strong> — importa el histórico mensual de ventas por variante</LI>
          <LI><strong>Reservas activas</strong> — snapshot diario de reservas</LI>
        </UL>
        <H3>Estados posibles</H3>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge color="green">success</Badge>
          <Badge color="red">error</Badge>
        </div>
        <P>El log de sincronización muestra los últimos 20 eventos con timestamp, registros actualizados y mensaje de error si aplica.</P>
      </>
    ),
  },
  {
    id: 'campos', title: 'Campos custom', icon: '≡',
    content: (
      <>
        <P>Los campos custom permiten añadir información propia del equipo a cada producto, sin tocar los datos de Metabase.</P>
        <H3>Editar valores</H3>
        <P>En la ficha de cada producto, tab <strong>Campos custom</strong>, puedes editar los valores inline. Los cambios se guardan al hacer clic en &quot;Guardar&quot;.</P>
        <UL>
          <LI>Tipos disponibles: texto, área de texto, fecha, booleano (sí/no), selección</LI>
          <LI>Cada campo tiene una clave única (<Code>field_key</Code>) que se usa en el CSV de exportación</LI>
        </UL>
        <H3>Rellenar en lote</H3>
        <P>Usa la pestaña <strong>Actualizar en lote</strong> de Exportar para rellenar campos en múltiples productos a la vez con un CSV.</P>
      </>
    ),
  },
  {
    id: 'pricing', title: 'Reglas de precio', icon: '⊞',
    content: (
      <>
        <P>Las reglas de precio definen los parámetros para calcular el PVP óptimo de cada producto.</P>
        <H3>Configurar reglas</H3>
        <P>Desde <strong>Configuración → Reglas de precio</strong> puedes definir reglas por:</P>
        <UL>
          <LI><strong>Familia</strong> — aplica a toda la familia de productos</LI>
          <LI><strong>Familia + Metal</strong> — más específica</LI>
          <LI><strong>Familia + Metal + Quilates</strong> — la más específica, tiene prioridad</LI>
        </UL>
        <H3>Parámetros de cada regla</H3>
        <UL>
          <LI><strong>Margen objetivo %</strong> — margen bruto que debe alcanzar el precio sugerido</LI>
          <LI><strong>Redondeo</strong> — 99 (termina en 99€), 00 (termina en 00€), libre</LI>
          <LI><strong>Descuento mínimo %</strong> — descuento mínimo para que aparezca precio tachado</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'boletin', title: 'Boletín Tiendas', icon: '◫',
    content: (
      <>
        <P>
          La zona Tiendas incluye un boletín automático que clasifica los productos más relevantes de la semana.
          No muestra datos financieros (costes, márgenes, ingresos).
        </P>
        <H3>Categorías del boletín</H3>
        <UL>
          <LI><strong>Campaña</strong> — productos actualmente en campaña activa</LI>
          <LI><strong>Nuevo</strong> — incorporaciones recientes al catálogo</LI>
          <LI><strong>Outlet</strong> — productos con descuento aplicado</LI>
          <LI><strong>Retirar</strong> — modelos descatalogados o sin stock prolongado</LI>
        </UL>
        <UL>
          <LI>Filtros por metal, familia y categoría</LI>
          <LI>Búsqueda por código o descripción</LI>
          <LI>Imagen, precio de venta, stock total y variantes disponibles</LI>
          <LI>Diseño mobile-first, legible en móvil y tablet</LI>
        </UL>
        <Callout icon="ℹ" title="Acceso para tiendas">
          Comparte la URL de la zona Tiendas con el equipo de tiendas. No hay login.
        </Callout>
      </>
    ),
  },
]

export default function HelpPage() {
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Documentación"
        title="Manual de usuario"
        subtitle="Guía de uso del PIM de Te Quiero Joyerías"
      />

      {/* TOC */}
      <nav className="bg-white rounded-xl p-5 mb-8" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#b2b2b2] mb-3">Contenido</p>
        <ol className="space-y-1">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm text-[#00557f] hover:text-[#C8842A] transition-colors"
              >
                <span className="text-[#b2b2b2] text-xs w-4 text-right">{i + 1}.</span>
                <span className="text-[10px] opacity-60">{s.icon}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className="bg-white rounded-xl px-6 py-5"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)', scrollMarginTop: 24 }}
          >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#f0ece8]">
              <span
                className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-white"
                style={{ background: '#00557f' }}
              >
                {i + 1}
              </span>
              <span className="text-[10px]" style={{ color: '#C8842A' }}>{s.icon}</span>
              <h2 className="text-base font-bold text-[#00557f]">{s.title}</h2>
            </div>
            {s.content}
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 px-6 py-4 rounded-xl text-center" style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)' }}>
        <p className="text-xs text-[#b2b2b2]">
          PIM Te Quiero Joyerías · arquitectura multi-zona ·{' '}
          <span className="text-[#00557f]">marilena@joyeriatequiero.com</span>
        </p>
      </div>
    </div>
  )
}
