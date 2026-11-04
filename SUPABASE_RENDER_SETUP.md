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

El proyecto debe tener ejecutado el esquema inicial `supabase_vrm_initial_schema.sql`. La cuenta de cada usuario debe existir en Supabase Authentication y en `public.users`, con un rol relacionado en `public.user_roles`.

Para el backend, copia el Project URL y la Secret key desde Project Settings / API Keys. No compartas esas credenciales en tickets, capturas o commits.

## 3. n8n y workflows

Importa o actualiza los JSON de `automation/n8n/workflows/` en n8n. Cada workflow WF-00 a WF-10 contiene un webhook manual adicional con una ruta `vrm-manual/wf-XX`. Activa los workflows después de configurar y validar sus credenciales.

Crea/configura en n8n:

1. Credencial PostgreSQL llamada `Postgres VRM`, apuntando a la base PostgreSQL del proyecto Supabase. Usa los datos de conexión que entrega el botón Connect de Supabase. Si el host Direct no es accesible desde el entorno de n8n, utiliza Session Pooler y la cadena/puerto que proporciona Supabase.
2. Credencial de Header Auth llamada `VRM Alerts Webhook Auth`, con el mismo valor que `ALERTS_WEBHOOK_TOKEN` y el nombre de header que el workflow WF-06 espera (`X-Alert-Token`).
3. Configura las credenciales referenciadas por los nodos de NVD, Shodan, Redis y SMTP.
4. Configura en el entorno de n8n `N8N_WEBHOOK_SECRET`, `VRM_BACKEND_URL`, `N8N_BASE_URL` y las demás variables que utilicen los workflows. `N8N_WEBHOOK_SECRET` debe coincidir con el valor de Render y n8n lo envía al backend en `X-N8N-Signature`.

En Render:

- `N8N_BASE_URL`: URL base de tu instancia n8n.
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
6. Solo después de importar, configurar y activar los workflows, prueba un disparador manual de n8n.

## 5. Alcance y limitaciones conocidas

- La API implementa login autenticado, validación de JWT/RBAC, bootstrap de datos, operaciones de proveedores, tecnologías, hallazgos, evaluaciones internas, alertas, scorecards y limpieza.
- Las ejecuciones manuales se envían a n8n mediante webhooks añadidos a los JSON. El estado de aceptación no equivale a que el workflow haya terminado correctamente; el resultado final requiere instrumentar callbacks de cierre de ejecución.
- El cuestionario actual es un flujo interno de la plataforma. El portal público de proveedores con enlaces HMAC verificables y presentación de respuestas sin sesión todavía requiere una implementación específica; no se debe presentar como funcional hasta completar esa parte.
- La conexión de n8n con PostgreSQL, Redis, NVD, Shodan y SMTP depende de credenciales reales configuradas en tu instancia; el repositorio no contiene esas credenciales.
- Antes de producción, ejecuta pruebas funcionales, pruebas de permisos por rol, revisión de seguridad y recuperación de errores con tus servicios reales.
