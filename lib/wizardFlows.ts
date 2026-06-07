// ── Configuración de flujos del wizard por tipo de lanzamiento ──
// Cada tipo tiene su propio array de pasos. El router y el stepper
// leen este config para saber qué mostrar en cada URL /paso/[step].

export type WizardStepKey =
  | 'tipo'
  | 'datos'               // SKU: producto
  | 'distribucion'        // shared: clusters + unidades
  | 'referencia'          // SKU: análogo histórico
  | 'curva'               // SKU: parámetros de demanda
  | 'campana'             // SKU + Drop: campaña/promo
  | 'simulador'           // SKU + Drop: 3 escenarios
  | 'proyeccion'          // Marca: alias de simulador para el flujo marca
  | 'marca_drop'          // Drop: marca existente + fecha
  | 'familias_drop'       // Drop: familias + cantidades
  | 'identidad_marca'     // Marca: nombre + posicionamiento
  | 'familias_marca'      // Marca: familias de la marca
  | 'arquitectura_precios'// Marca: precio min/med/max por familia
  | 'presupuesto'         // Drop + Marca: marketing + OPEX consolidado

export interface WizardStepDef {
  step:  number
  key:   WizardStepKey
  label: string
}

export const WIZARD_FLOWS: Record<string, WizardStepDef[]> = {
  sku: [
    { step: 1, key: 'tipo',         label: 'Tipo'         },
    { step: 2, key: 'datos',        label: 'Producto'     },
    { step: 3, key: 'distribucion', label: 'Distribución' },
    { step: 4, key: 'referencia',   label: 'Referencia'   },
    { step: 5, key: 'curva',        label: 'Demanda'      },
    { step: 6, key: 'campana',      label: 'Promoción'    },
    { step: 7, key: 'simulador',    label: 'Simulador'    },
  ],
  drop: [
    { step: 1, key: 'tipo',          label: 'Tipo'         },
    { step: 2, key: 'marca_drop',    label: 'Marca'        },
    { step: 3, key: 'familias_drop', label: 'Familias'     },
    { step: 4, key: 'distribucion',  label: 'Distribución' },
    { step: 5, key: 'campana',       label: 'Campaña'      },
    { step: 6, key: 'presupuesto',   label: 'Presupuesto'  },
    { step: 7, key: 'simulador',     label: 'Simulador'    },
  ],
  marca: [
    { step: 1, key: 'tipo',                  label: 'Tipo'         },
    { step: 2, key: 'identidad_marca',       label: 'Identidad'    },
    { step: 3, key: 'familias_marca',        label: 'Familias'     },
    { step: 4, key: 'arquitectura_precios',  label: 'Precios'      },
    { step: 5, key: 'distribucion',          label: 'Distribución' },
    { step: 6, key: 'presupuesto',           label: 'Presupuesto'  },
    { step: 7, key: 'proyeccion',            label: 'Proyección'   },
  ],
}

/** Devuelve el flujo del tipo dado, con fallback a SKU si no se reconoce */
export function getFlow(tipo: string | null | undefined): WizardStepDef[] {
  return WIZARD_FLOWS[tipo ?? 'sku'] ?? WIZARD_FLOWS.sku
}

/** Número total de pasos del flujo */
export function totalSteps(tipo: string | null | undefined): number {
  return getFlow(tipo).length
}

/** Clave del paso actual (ej: 'distribucion') */
export function stepKey(tipo: string | null | undefined, step: number): WizardStepKey | null {
  return getFlow(tipo).find(s => s.step === step)?.key ?? null
}
