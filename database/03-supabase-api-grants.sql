-- VRM n8n Platform — habilitar acceso del backend a través del Data API de Supabase
-- Ejecutar después del esquema inicial y de todas las migraciones incrementales en Supabase SQL Editor.
-- Solo service_role recibe privilegios Data API. anon/authenticated no reciben grants.

begin;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Mantener permisos para tablas y secuencias que creen futuras migraciones ejecutadas por postgres.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

commit;
