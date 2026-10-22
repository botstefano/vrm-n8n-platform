# VRM Platform — Automatización n8n

Workflows de n8n para la plataforma de **gestión de riesgo de proveedores (VRM)**: monitoreo de CVEs, Certificate Transparency, expiración TLS, superficie de ataque (Shodan), reevaluaciones, alertas multicanal, scorecards, salud del sistema, digest semanal y limpieza.

> **Estado de validación.** Los 11 JSON se validaron estructuralmente (nodos, conexiones, expresiones, sintaxis JS de cada Code node con `node --check`) y la lógica de los Code nodes se ejecutó con datos simulados. **No se probó contra una instancia real de n8n ni de PostgreSQL**: importa primero en un entorno de pruebas (ver "Primer arranque").

## Estructura

```
vrm-n8n-platform/
├── automation/n8n/
│   ├── .env.example                  variables de entorno (copiar a .env)
│   └── workflows/                    ← JSON importables en n8n
│       ├── wf-00-global-error-handler.json
│       ├── wf-01-nvd-cve.json
│       ├── wf-02-ct-logs.json
│       ├── wf-03-tls-expiry.json
│       ├── wf-04-attack-surface.json
│       ├── wf-05-reevaluation.json
│       ├── wf-06-alerts.json
│       ├── wf-07-scorecard-refresh.json
│       ├── wf-08-health-check.json
│       ├── wf-09-weekly-digest.json
│       └── wf-10-cleanup-archive.json
├── database/
│   ├── 01-schema.sql                 tablas, tipos, índices y restricciones requeridos
│   └── 02-seed.sql                   datos de ejemplo (solo pruebas)
├── scripts/
│   ├── import-workflows.sh           importa/actualiza vía API y asigna el Error Workflow
│   └── validate-workflows.py         validador (estructura + sintaxis JS)
├── mock-backend/server.py            backend simulado para pruebas locales
├── docker-compose.yml                n8n + PostgreSQL + Redis + backend simulado
└── .gitignore
```

## Workflows

| WF | Disparador | Qué hace | Job (`monitoring_jobs`) |
|---|---|---|---|
| 00 | Error Trigger | Reenvía fallos de cualquier workflow a WF-06 y al backend | — |
| 01 | Cada 6 h | Consulta NVD (API 2.0) por CPE de cada proveedor, ventana desde la última ejecución; crea hallazgos con CVSS ≥ `NVD_MIN_CVSS` | `nvd` |
| 02 | Cada 24 h | Certificados nuevos en crt.sh (últimos `CT_LOOKBACK_DAYS` días); marca como `medium` los hosts tipo dev/staging/admin/vpn | `ct_log` |
| 03 | Cada 24 h | Lee el certificado TLS (módulo `tls`, sin shell) y crea hallazgo si vence en < 60 días (o ya expiró) | `tls_expiry` |
| 04 | Cada 24 h | Resuelve IP y consulta Shodan; hallazgos por puertos peligrosos (RDP, SMB, Redis, MongoDB…) y CVEs en banners | `shodan` |
| 05 | Cada 6 h | Crea la evaluación y el link firmado (HMAC) del portal cuando toca reevaluar (90/180/365 días según criticidad) | — |
| 06 | Webhook `POST /webhook/vrm-alerts` | Dedupe en Redis (1 h), Slack y email según severidad; destinatarios desde RBAC | — |
| 07 | Cada 1 h | Pide al backend el recálculo del scorecard de cada proveedor activo | `scorecard_refresh_all` |
| 08 | Cada 30 min | Detecta jobs atrasados/nunca ejecutados y backend caído; alerta vía WF-06 | — |
| 09 | Lunes 08:00 | Digest semanal por email (un solo envío, destinatarios en BCC) | — |
| 10 | Diario 03:00 | Cierra hallazgos vencidos hace > `STALE_FINDING_DAYS`, **archiva** auditoría antigua y purga historial de scores | `cleanup_archive` |

Los workflows de hallazgos (01–04) comparten el mismo patrón: `Code → IF Is Finding → Insert Finding (ON CONFLICT DO NOTHING) → Notify Backend → IF Severe → Send Alert`, y `Log Run` registra la ejecución.

## Primer arranque (local con Docker)

```bash
cp automation/n8n/.env.example automation/n8n/.env     # edita los "change-me"
docker compose up -d                                   # n8n :5678 · Postgres con esquema+seed · Redis · mock-backend :8000
```

1. Abre `http://localhost:5678`, crea el usuario propietario y genera una API key (**Settings → n8n API**).
2. Importa los workflows:
   ```bash
   export N8N_API_KEY=xxxxx            # N8N_URL por defecto: http://localhost:5678
   ./scripts/import-workflows.sh       # crea/actualiza y asigna WF-00 como Error Workflow de WF-01..05 y 07..10
   ```
   (También puedes importarlos a mano desde la UI: **Workflows → Import from file**.)
3. Crea las **credenciales** en la UI con estos nombres exactos y, si un nodo muestra la credencial sin seleccionar, elígela en el desplegable (el ID del JSON es un marcador):

   | Nombre en n8n | Tipo | Datos |
   |---|---|---|
   | `Postgres VRM` | Postgres | host `postgres`, db/usuario/clave del `.env` |
   | `Redis VRM` | Redis | host `redis`, puerto 6379 |
   | `NVD API` | Header Auth | Name `apiKey`, Value = tu API key de NVD (gratuita) |
   | `Shodan API` | Query Auth | Name `key`, Value = tu API key de Shodan |
   | `VRM Alerts Webhook Auth` | Header Auth | Name `X-Alert-Token`, Value = `ALERTS_WEBHOOK_TOKEN` del `.env` |
   | `SMTP VRM` | SMTP | tu servidor SMTP (en local, p. ej. Mailpit/MailHog) |

4. **Activa WF-06** (necesita estar activo para exponer el webhook), luego ejecuta cada workflow **una vez a mano** y revisa los resultados.
5. Orden de activación recomendado: WF-06 → WF-01 → WF-02 → WF-03 → WF-04 → WF-05 → WF-07 → WF-10 → WF-09 → **WF-08 al final** (marca como "nunca ejecutado" cualquier job que aún no haya corrido y generaría falsas alertas).

Para producción: apunta `VRM_BACKEND_URL` a tu backend real, fija una versión concreta de n8n (`N8N_IMAGE`) y no uses el `docker-compose.yml` tal cual (sin TLS ni backups).

## Contrato esperado del backend

| Llamada desde n8n | Cabecera | Uso |
|---|---|---|
| `POST /api/v1/webhooks/n8n/findings-created` `{finding_id, vendor_id, severity, source, title}` | `X-N8N-Signature` | nuevo hallazgo |
| `POST /api/v1/webhooks/n8n/assessment-created` `{vendor_id, assessment_id, email, link}` | `X-N8N-Signature` | enviar email al proveedor (SMTP centralizado) |
| `POST /api/v1/webhooks/n8n/workflow-failed` `{workflow, execution_id, node, error}` | `X-N8N-Signature` | fallo de workflow |
| `POST /api/v1/scorecard/recalc/{vendor_id}` | `X-Internal-Token` | recálculo (debe responder 2xx) |
| `GET /health` | — | WF-08 |

El backend debe **verificar** `X-N8N-Signature` (valor = `N8N_WEBHOOK_SECRET`) y validar la firma HMAC-SHA256 de los links del portal (`<payload base64url>.<firma>`, secreto `PORTAL_TOKEN_SECRET`, payload `{aid, vid, exp}`).

## Cambios respecto al informe original

Se partió del informe y se corrigieron los fallos encontrados al revisarlo:

| Problema en el informe | Solución aquí |
|---|---|
| `splitInBatches` cableado a la salida "done" y sin bucle de retorno → WF-03/04/05 no procesaban nada; `$input.first()` perdía elementos | Se eliminó `splitInBatches`: n8n procesa por ítem y el rate-limit se hace con *batching* del nodo HTTP |
| `json.severity`, `json.fail`… sin `$` | Corregido |
| WF-04 insertaba filas vacías cuando "skip" | Rama IF explícita; solo se insertan hallazgos |
| WF-09 corría 3 veces (3 ramas sin Merge) → digest triplicado | Consultas en cadena, un único envío (BCC) |
| WF-06 respondía varias veces al webhook (un email por destinatario) | Destinatarios agregados en un único envío |
| Token del portal solo en base64 ("firmado" sin firma) | HMAC-SHA256 con `PORTAL_TOKEN_SECRET` |
| Webhook de alertas sin autenticación | Header Auth (`X-Alert-Token`) |
| `executeCommand` + `bash -c` con datos externos | Módulo `tls` en Code node; bloquea hosts locales/privados |
| `errorWorkflow` nunca definido; WF-06 (webhook) no podía serlo | Nuevo WF-00 con Error Trigger; el script de importación lo asigna |
| WF-03 re-notificaba a diario el mismo hallazgo | `DO NOTHING` + severidad en `source_ref` (alerta solo al cambiar de nivel) |
| WF-08 no veía WF-03/04 (nunca escribían en `monitoring_jobs`) | Todos los workflows de monitoreo registran su ejecución; WF-08 detecta también "nunca ejecutado" y backend caído |
| WF-10 cerraba hallazgos sin dejar rastro y "archivaba" borrando | `resolution = 'auto_closed_stale'` y archivado real a `audit_log_archive`; retenciones configurables |
| `ON CONFLICT DO NOTHING` sin índice único en `monitoring_jobs` | Índice único parcial + UPSERT |
| WF-01/WF-02 no estaban en el documento | Diseñados desde cero (WF-01 usa `vendor_technologies` y no avanza la ventana si hubo fallos) |

## Puntos a validar / limitaciones

- **NVD**: WF-01 combina `virtualMatchString` con `lastModStartDate/EndDate`; confírmalo con una ejecución manual. Requiere cargar `vendor_technologies` (CPE por proveedor) — sin ellas WF-01 no consulta nada.
- **n8n 2.x**: los Code nodes se ejecutan en *task runners*; `NODE_FUNCTION_ALLOW_BUILTIN=crypto,tls` debe llegar al proceso del runner (en modo `internal` lo hereda; con runners externos configúralo allí). `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` es necesario porque los workflows leen `$env.*`.
- **Credenciales**: la API pública no permite fijar IDs, por eso hay que asociarlas en la UI tras importar.
- **crt.sh** es inestable: hay reintentos, pero puede devolver errores en horas punta.
- **Severidades de Shodan** (puertos críticos/altos) y el umbral TLS (<7/30/60 días) son decisiones de diseño; ajústalas en los Code nodes.
- **Tablas y enums** (`vendors`, `finding_status`, etc.) se infirieron del informe; si tu backend ya las define, usa solo los índices/restricciones de `01-schema.sql` y añade `resolution` a `vendor_findings`.
- Seguridad: Shodan y crt.sh reciben dominios de tus proveedores; revisa que eso sea aceptable según tus políticas.

## Validar cambios

```bash
python3 scripts/validate-workflows.py      # estructura, conexiones, expresiones y sintaxis JS
```
