import type { Zone } from '@/types'

export interface ZoneNavItem {
  label: string
  href:  string
  icon:  string
  badge?: 'alerts'
}

export interface ZoneSection {
  label: string
  items: ZoneNavItem[]
}

export interface ZoneConfig {
  zone:        Zone
  label:       string
  shortLabel:  string
  icon:        string
  color:       string        // accent color for active states
  description: string
  sections:    ZoneSection[]
}

export const ZONES: ZoneConfig[] = [
  {
    zone: 'cm',
    label: 'Category Management',
    shortLabel: 'CM',
    icon: '▦',
    color: '#00557f',
    description: 'Analítica de surtido, precio, ciclo de vida y rentabilidad',
    sections: [
      {
        label: 'Principal',
        items: [
          { label: 'Dashboard',        href: '/',                        icon: '◈' },
          { label: 'Productos',        href: '/products',                icon: '◻' },
        ],
      },
      {
        label: 'Gestión',
        items: [
          { label: 'Campañas',         href: '/campaigns',               icon: '◈' },
          { label: 'Alertas',          href: '/alerts',                  icon: '⚑', badge: 'alerts' },
        ],
      },
      {
        label: 'Analítica',
        items: [
          { label: 'Surtido',          href: '/analytics/surtido',       icon: '▦' },
          { label: 'Precio',           href: '/analytics/precio',        icon: '▤' },
          { label: 'Ciclo de vida',    href: '/analytics/ciclo-vida',    icon: '▣' },
          { label: 'Rentabilidad',     href: '/analytics/rentabilidad',  icon: '▧' },
          { label: 'Stock',            href: '/analytics/stock',         icon: '▥' },
          { label: 'Red de tiendas',   href: '/tiendas',                 icon: '◫' },
        ],
      },
      {
        label: 'Configuración',
        items: [
          { label: 'Reglas de precio', href: '/settings/pricing',        icon: '⊞' },
          { label: 'Ejes de surtido',  href: '/settings/surtido',        icon: '◱' },
          { label: 'Sincronización',   href: '/settings/sync',           icon: '↻' },
          { label: 'Ayuda',            href: '/help',                    icon: '?' },
        ],
      },
    ],
  },
  {
    zone: 'ventas',
    label: 'Ventas',
    shortLabel: 'Ventas',
    icon: '▨',
    color: '#C8842A',
    description: 'Sell-out por tienda y análisis de campañas',
    sections: [
      {
        label: 'Principal',
        items: [
          { label: 'Dashboard',        href: '/ventas',                  icon: '◈' },
          { label: 'Productos',        href: '/products',                icon: '◻' },
        ],
      },
      {
        label: 'Gestión',
        items: [
          { label: 'Campañas',         href: '/campaigns',               icon: '◈' },
          { label: 'Alertas',          href: '/alerts',                  icon: '⚑', badge: 'alerts' },
        ],
      },
      {
        label: 'Analítica',
        items: [
          { label: 'Sell-out tiendas', href: '/ventas/sell-out',         icon: '▨' },
          { label: 'Ventas',           href: '/analytics/ventas',        icon: '▧' },
          { label: 'Red de tiendas',   href: '/tiendas',                 icon: '◫' },
        ],
      },
    ],
  },
  {
    zone: 'stock',
    label: 'Stock y Compras',
    shortLabel: 'Stock',
    icon: '▥',
    color: '#3A9E6A',
    description: 'Cobertura, rotación y alertas de rotura y exceso',
    sections: [
      {
        label: 'Principal',
        items: [
          { label: 'Dashboard',        href: '/stock',                   icon: '◈' },
          { label: 'Productos',        href: '/products',                icon: '◻' },
        ],
      },
      {
        label: 'Gestión',
        items: [
          { label: 'Alertas stock',    href: '/alerts',                  icon: '⚑', badge: 'alerts' },
          { label: 'Proveedores',      href: '/suppliers',               icon: '◇' },
        ],
      },
      {
        label: 'Analítica',
        items: [
          { label: 'Cobertura',        href: '/analytics/stock',         icon: '▥' },
          { label: 'Red de tiendas',   href: '/tiendas',                 icon: '◫' },
        ],
      },
      {
        label: 'Configuración',
        items: [
          { label: 'Sincronización',   href: '/settings/sync',           icon: '↻' },
        ],
      },
    ],
  },
  {
    zone: 'tiendas',
    label: 'Tiendas',
    shortLabel: 'Tiendas',
    icon: '◫',
    color: '#8B5E1A',
    description: 'Boletín de novedades y catálogo para equipos de tienda',
    sections: [
      {
        label: 'Principal',
        items: [
          { label: 'Red de tiendas',   href: '/tiendas',                 icon: '◫' },
          { label: 'Boletín',          href: '/tiendas/boletin',         icon: '◫' },
          { label: 'Catálogo',         href: '/tiendas/catalogo',        icon: '◻' },
          { label: 'Campañas',         href: '/campaigns',               icon: '◈' },
        ],
      },
    ],
  },
]

export const DEFAULT_ZONE: Zone = 'cm'

export function getZone(zone: Zone | null | undefined): ZoneConfig {
  return ZONES.find(z => z.zone === zone) ?? ZONES[0]
}

export function getZoneHome(zone: Zone): string {
  const zc = getZone(zone)
  return zc.sections[0]?.items[0]?.href ?? '/'
}
