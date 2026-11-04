-- VRM n8n Platform - Supabase PostgreSQL bootstrap
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.
-- Modelo conservador: las tablas de negocio tienen RLS habilitado y no exponen
-- acceso directo al navegador. La API Express validará JWT/RBAC y usará una
-- credencial de servidor; n8n se conectará a PostgreSQL con sus propias credenciales.

begin;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos de dominio
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.vendor_status as enum
    ('onboarding','approved','conditional','monitoring','incident','reevaluation','suspended','offboarded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.risk_level as enum ('critical','high','medium','low','minimal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.finding_severity as enum ('critical','high','medium','low','info');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.finding_status as enum ('open','in_progress','accepted','closed');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Usuarios y RBAC ligados a Supabase Auth
-- public.users conserva el nombre esperado por los workflows de n8n.
-- Los registros se crean al registrar un usuario en Supabase Auth.
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_vrm on auth.users;
create trigger on_auth_user_created_vrm
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Inventario de terceros
-- -----------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  website text,
  status public.vendor_status not null default 'onboarding',
  criticality smallint not null default 3 check (criticality between 1 and 5),
  current_risk public.risk_level,
  current_score numeric(5,2) check (current_score between 0 and 100),
  next_evaluation timestamptz,
  primary_contact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_technologies (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_name text,
  cpe_match text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Cuestionarios y evaluaciones.
-- definition conserva las preguntas; responses y score guardan las respuestas.
-- -----------------------------------------------------------------------------
create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires(id),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','expired')),
  started_at timestamptz,
  completed_at timestamptz,
  submitted_at timestamptz,
  score numeric(5,2) check (score between 0 and 100),
  responses jsonb not null default '{}'::jsonb,
  portal_token_hash text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_assessment_portal_token_hash
  on public.assessments(portal_token_hash) where portal_token_hash is not null;

-- -----------------------------------------------------------------------------
-- Hallazgos
-- -----------------------------------------------------------------------------
create table if not exists public.vendor_findings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  source text not null,
  source_ref text not null,
  title text not null,
  description text,
  severity public.finding_severity not null,
  status public.finding_status not null default 'open',
  evidence jsonb not null default '{}'::jsonb,
  resolution text,
  detected_at timestamptz not null default now(),
  due_date timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_finding_source
  on public.vendor_findings(vendor_id, source, source_ref);

-- -----------------------------------------------------------------------------
-- Monitorización, scorecards, auditoría, alertas y ejecuciones
-- -----------------------------------------------------------------------------
create table if not exists public.monitoring_jobs (
  id bigserial primary key,
  vendor_id uuid references public.vendors(id) on delete cascade,
  job_type text not null,
  last_run timestamptz,
  next_run timestamptz,
  status text,
  result_meta jsonb not null default '{}'::jsonb
);

create unique index if not exists uq_monitoring_jobs_global
  on public.monitoring_jobs(job_type) where vendor_id is null;
create index if not exists idx_monitoring_jobs_type on public.monitoring_jobs(job_type, last_run);

create table if not exists public.audit_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.audit_log_archive (
  id bigint primary key,
  created_at timestamptz not null,
  actor text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb
);

create table if not exists public.score_history (
  id bigserial primary key,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  score numeric(5,2) check (score between 0 and 100),
  risk public.risk_level,
  calculated_at timestamptz not null default now()
);

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
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','deduped','failed')),
  delivery_meta jsonb not null default '{}'::jsonb
);
create index if not exists idx_alert_notifications_created on public.alert_notifications(created_at desc);
create index if not exists idx_alert_notifications_fingerprint on public.alert_notifications(fingerprint, created_at desc);

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

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
create index if not exists idx_vendors_next_eval_active
  on public.vendors(next_evaluation)
  where status in ('approved','conditional','monitoring');
create index if not exists idx_technologies_vendor_active
  on public.vendor_technologies(vendor_id, is_active);
create index if not exists idx_findings_open_due
  on public.vendor_findings(due_date) where status = 'open';
create index if not exists idx_findings_vendor_status
  on public.vendor_findings(vendor_id, status);
create index if not exists idx_assessments_vendor_status
  on public.assessments(vendor_id, status);
create index if not exists idx_audit_log_created
  on public.audit_log(created_at);
create index if not exists idx_score_history_calc
  on public.score_history(calculated_at);

-- Mantener updated_at en tablas principales.
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

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at before update on public.vendors
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_findings_updated_at on public.vendor_findings;
create trigger trg_findings_updated_at before update on public.vendor_findings
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Seguridad: RLS activado en todas las tablas de negocio.
-- No se crean políticas para anon/authenticated: el acceso de negocio pasa por
-- Express tras validar JWT y RBAC. n8n/servidor usan credenciales privadas.
-- -----------------------------------------------------------------------------
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

-- Roles funcionales iniciales.
insert into public.roles (code, name) values
  ('admin', 'Administrador'),
  ('risk_analyst', 'Analista de riesgo'),
  ('auditor', 'Auditor')
on conflict (code) do update set name = excluded.name;

commit;
