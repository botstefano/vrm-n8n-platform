# VRM Automation Platform

Plataforma de gestión continua del riesgo de proveedores (Vendor Risk Management) con frontend React/TypeScript, API Node.js/Express, PostgreSQL de Supabase y automatizaciones n8n.

## Arquitectura

- **Frontend:** React 18, TypeScript, Vite y Tailwind CSS.
- **Autenticación:** Supabase Auth.
- **API:** Express, validación JWT y control de acceso basado en roles (RBAC).
- **Persistencia:** PostgreSQL administrado por Supabase.
- **Automatización:** 11 workflows n8n exportados en `automation/n8n/workflows/`.
- **Despliegue:** Static Site para el frontend y Web Service independiente para la API en Render.

La API utiliza la Secret key de Supabase exclusivamente en servidor. El navegador usa la Publishable key y no recibe privilegios de servicio. Las tablas tienen RLS habilitado; las operaciones de negocio pasan por la API después de validar la sesión y los roles.

## Módulos de la aplicación

1. **Dashboard ejecutivo:** métricas de proveedores, niveles de riesgo, hallazgos y jobs.
2. **Proveedores y tecnologías:** inventario de terceros, criticidad, contacto de seguridad y CPE 2.3.
3. **Hallazgos:** gestión de CVEs, CT Logs, expiración TLS, superficie de ataque y hallazgos manuales.
4. **Evaluaciones:** cuestionarios, enlaces HMAC de un solo uso para proveedores, respuestas y puntuaciones persistidas.
5. **Alertas:** registro de notificaciones y estado de entrega (pending, sent, deduped, failed), incluidas las alertas generadas por los escáneres n8n.
6. **Automatización:** catálogo WF-00 a WF-10 y disparadores manuales mediante webhooks.
7. **Salud:** comprobación de conectividad con la API y Supabase, además de seguimiento de jobs.
8. **Auditoría:** historial, archivado y limpieza de registros.

## Workflows n8n incluidos

| ID | Workflow | Función principal |
|---|---|---|
| WF-00 | Global Error Handler | Captura y registra fallos |
| WF-01 | NVD CVE Monitoring | Consulta de vulnerabilidades por CPE |
| WF-02 | Certificate Transparency | Análisis de certificados y dominios |
| WF-03 | TLS Expiry | Comprobación de certificados TLS |
| WF-04 | Attack Surface | Consultas a Shodan |
| WF-05 | Re-evaluation Scheduler | Programación de reevaluaciones |
| WF-06 | Alert Dispatcher | Enrutamiento de alertas a Slack y SMTP |
| WF-07 | Scorecard Refresh | Recálculo de puntuaciones |
| WF-08 | Health Check | Supervisión de la salud de servicios y jobs |
| WF-09 | Weekly Digest | Resumen ejecutivo por correo |
| WF-10 | Cleanup & Archive | Cierre y archivado de registros |

Los JSON son definiciones exportables: para ejecutarlos se deben importar/actualizar en la instancia n8n, configurar credenciales y variables, y activar los workflows.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

El frontend utiliza las variables `VITE_*`. Para utilizar datos reales también se requiere una API Express configurada con Supabase y una sesión válida de Supabase Auth. La API se inicia con:

```bash
npm start
```

## Supabase y Render

La guía de configuración completa está en [SUPABASE_RENDER_SETUP.md](./SUPABASE_RENDER_SETUP.md). Incluye variables de entorno, Supabase Auth y roles, la migración incremental `database/04-upgrade-existing-supabase.sql`, los grants de `service_role`, PostgreSQL desde n8n, importación de workflows y pruebas iniciales.

## Seguridad y estado

No incluyas claves secretas, contraseñas de PostgreSQL ni tokens privados en GitHub o en variables `VITE_*`. La Secret key de Supabase debe permanecer solo en el entorno del backend.

El portal público de proveedores valida enlaces HMAC firmados con expiración y un solo uso; el proveedor responde sin iniciar sesión en el panel administrativo. Las ejecuciones manuales WF-01 a WF-10 se correlacionan mediante un `request_id` y reportan su resultado final al backend con un callback firmado; el panel actualiza el historial mientras haya ejecuciones en curso. Si un workflow termina abruptamente antes del callback, revisa WF-00 y los registros de n8n. La integración de servicios externos depende de las credenciales reales configuradas en Render, Supabase y n8n.