-- VRM Platform — upgrade incremental para proyectos creados con el esquema anterior.
-- Seguro de ejecutar después del schema anterior: no elimina ni reinicia proveedores, roles,
-- hallazgos, evaluaciones ni registros de auditoría. Ejecutar antes de 03-supabase-api-grants.sql.

begin;

-- Campos añadidos para evaluaciones con respuestas y portal externo firmado.
alter table public.questionnaires
  add column if not exists definition jsonb not null default '{}'::jsonb;

alter table public.assessments
  add column if not exists submitted_at timestamptz,
  add column if not exists score numeric(5,2),
  add column if not exists responses jsonb not null default '{}'::jsonb,
  add column if not exists portal_token_hash text,
  add column if not exists token_expires_at timestamptz;

create unique index if not exists uq_assessment_portal_token_hash
  on public.assessments(portal_token_hash) where portal_token_hash is not null;

-- El esquema anterior creó audit_log_archive con LIKE sin índices;
-- WF-10/Express necesitan una clave única para archivar mediante upsert.
create unique index if not exists uq_audit_log_archive_id
  on public.audit_log_archive(id);


alter table public.vendor_technologies
  add column if not exists created_at timestamptz not null default now();

alter table public.users
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

alter table public.vendor_findings
  add column if not exists updated_at timestamptz not null default now();

-- Tablas añadidas después del esquema inicial.
create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vendor_id uuid references public.vendors(id) on delete set null,
  severity public.finding_severity not null,
  route text not null check (route in ('slack','slack+email')),
  title text not null,
  fingerprint text not null,
  source text,
  source_ref text,
  description text,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','sent','deduped','failed')),
  delivery_meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_alert_notifications_created
  on public.alert_notifications(created_at desc);
create index if not exists idx_alert_notifications_fingerprint
  on public.alert_notifications(fingerprint, created_at desc);

create table if not exists public.workflow_execution_logs (
  id uuid primary key default gen_random_uuid(),
  workflow_code text not null,
  workflow_name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running','success','failed','partial')),
  summary text,
  details jsonb not null default '{}'::jsonb
);

-- Mantener timestamps de modificación en hallazgos antiguos.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_findings_updated_at on public.vendor_findings;
create trigger trg_findings_updated_at before update on public.vendor_findings
for each row execute procedure public.set_updated_at();

-- Normalizar correos de perfiles heredados sin romper user_roles.
-- Si existen dos perfiles con la misma dirección solo diferenciada por mayúsculas,
-- abortar para que un administrador los concilie explícitamente.
do $
begin
  if exists (
    select lower(email)
    from public.users
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'Hay perfiles duplicados por correo ignorando mayúsculas. Concilia public.users/user_roles antes de continuar.';
  end if;
end;
$;

update public.users
set email = lower(email)
where email <> lower(email);

-- Sincronización Auth -> public.users compatible con los UUID históricos.
-- Si ya existe un perfil con ese email, se conserva su ID para no romper user_roles;
-- la API lo enlaza con el usuario Auth por su email verificado.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;
  insert into public.users (id, email, full_name, is_active)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    true
  )
  on conflict (email) do update
    set full_name = coalesce(public.users.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_vrm on auth.users;
create trigger on_auth_user_created_vrm
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Sincronizar cuentas Auth que ya existían antes de instalar el trigger.
insert into public.users (id, email, full_name, is_active)
select
  au.id,
  lower(au.email),
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
  true
from auth.users au
where au.email is not null
on conflict (email) do update
  set full_name = coalesce(public.users.full_name, excluded.full_name);

-- Completar definiciones vacías de cuestionarios estándar creados por el esquema anterior.
update public.questionnaires
set definition = '{
  "sections": [
    {
      "id": "governance",
      "title": "Gobernanza y Políticas de Seguridad",
      "questions": [
        {"id": "q1-1", "text": "¿Cuenta la organización con una certificación SOC 2 Tipo II o ISO 27001 vigente?", "weight": 25},
        {"id": "q1-2", "text": "¿Se revisan las políticas de seguridad al menos anualmente?", "weight": 15}
      ]
    },
    {
      "id": "access",
      "title": "Cifrado y Gestión de Accesos",
      "questions": [
        {"id": "q2-1", "text": "¿Se exige MFA en todos los accesos administrativos?", "weight": 25},
        {"id": "q2-2", "text": "¿Los datos se cifran en tránsito y en reposo?", "weight": 20},
        {"id": "q2-3", "text": "¿Existe rotación automatizada de credenciales y secretos de API?", "weight": 15}
      ]
    }
  ]
}'::jsonb
where name = 'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)'
  and coalesce(definition, '{}'::jsonb) = '{}'::jsonb;

-- Cuestionario estándar para el portal, si todavía no existe.
insert into public.questionnaires (name, version, is_active, definition)
select
  'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)',
  1,
  true,
  '{"sections":[{"id":"governance","title":"Gobernanza y Políticas de Seguridad","questions":[{"id":"q1-1","text":"¿Cuenta la organización con una certificación SOC 2 Tipo II o ISO 27001 vigente?","weight":25},{"id":"q1-2","text":"¿Se revisan las políticas de seguridad al menos anualmente?","weight":15}]},{"id":"access","title":"Cifrado y Gestión de Accesos","questions":[{"id":"q2-1","text":"¿Se exige MFA en todos los accesos administrativos?","weight":25},{"id":"q2-2","text":"¿Los datos se cifran en tránsito y en reposo?","weight":20},{"id":"q2-3","text":"¿Existe rotación automatizada de credenciales y secretos de API?","weight":15}]}]}'::jsonb
where not exists (
  select 1 from public.questionnaires
  where name = 'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)' and version = 1
);

insert into public.roles (code, name) values
  ('admin', 'Administrador'),
  ('risk_analyst', 'Analista de riesgo'),
  ('auditor', 'Auditor')
on conflict (code) do update set name = excluded.name;

-- Cerrar el acceso directo por Data API para roles de navegador.
-- La API Express valida JWT/RBAC y usa service_role; el portal público también pasa por Express.
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_technologies enable row level security;
alter table public.questionnaires enable row level security;
alter table public.assessments enable row level security;
alter table public.vendor_findings enable row level security;
alter table public.monitoring_jobs enable row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log_archive enable row level security;
alter table public.score_history enable row level security;
alter table public.alert_notifications enable row level security;
alter table public.workflow_execution_logs enable row level security;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;

commit;
