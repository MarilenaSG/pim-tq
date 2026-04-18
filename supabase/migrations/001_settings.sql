-- ============================================================
-- Migración 001: tabla settings (tokens y configuración)
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists settings (
  key        text        primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Solo el service role puede leer/escribir (anon no tiene acceso)
alter table settings enable row level security;
-- Sin políticas para anon → acceso denegado por defecto
-- El service role bypasses RLS: puede leer y escribir libremente

-- Trigger updated_at
do $$ begin
  create trigger set_settings_updated_at before update on settings
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;
