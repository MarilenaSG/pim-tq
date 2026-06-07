-- Migración 022: OPEX y payback en lanzamientos
-- presupuesto_marketing → inversión en campaña (€ fijo)
-- opex_personal_pct    → % de ventas netas destinado a personal (default 20%)
-- opex_gastos_pct      → % de ventas netas destinado a gastos operativos (default 12%)
-- output_ebitda_pct    → EBITDA % resultante del escenario Base (calculado al confirmar)
-- output_payback_meses → meses estimados para recuperar la inversión total (calculado al confirmar)

alter table lanzamientos
  add column if not exists presupuesto_marketing numeric,
  add column if not exists opex_personal_pct     numeric default 20,
  add column if not exists opex_gastos_pct       numeric default 12,
  add column if not exists output_ebitda_pct     numeric,
  add column if not exists output_payback_meses  numeric;
