# Despliegue de VRM Platform en Render + Supabase

Esta versión separa el frontend estático y la API privada. El frontend usa Supabase Auth para iniciar sesión; las operaciones de negocio pasan por Express, que valida el JWT y el rol del usuario antes de consultar PostgreSQL.

## 1. Servicios en Render

Después de integrar esta rama en la rama que utiliza Render, configura dos servicios.

### A. Frontend (Static Site)

Conserva el Static Site que ya tienes. Configuración:

- Build command: `npm install && npm run build`
- Publish directory: `dist`

Variables de entorno del Static Site:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase |
| `VITE_API_BASE_URL` | URL pública del nuevo servicio API, sin barra final |

Las variables `VITE_*` se incorporan durante la compilación. Después de cambiarlas, ejecuta un nuevo deploy.

### B. API (Web Service de Node)

Crea un segundo servicio desde el mismo repositorio:

- Name: `vrm-platform-api`
- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/health`

Variables de entorno de la API:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SECRET_KEY` | Secret key del proyecto Supabase |
| `PORTAL_TOKEN_SECRET` | Secreto aleatorio fuerte para firmar y verificar enlaces HMAC de evaluación |
| `VRM_FRONTEND_URL` | Origen exacto del Static Site, sin barra final |
| `N8N_WEBHOOK_SECRET` | Secreto compartido para verificar callbacks de n8n |
| `N8N_BASE_URL` | URL base de n8n, sin `/webhook/vrm-alerts` |
| `ALERTS_WEBHOOK_TOKEN` | Valor del header configurado para autenticar webhooks de alertas en n8n |
| `N8N_MANUAL_WEBHOOK_BASE_URL` | URL completa hasta `/webhook/vrm-manual` |

Opcionales:

- `STALE_FINDING_DAYS=90`
- `AUDIT_RETENTION_YEARS=5`
- `SCORE_RETENTION_YEARS=2`

No coloques `SUPABASE_SECRET_KEY`, una clave legacy `service_role`, ni la contraseña de PostgreSQL en el Static Site, variables `VITE_*`, código del navegador o repositorio. La clave secreta solo corresponde al Web Service de la API.

En `VRM_FRONTEND_URL` puedes incluir varios orígenes separados por comas si realmente utilizas más de un dominio. Debe coincidir exactamente con el dominio desde el que se abre el frontend.

Una vez creado el Web Service, copia su URL pública y colócala en `VITE_API_BASE_URL` del Static Site. Después vuelve a desplegar el frontend.

## 2. Supabase

Para un proyecto nuevo, ejecuta en este orden `database/01-schema.sql`, `database/02-seed.sql`, `database/04-upgrade-existing-supabase.sql` y finalmente `database/03-supabase-api-grants.sql`. El paso 04 es idempotente y deja preparadas las columnas del portal, sincroniza cuentas Auth existentes, configura el trigger de nuevos usuarios y activa RLS.

**En tu proyecto `vrm-n8n-platform` que ya tenía aplicado el esquema anterior, no vuelvas a ejecutar `database/01-schema.sql` ni borres tablas.** Ejecuta únicamente `database/04-upgrade-existing-supabase.sql` y después `database/03-supabase-api-grants.sql` desde Supabase SQL Editor. La migración 04 amplía las tablas existentes sin eliminar datos, conserva los UUID históricos de `public.users` y mantiene sus relaciones de roles. La API busca el perfil por el ID Auth y, para perfiles históricos, por el correo verificado de Supabase Auth. También activa RLS y revoca el acceso directo a las tablas para `anon` y `authenticated`; el navegador solo accede a Auth y el tráfico de negocio pasa por Express. La migración 03 concede permisos Data API a `service_role`, rol utilizado exclusivamente por la Secret key del backend.

Después de crear la cuenta en Supabase Authentication, comprueba que aparece en `public.users` y asígnale un rol de VRM desde SQL Editor. Sustituye el correo de ejemplo por la dirección real registrada:

```sql
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.roles r on r.code = 'admin'
where lower(u.email) = lower('tu-correo@empresa.com')
on conflict do nothing;
```

Asigna `admin` solo a la cuenta administradora inicial. Para el resto de cuentas utiliza `risk_analyst` o `auditor` según corresponda. Sin un rol en `public.user_roles`, la API rechazará el acceso aunque la autenticación de Supabase sea correcta.

Para el backend, copia el Project URL y la Secret key desde Project Settings / API Keys. La Secret key mapea a `service_role`, omite RLS y solo debe estar en el Web Service privado después de las validaciones de sesión y RBAC. No compartas esas credenciales en tickets, capturas o commits.

## 3. n8n y workflows

Importa o actualiza los JSON de `automation/n8n/workflows/` en n8n. Los workflows WF-01 a WF-10 contienen un webhook manual adicional con una ruta `vrm-manual/wf-XX`. WF-00 se mantiene como manejador global de errores y se ejecuta por evento, no manualmente. WF-05 expira invitaciones que superaron los 30 días y permite generar una nueva evaluación. Activa los workflows después de configurar y validar sus credenciales.

Crea/configura en n8n:

1. Credencial PostgreSQL llamada `Postgres VRM`, apuntando a la base PostgreSQL del proyecto Supabase. Usa los datos de conexión que entrega el botón Connect de Supabase. Si el host Direct no es accesible desde el entorno de n8n, utiliza Session Pooler y la cadena/puerto que proporciona Supabase.
2. Credencial de Header Auth llamada `VRM Alerts Webhook Auth`, con el mismo valor que `ALERTS_WEBHOOK_TOKEN` y el nombre de header que el workflow WF-06 espera (`X-Alert-Token`).
3. Configura las credenciales referenciadas por los nodos de NVD, Shodan, Redis y SMTP. Para WF-05, configura `SMTP VRM` y `SMTP_FROM`; el nodo de invitación solo envía correo cuando el proveedor tiene un email de contacto. El correo se envía después de que la API registre el hash del enlace firmado en Supabase.
4. Configura en el entorno de n8n `N8N_WEBHOOK_SECRET`, `PORTAL_TOKEN_SECRET`, `VRM_PORTAL_URL`, `VRM_BACKEND_URL`, `N8N_BASE_URL`, `SMTP_FROM` y las demás variables que utilicen los workflows. `N8N_WEBHOOK_SECRET` debe coincidir con el valor de Render y n8n lo envía al backend en `X-N8N-Signature`; utiliza un secreto aleatorio de al menos 32 caracteres. `PORTAL_TOKEN_SECRET` debe coincidir exactamente entre n8n y la API de Render y tener al menos 32 caracteres aleatorios. Usa valores distintos para ambos secretos. `VRM_PORTAL_URL` es obligatoria y debe ser la URL pública del frontend terminada en `/portal`; WF-05 se detiene sin generar invitaciones si no está configurada. `VRM_BACKEND_URL` es la URL base del Web Service Express. Como estos workflows utilizan variables y módulos nativos desde los Code nodes, en una instancia n8n autogestionada configura `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` y `NODE_FUNCTION_ALLOW_BUILTIN=crypto,tls,dns`, revisando antes las implicaciones de seguridad de permitir acceso a esas variables.

Variables adicionales usadas por los workflows de n8n:

| Variable | Uso |
|---|---|
| `SLACK_WEBHOOK_URL` | Incoming Webhook del canal de alertas |
| `ALERT_FALLBACK_EMAIL` | Destinatario alternativo si no se encuentran usuarios RBAC |
| `SMTP_FROM` | Dirección remitente usada por los nodos SMTP |
| `NVD_MIN_CVSS` | Umbral CVSS (por defecto 7) |
| `CT_LOOKBACK_DAYS` | Ventana de búsqueda de certificados (por defecto 3 días) |
| `STALE_FINDING_DAYS` | Antigüedad para cierre de hallazgos obsoletos |
| `AUDIT_RETENTION_YEARS` | Retención del log de auditoría |
| `SCORE_RETENTION_YEARS` | Retención del histórico de puntuaciones |
| `VRM_FRONTEND_URL` | Origen público del frontend, usado para enlaces en alertas |
| `VRM_PORTAL_URL` | URL del frontend terminada en `/portal`, usada por WF-05 |

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` y `NODE_FUNCTION_ALLOW_BUILTIN=crypto,tls,dns` son necesarios para que los Code nodes actuales puedan leer variables del entorno y cargar los módulos nativos usados por los workflows. Configúralos solo en una instancia n8n que administres y protege el acceso a su editor y a sus workflows.

En Render:

- `N8N_BASE_URL`: URL base de tu instancia n8n.
- `PORTAL_TOKEN_SECRET`: usa el mismo valor secreto que configuraste en n8n para firmar los enlaces del portal.
- `N8N_MANUAL_WEBHOOK_BASE_URL`: por ejemplo `https://tu-n8n.example.com/webhook/vrm-manual` (sustituye por la URL real).
- `ALERTS_WEBHOOK_TOKEN`: debe coincidir con la credencial Header Auth de n8n.
- `N8N_WEBHOOK_SECRET`: debe coincidir con la variable configurada en n8n.

No inventes los hosts, puertos ni nombres de conexión: copia los datos de Connect en Supabase y de tu propia instancia n8n.

## 4. Primera prueba

1. Abre la URL del frontend.
2. Inicia sesión con una cuenta de Supabase Auth que tenga rol en `public.user_roles`.
3. Revisa la pantalla Salud del Sistema: backend y base de datos deben figurar conectados.
4. Registra un proveedor de prueba y confirma que aparece en `public.vendors`.
5. Comprueba que su score inicial se registra en `public.score_history`.
6. Crea un proveedor de prueba con email de contacto y fecha de evaluación vencida, ejecuta WF-05 desde la pantalla Evaluaciones y confirma que el correo contiene un enlace público `/portal/assessment/...`.
7. Abre el enlace en una ventana privada, responde todas las preguntas y envíalo. Verifica que la evaluación pasa a `completed`, se registra la puntuación y un segundo uso del enlace es rechazado.
8. Comprueba que un usuario `risk_analyst` no puede ejecutar WF-10 y que un usuario `admin` sí puede solicitarlo.
9. Solo después de importar, configurar y activar los demás workflows, prueba sus disparadores manuales.

## 5. Alcance y limitaciones conocidas

- La API implementa login autenticado, validación de JWT/RBAC, bootstrap de datos, operaciones de proveedores, tecnologías, hallazgos, evaluaciones internas, alertas, scorecards y limpieza.
- Las ejecuciones manuales se envían a n8n mediante webhooks añadidos a los JSON. El estado de aceptación no equivale a que el workflow haya terminado correctamente; el resultado final requiere instrumentar callbacks de cierre de ejecución.
- El portal público de proveedores utiliza enlaces HMAC con vencimiento de 30 días y un solo uso. La API valida la firma y el estado del enlace, calcula la puntuación en el servidor y persiste las respuestas en Supabase. La entrega real del correo depende de que el workflow WF-05 y la credencial SMTP estén configurados.
- La conexión de n8n con PostgreSQL, Redis, NVD, Shodan y SMTP depende de credenciales reales configuradas en tu instancia; el repositorio no contiene esas credenciales.
- Antes de producción, ejecuta pruebas funcionales, pruebas de permisos por rol, revisión de seguridad y recuperación de errores con tus servicios reales.
