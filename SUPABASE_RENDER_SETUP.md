# Despliegue de VRM Platform en Render + Supabase

Esta versión separa el frontend estático y la API privada. El frontend usa Supabase Auth para iniciar sesión; las operaciones de negocio pasan por Express, que valida el JWT y el rol del usuario antes de consultar PostgreSQL.

El pipeline CI compila el frontend, comprueba la sintaxis de Express y valida los 11 workflows n8n. La instalación de dependencias en CI utiliza `npm ci`, por lo que comprueba que `package-lock.json` esté sincronizado sin otorgar permisos de escritura al workflow.

## 1. Servicios en Render

Después de integrar esta rama en la rama que utiliza Render, configura dos servicios.

### A. Frontend (Static Site)

Conserva el Static Site que ya tienes. Configuración:

- Build command: `npm ci && npm run build`
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
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/health`

Variables de entorno de la API:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SECRET_KEY` | Secret key del proyecto Supabase |
| `PORTAL_TOKEN_SECRET` | Secreto aleatorio fuerte para firmar y verificar enlaces HMAC de evaluación |
| `VRM_FRONTEND_URL` | Origen exacto del Static Site, sin barra final |
| `N8N_WEBHOOK_SECRET` | Secreto compartido para autenticar callbacks de n8n |
| `N8N_BASE_URL` | URL base de n8n, sin `/webhook/vrm-alerts` |
| `ALERTS_WEBHOOK_TOKEN` | Valor del header configurado para autenticar webhooks de alertas en n8n |
| `N8N_MANUAL_WEBHOOK_BASE_URL` | URL completa hasta `/webhook/vrm-manual` |
| `SLACK_WEBHOOK_URL` | Incoming Webhook HTTPS del canal de alertas; solo en el backend |

Opcionales:

- `STALE_FINDING_DAYS=90`
- `AUDIT_RETENTION_YEARS=5`
- `SCORE_RETENTION_YEARS=2`

No coloques `SUPABASE_SECRET_KEY`, una clave legacy `service_role`, ni la contraseña de PostgreSQL en el Static Site, variables `VITE_*`, código del navegador o repositorio. La clave secreta solo corresponde al Web Service de la API.

En `VRM_FRONTEND_URL` puedes incluir varios orígenes separados por comas si realmente utilizas más de un dominio. Debe coincidir exactamente con el dominio desde el que se abre el frontend.

Una vez creado el Web Service, copia su URL pública y colócala en `VITE_API_BASE_URL` del Static Site. Después vuelve a desplegar el frontend.

## 2. Supabase

Para un proyecto nuevo, ejecuta en este orden `database/01-schema.sql`, `database/02-seed.sql`, `database/04-upgrade-existing-supabase.sql` y finalmente `database/03-supabase-api-grants.sql`. El paso 04 es idempotente y deja preparadas las columnas del portal, sincroniza cuentas Auth existentes, configura el trigger de nuevos usuarios y activa RLS.

**En tu proyecto `vrm-n8n-platform` que ya tenía aplicado el esquema anterior, no vuelvas a ejecutar `database/01-schema.sql` ni borres tablas.** Ejecuta únicamente `database/04-upgrade-existing-supabase.sql` y después `database/03-supabase-api-grants.sql` desde Supabase SQL Editor. La migración 04 amplía las tablas existentes sin eliminar datos, conserva los UUID históricos de `public.users` y mantiene sus relaciones de roles. Normaliza correos heredados a minúsculas; si encuentra perfiles duplicados que solo difieren por mayúsculas, se detiene antes de modificar datos para evitar mezclar cuentas. La API busca el perfil por el ID Auth y, para perfiles históricos, por el correo verificado de Supabase Auth. También activa RLS y revoca el acceso directo a las tablas para `anon` y `authenticated`; el navegador solo accede a Auth y el tráfico de negocio pasa por Express. La migración 03 concede permisos Data API a `service_role`, rol utilizado exclusivamente por la Secret key del backend.

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

## 3. n8n Cloud y workflows

La rama incorpora workflows compatibles con n8n Cloud. Importa o actualiza los 11 JSON de `automation/n8n/workflows/` después de integrar esta rama. WF-00 funciona por evento; WF-01 a WF-10 tienen además un webhook manual autenticado `vrm-manual/wf-XX`.

**Importante:** los JSON se exportan con `active: false`. No se ejecutan por el simple hecho de importarlos. Primero configura variables y credenciales, prueba los disparadores manuales y después activa los workflows que correspondan.

### Credenciales que debes crear o seleccionar en n8n

1. **Postgres VRM** — credencial PostgreSQL que apunte a la base Supabase. Usa los datos de Connect de Supabase. Si n8n Cloud no alcanza el host Direct, utiliza Session Pooler y el host/puerto proporcionados por Supabase.
2. **VRM Alerts Webhook Auth** — tipo Header Auth; nombre del header `X-Alert-Token`; valor idéntico a `ALERTS_WEBHOOK_TOKEN` configurado en Render. Así se protegen los webhooks entrantes y los disparadores manuales.
3. **VRM Backend Callback Auth** — tipo Header Auth; nombre del header `X-N8N-Signature`; valor idéntico a `N8N_WEBHOOK_SECRET` configurado en Render. Así se autentican los callbacks y las llamadas internas a la API.
4. **NVD API** — credencial de API Key requerida por el nodo NVD.
5. **Shodan API** — credencial HTTP Query Auth con el parámetro `key` y tu API key de Shodan.
6. **SMTP VRM** — servidor SMTP y remitente para invitaciones y resúmenes.

Al importar, revisa los nodos HTTP Request y selecciona la credencial indicada en cada uno si n8n no la vinculó automáticamente. No escribas los secretos directamente en parámetros, expresiones, Code nodes ni archivos JSON.

**Redis ya no es necesario.** La deduplicación de alertas ahora se centraliza en `alert_notifications` de PostgreSQL, evitando tener dos mecanismos independientes.

### Variables personalizadas no sensibles

En la pestaña **Variables** de n8n, crea estas variables globales (o con alcance al proyecto donde estén los workflows):

| Key | Valor |
|---|---|
| `VRM_BACKEND_URL` | URL de `vrm-platform-api` en Render, sin barra final |
| `VRM_FRONTEND_URL` | URL pública del frontend, sin barra final |
| `NVD_MIN_CVSS` | `7` |
| `CT_LOOKBACK_DAYS` | `3` |
| `WORKFLOW_STALE_HOURS` | `12` |
| `STALE_FINDING_DAYS` | `90` |
| `AUDIT_RETENTION_YEARS` | `5` |
| `SCORE_RETENTION_YEARS` | `2` |
| `ALERT_FALLBACK_EMAIL` | Correo alternativo para alertas críticas/altas si no hay destinatarios RBAC |
| `SMTP_FROM` | Remitente configurado en tu SMTP |

El código usa la sintaxis `$vars.NOMBRE`. Las variables personalizadas son para configuración no sensible; los tokens y las claves de servicios deben estar en Credentials o en Render.

No crees en n8n Variables `N8N_WEBHOOK_SECRET`, `ALERTS_WEBHOOK_TOKEN`, `PORTAL_TOKEN_SECRET`, `SLACK_WEBHOOK_URL` ni la clave de Shodan.

### Qué ejecuta cada entorno

- **WF-03 TLS:** n8n solicita `POST /api/v1/webhooks/n8n/tls-scan`. La API de Render realiza la resolución DNS y la negociación TLS sobre una IP pública ya validada; n8n recibe los resultados y conserva la responsabilidad de persistir los hallazgos y el estado del job.
- **WF-04 Shodan:** la API de Render valida la resolución DNS mediante `POST /api/v1/webhooks/n8n/resolve-host`. n8n consulta Shodan usando la credencial `Shodan API` y procesa los banners/puertos.
- **WF-05 Reevaluaciones:** la API firma el enlace HMAC y registra su hash mediante `POST /api/v1/webhooks/n8n/assessment-link`. `PORTAL_TOKEN_SECRET` permanece exclusivamente en Render.
- **WF-06 Alertas:** Slack se envía mediante `POST /api/v1/webhooks/n8n/slack-delivery`; la URL secreta del Incoming Webhook permanece en Render. El correo sigue usando `SMTP VRM`.
- **WF-00 y WF-01 a WF-04, WF-07 y WF-08:** solicitan el despacho de alertas mediante `POST /api/v1/webhooks/n8n/alert-request`. La API registra y deduplica la notificación y luego invoca WF-06.

El backend mantiene `N8N_BASE_URL`, `ALERTS_WEBHOOK_TOKEN`, `N8N_WEBHOOK_SECRET` y `SLACK_WEBHOOK_URL) como variables privadas de Render. La clave HMAC del portal `PORTAL_TOKEN_SECRET` también permanece solo en Render. No se requiere habilitar acceso a variables de entorno ni módulos Node.js en Code nodes de n8n Cloud.

WF-01 mantiene paginación NVD de hasta 2.000 resultados por página, máximo 50 páginas por tecnología e intervalo de 6 segundos entre peticiones. Si el límite no permite recuperar todos los resultados, el job debe quedar como `partial`.

## 4. Primera prueba

1. Abre la URL del frontend.
2. Inicia sesión con una cuenta de Supabase Auth que tenga rol en `public.user_roles`.
3. Revisa la pantalla Salud del Sistema: backend y base de datos deben figurar conectados.
4. Registra un proveedor de prueba y confirma que aparece en `public.vendors`.
5. Comprueba que su score inicial se registra en `public.score_history`.
6. Crea un proveedor de prueba con email de contacto y fecha de evaluación vencida, ejecuta WF-05 desde la pantalla Evaluaciones y confirma que el correo contiene un enlace público `/portal/assessment/...`.
7. Abre el enlace en una ventana privada, responde todas las preguntas y envíalo. Verifica que la evaluación pasa a `completed`, se registra la puntuación y un segundo uso del enlace es rechazado.
8. Comprueba que un usuario `risk_analyst` no puede ejecutar WF-10 y que un usuario `admin` sí puede solicitarlo.
9. Ejecuta WF-06 desde el formulario de prueba del Centro de Alertas y confirma que la fila correspondiente aparece en `public.alert_notifications` con su estado de entrega. Los hallazgos críticos/altos generados por WF-01 a WF-04 deben aparecer en el Centro de Alertas; el callback autenticado a la API registra el hallazgo y solicita el despacho centralizado. La ejecución manual de WF-06 envía un mensaje informativo de prueba a Slack.
10. Solo después de importar, configurar y activar los demás workflows, prueba sus disparadores manuales.

## 5. Alcance y limitaciones conocidas

- La API implementa login autenticado, validación de JWT/RBAC, bootstrap de datos, operaciones de proveedores, tecnologías, hallazgos, evaluaciones internas, alertas, scorecards y limpieza.
- WF-08 marca como fallidas las ejecuciones manuales que sigan en `running` sin callback durante `WORKFLOW_STALE_HOURS` (12 horas por defecto), evitando que queden abiertas indefinidamente.
- Las ejecuciones manuales se envían a n8n mediante webhooks autenticados. Los workflows WF-01 a WF-10 notifican al backend su resultado final (`success`, `partial` o `failed`) mediante un callback autenticado con secreto compartido y el panel actualiza el historial mientras existan ejecuciones en curso. Si una ejecución termina abruptamente antes de alcanzar su callback, puede permanecer como `running`; revisa WF-00 y los registros de ejecución de n8n para diagnosticar ese caso.
- El portal público de proveedores utiliza enlaces HMAC con vencimiento de 30 días y un solo uso. La API valida la firma y el estado del enlace, calcula la puntuación en el servidor y persiste las respuestas en Supabase. La entrega real del correo depende de que el workflow WF-05 y la credencial SMTP estén configurados.
- WF-03 comprueba la vigencia de certificados X.509 y detecta expiraciones próximas desde la API; no realiza todavía una auditoría de suites de cifrado TLS.
- La conexión de n8n con PostgreSQL, NVD, Shodan y SMTP depende de credenciales reales configuradas en tu instancia; el repositorio no contiene esas credenciales. Slack se entrega mediante la URL privada configurada en Render. WF-06 informa a la API si la entrega fue `sent`, `deduped` o `failed`, y las alertas originadas directamente por escáneres se guardan en `alert_notifications`. En alertas críticas/altas, configura `ALERT_FALLBACK_EMAIL` para evitar que la ausencia de usuarios activos con rol RBAC impida el envío SMTP.
- Antes de producción, ejecuta pruebas funcionales, pruebas de permisos por rol, revisión de seguridad y recuperación de errores con tus servicios reales.
