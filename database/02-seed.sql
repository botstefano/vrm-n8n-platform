-- VRM Platform — datos de configuración iniciales.
-- Ejecutar después de database/01-schema.sql. No crea usuarios ficticios;
-- las cuentas se crean en Supabase Authentication y se sincronizan mediante trigger.

insert into public.roles (code, name) values
  ('admin', 'Administrador'),
  ('risk_analyst', 'Analista de riesgo'),
  ('auditor', 'Auditor')
on conflict (code) do update set name = excluded.name;

insert into public.questionnaires (name, version, is_active, definition)
select 
  'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)',
  1,
  true,
  $$
  {
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
  }
  $::jsonb
where not exists (
  select 1 from public.questionnaires
  where name = 'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)' and version = 1
);
