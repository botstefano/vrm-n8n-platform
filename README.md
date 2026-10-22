# VRM Automation Platform

Una aplicación interactiva en React & TypeScript para la **Gestión Continua del Riesgo de Proveedores (VRM - Vendor Risk Management)**, inspirada e integrada con los 11 flujos de automatización de n8n, esquema relacional PostgreSQL y políticas de alerta multicanal.

## Características Principales

1. **Panel Ejecutivo y Métricas de Riesgo**:
   - Estadísticas en tiempo real de proveedores activos, hallazgos críticos/altos abiertos y scorecards.
   - Matriz de criticidad (1 a 5) versus nivel de riesgo actual (Crítico, Alto, Medio, Bajo, Mínimo).
   - Detección inmediata de reevaluaciones vencidas.

2. **Inventario de Proveedores & Tecnologías CPE**:
   - Registro y edición de proveedores, información de contacto de seguridad y criticidad del servicio.
   - Inventario de software y componentes con identificadores **CPE 2.3** (`cpe:2.3:a:vendor:product:version:...`) requeridos para la correlación con la base de datos nacional de vulnerabilidades (NVD).
   - Historial de calificaciones (scorecards) y trazabilidad de evaluaciones.

3. **Gestión de Hallazgos y Superficie de Ataque**:
   - Ingesta y visualización de vulnerabilidades desde 4 fuentes principales:
     - **NVD API 2.0**: CVEs identificados por coincidencia con CPEs registrados.
     - **Certificate Transparency (crt.sh)**: Monitoreo de subdominios sensibles emitidos recientemente (`admin`, `vpn`, `staging`, `dev`).
     - **TLS Expiry & Ciphers**: Verificación nativa de expiración de certificados X.509 (<60d, <30d, <7d o vencido) y suites criptográficas débiles.
     - **Shodan Attack Surface**: Detección de puertos peligrosos expuestos a Internet público (RDP 3389, SMB 445, Redis 6379, MongoDB 27017, Telnet) y banners.
   - Regla de idempotencia estricta (`vendor_id` + `source` + `source_ref`).
   - Ciclo de vida de hallazgos: *Open* → *In Progress* → *Accepted* → *Closed* con registro de notas de resolución y ajuste dinámico del puntaje.

4. **Centro de Automatización n8n (11 Workflows)**:
   - **WF-00**: Global Error Handler (gestión de dead-letters y fallos no controlados).
   - **WF-01**: NVD CVE Monitoring (escaneo periódico cada 6h por CPE).
   - **WF-02**: Certificate Transparency (crt.sh diario).
   - **WF-03**: TLS Expiry & Cipher Verifier (inspección de certificados X.509 diarios).
   - **WF-04**: Attack Surface Recon (resolución IP y Shodan diario).
   - **WF-05**: Re-evaluation Scheduler (evaluaciones cada 90/180/365 días según criticidad con enlaces firmados HMAC-SHA256).
   - **WF-06**: Multi-channel Alert Dispatcher (deduplicación en Redis con ventana de 1h, enrutamiento a Slack y correo SMTP).
   - **WF-07**: Scorecard Refresh Engine (recálculo por lotes cada 1h con deducciones ponderadas por criticidad).
   - **WF-08**: Health Check & Deadman Monitor (supervisión de jobs atrasados en `monitoring_jobs` y ping al backend).
   - **WF-09**: Weekly Digest Generator (resumen ejecutivo enviado los lunes a partes interesadas).
   - **WF-10**: Cleanup & Compliance Archiver (resolución de hallazgos obsoletos como `auto_closed_stale` y archivado a `audit_log_archive`).
   - Ejecutor interactivo de pipelines con salida en consola paso a paso y visualizador de esquemas n8n JSON.

5. **Portal de Evaluaciones y Cumplimiento de Terceros**:
   - Generación y verificación de tokens firmados HMAC-SHA256 (`<payload base64url>.<firma>`).
   - Simulador del portal externo de evaluación que permite responder cuestionarios de seguridad (ISO 27001 / SOC 2) y actualizar el puntaje del proveedor.

6. **Despacho Multicanal de Alertas (Slack & Email)**:
   - Deduplicación basada en fingerprint (`source:source_ref:vendor_id:severity`) con ventana de 1 hora.
   - Previsualizador en vivo del mensaje en **Slack Block Kit** (`#secops-alerts`).
   - Previsualizador en vivo del correo HTML enviado a usuarios RBAC (CISO, Analista de Riesgo, Auditor).

7. **Salud de Jobs y Auditoría Completa**:
   - Tabla reactiva de `monitoring_jobs` con metadatos de ejecución.
   - Registro completo de auditoría (`audit_log`) y tabla de retención regulatoria (`audit_log_archive`).
   - Exportación de copias de seguridad en formato JSON.

## Pila Tecnológica

- **Framework**: React 18 / 19 SPA con TypeScript y Vite.
- **Estilos**: Tailwind CSS con paleta oscura técnica de alta fidelidad.
- **Iconografía**: Lucide React.
- **Persistencia**: LocalStorage reactivo con seed pre-cargado e importación/exportación JSON.

## Arranque en Desarrollo

```bash
npm install
npm run dev
```

El servidor iniciará en `http://0.0.0.0:3000`.

## Despliegue en Render (Render.com)

El proyecto incluye archivo de infraestructura como código `render.yaml` y servidor Express `server.js` con endpoint `/health`:

- **Opción Blueprint**: En Render, selecciona **New +** → **Blueprint** y conecta el repositorio. Render configurará la compilación y reescritura SPA automáticamente.
- **Opción Static Site**: Build Command `npm run build`, Publish Directory `dist`, Rewrite `/*` → `/index.html`.
- **Opción Web Service**: Build Command `npm run build`, Start Command `npm start`.

Consulta el archivo [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) para la guía paso a paso con capturas y detalles.

