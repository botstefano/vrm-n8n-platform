-- VRM Platform — esquema mínimo requerido por los workflows de n8n (PostgreSQL 14+)
-- Si ya tienes un backend con estas tablas, usa solo la sección "Índices y restricciones".
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Tipos ----------
DO $$ BEGIN CREATE TYPE vendor_status AS ENUM
  ('onboarding','approved','conditional','monitoring','incident','reevaluation','suspended','offboarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE risk_level AS ENUM ('critical','high','medium','low','minimal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE finding_severity AS ENUM ('critical','high','medium','low','info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE finding_status AS ENUM ('open','in_progress','accepted','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Tablas ----------
CREATE TABLE IF NOT EXISTS vendors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name       text NOT NULL,
  website          text,
  status           vendor_status NOT NULL DEFAULT 'onboarding',
  criticality      smallint NOT NULL DEFAULT 3 CHECK (criticality BETWEEN 1 AND 5),
  current_risk     risk_level,
  current_score    numeric(5,2),
  next_evaluation  timestamptz,
  primary_contact  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Tecnologías del proveedor (para WF-01). cpe_match = CPE 2.3 (admite comodines), p. ej.
-- cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*
CREATE TABLE IF NOT EXISTS vendor_technologies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_name  text,
  cpe_match     text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS questionnaires (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  version    integer NOT NULL DEFAULT 1,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  questionnaire_id  uuid NOT NULL REFERENCES questionnaires(id),
  status            text NOT NULL DEFAULT 'pending',   -- pending | in_progress | completed | expired
  started_at        timestamptz,
  completed_at      timestamptz
);

CREATE TABLE IF NOT EXISTS vendor_findings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  source       text NOT NULL,                 -- nvd | ct_log | tls_expiry | shodan | ...
  source_ref   text NOT NULL,                 -- identificador estable dentro de la fuente (idempotencia)
  title        text NOT NULL,
  description  text,
  severity     finding_severity NOT NULL,
  status       finding_status NOT NULL DEFAULT 'open',
  evidence     jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution   text,                          -- p. ej. auto_closed_stale (WF-10)
  detected_at  timestamptz NOT NULL DEFAULT now(),
  due_date     timestamptz,
  closed_at    timestamptz
);

CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id           bigserial PRIMARY KEY,
  vendor_id    uuid REFERENCES vendors(id) ON DELETE CASCADE,   -- NULL = job global
  job_type     text NOT NULL,
  last_run     timestamptz,
  next_run     timestamptz,
  status       text,
  result_meta  jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  full_name  text,
  is_active  boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS roles (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code  text NOT NULL UNIQUE,
  name  text
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id  uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor       text,
  action      text NOT NULL,
  entity      text,
  entity_id   text,
  details     jsonb
);
-- Misma estructura que audit_log (sin defaults) — destino del archivado de WF-10
CREATE TABLE IF NOT EXISTS audit_log_archive (LIKE audit_log);

CREATE TABLE IF NOT EXISTS score_history (
  id             bigserial PRIMARY KEY,
  vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  score          numeric(5,2),
  risk           risk_level,
  calculated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Índices y restricciones (idempotencia y rendimiento) ----------
DO $$ BEGIN
  ALTER TABLE vendor_findings ADD CONSTRAINT uq_finding_source UNIQUE (vendor_id, source, source_ref);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Un único registro por job global (permite el UPSERT de "Log Run")
CREATE UNIQUE INDEX IF NOT EXISTS uq_monitoring_jobs_global ON monitoring_jobs (job_type) WHERE vendor_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_type ON monitoring_jobs (job_type, last_run);
CREATE INDEX IF NOT EXISTS idx_vendors_next_eval_active ON vendors (next_evaluation)
  WHERE status IN ('approved','conditional','monitoring');
CREATE INDEX IF NOT EXISTS idx_findings_open_due ON vendor_findings (due_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_findings_vendor ON vendor_findings (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_assessments_vendor_status ON assessments (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_score_history_calc ON score_history (calculated_at);
