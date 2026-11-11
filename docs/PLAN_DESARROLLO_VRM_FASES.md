# VRM Automation Platform
## Documento de estado del desarrollo y plan de trabajo por fases

**Versión:** 1.0  
**Fecha de corte:** 11 de noviembre de 2026  
**Repositorio:** https://github.com/botstefano/vrm-n8n-platform  
**Rama de referencia:** `feature/supabase-integration`  
**Commit de referencia:** `47f7dc743783210bbaca99e7a7ca80e3c434d2dc`

---

## 1. Propósito y alcance

Este documento describe qué se ha construido en VRM (Vendor Risk Management), cómo se organiza funcionalmente, qué partes cuentan con evidencia de ejecución y qué actividades faltan para completar y evaluar el sistema. Su finalidad es servir como memoria técnica del proyecto y como hoja de ruta para el desarrollo y la investigación científica.

Las fases se adaptan a la naturaleza de VRM. No se trasladan literalmente las fases del Promptuario de otra aplicación de visión por computadora. Por ello, no se consideran requisitos de VRM la carga de imágenes como dataset, el entrenamiento de redes neuronales, Grad-CAM++, mapas de atención ni una interfaz Optuna. VRM es una plataforma de gestión continua del riesgo de ciberseguridad de terceros, no un clasificador de imágenes.

### 1.1 Criterios usados para declarar el estado

- **Implementado en código:** existe código, configuración, esquema SQL o definición de workflow en el repositorio.
- **Probado parcialmente:** existe evidencia de una ejecución o prueba, pero no cubre todos los escenarios, datos reales o condiciones de operación.
- **Pendiente de validación:** el componente existe, pero falta probarlo de forma controlada y documentada.
- **No implementado:** no se encontró la funcionalidad en la rama examinada.
- **Bloqueado operativamente:** el código está respaldado, pero una dependencia externa impide ejecutar actualmente el servicio.

La existencia de un archivo JSON de n8n no demuestra por sí sola que el workflow esté activo o funcionando en una instancia. Las definiciones del repositorio se exportan con `active: false`.

## 2. Resumen ejecutivo del proyecto

VRM integra un panel web, una API de negocio, una base de datos PostgreSQL y automatizaciones para administrar proveedores, evaluar su postura de seguridad, registrar hallazgos, calcular scorecards, generar alertas y mantener trazabilidad.

### 2.1 Arquitectura implementada

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Interfaz web | React 18, TypeScript, Vite y Tailwind CSS | Dashboard, proveedores, tecnologías, hallazgos, evaluaciones, alertas, auditoría y salud |
| API | Node.js y Express | API de negocio, validación de sesión, RBAC, reglas de puntuación, portal público, callbacks y operaciones de seguridad |
| Identidad | Supabase Auth | Inicio de sesión y validación de identidad |
| Persistencia | Supabase PostgreSQL | Proveedores, tecnologías, cuestionarios, evaluaciones, hallazgos, scorecards, alertas, auditoría y ejecuciones |
| Automatización | n8n | Escaneos programados, reevaluaciones, alertas, reportes, supervisión y limpieza |
| Despliegue | Render | Static Site para frontend y Web Service para API |

El navegador utiliza Supabase Auth para iniciar sesión. Las operaciones de negocio pasan por Express, que valida el JWT y los roles antes de consultar PostgreSQL. La clave secreta de Supabase permanece en el backend. El esquema activa RLS y revoca acceso de negocio directo a los roles `anon` y `authenticated`; n8n y el servidor utilizan credenciales privadas.

### 2.2 Módulos visibles en la aplicación

1. Dashboard ejecutivo.
2. Inventario de proveedores y tecnologías.
3. Gestión de hallazgos de seguridad.
4. Cuestionarios y evaluaciones de proveedores.
5. Portal público de evaluación mediante enlace firmado.
6. Centro de alertas.
7. Centro de automatización n8n.
8. Salud del sistema y supervisión de jobs.
9. Auditoría, historial y archivado.

## 3. Desarrollo por fases adaptadas a VRM

## Fase 0. Preparación, arquitectura e infraestructura

**Estado general: implementada; recuperación operativa de n8n pendiente.**

### Qué se ha realizado

- Se organizó el proyecto como una aplicación web con frontend React/TypeScript y backend Express independiente.
- Se configuró Supabase Auth y PostgreSQL como servicios de identidad y persistencia.
- Se desarrolló una API con validación JWT, control de acceso por roles y rutas para operaciones de negocio.
- Se preparó el despliegue separado del frontend (Static Site) y de la API (Web Service) en Render.
- Se incorporaron archivos de configuración, dependencias, scripts de validación y CI.
- Se separaron las claves públicas del frontend de los secretos que solo debe utilizar el backend.

### Evidencia en el repositorio

- `README.md`
- `SUPABASE_RENDER_SETUP.md`
- `DEPLOY_RENDER.md`
- `render.yaml`
- `.env.example`
- `server.js`
- `src/main.tsx`, `src/App.tsx`
- `package.json`
- `.github/workflows/ci.yml`

### Qué falta completar

1. Recuperar el servicio n8n tras el vencimiento de la prueba de n8n Cloud, o migrarlo a una instancia administrada por el proyecto.
2. Recrear credenciales y variables no sensibles en la nueva instancia; los secretos no se deben guardar en Git.
3. Actualizar en Render las URL de webhooks de la nueva instancia y desplegar la API una vez verificadas.
4. Confirmar la conectividad extremo a extremo tras la recuperación: frontend → API → Supabase y API ↔ n8n.
5. Documentar versiones efectivas, configuración de despliegue, respaldo y recuperación.

**Observación:** la caducidad de n8n Cloud bloquea la ejecución actual de las automatizaciones, pero los once archivos JSON continúan respaldados en el repositorio.

## Fase 1. Gestión e integración de datos

**Estado general: modelo y módulos implementados; completar la ingesta y validación de una muestra pública verificable.**

### Qué se ha realizado

Se definió e implementó el modelo relacional de negocio en PostgreSQL. Incluye, entre otras, las siguientes entidades:

| Tabla | Uso |
|---|---|
| `users`, `roles`, `user_roles` | Usuarios y autorización RBAC |
| `vendors` | Proveedores, estado, criticidad, score y contacto |
| `vendor_technologies` | Tecnologías y expresiones CPE asociadas |
| `questionnaires` | Versiones y definiciones de cuestionarios |
| `assessments` | Evaluaciones, respuestas, estado y puntuación |
| `vendor_findings` | Hallazgos y evidencias por proveedor |
| `monitoring_jobs` | Estado y frecuencia de tareas de monitorización |
| `score_history` | Historial de puntuaciones |
| `alert_notifications` | Registro, deduplicación y estado de entrega de alertas |
| `workflow_execution_logs` | Ejecuciones manuales de workflows |
| `audit_log`, `audit_log_archive` | Trazabilidad y archivo de auditoría |

La interfaz contempla gestión de proveedores y tecnologías, filtros de hallazgos, cuestionarios y consultas de históricos. El esquema incluye índices, restricciones, claves foráneas, triggers de actualización y RLS.

### Qué falta completar

1. Definir un procedimiento reproducible de extracción de datos públicos de proveedores (por ejemplo, fuentes OECE/SEACE), conservación de archivos originales, fecha de descarga, licencia, diccionario y reglas de deduplicación.
2. Distinguir la identidad legal del proveedor, la entidad contratante, el producto/servicio adjudicado y el activo tecnológico observado. No asumir que un producto contratado por un cliente está instalado en la infraestructura del proveedor.
3. Confirmar la relación entre una empresa y su dominio mediante fuentes confiables antes de asociar activos.
4. Incorporar registros a VRM solo después de documentar su procedencia y verificar campos obligatorios.
5. Mantener separado el dataset público de investigación del inventario operacional de la plataforma hasta que se revise su calidad y autorización de uso.
6. Definir reglas de actualización y retiro de datos obsoletos.

**Límite de evidencia:** los registros públicos de contrataciones prueban que existe una adjudicación registrada, pero no prueban por sí solos la arquitectura interna, las versiones instaladas ni el nivel de ciberseguridad de la empresa adjudicada.

## Fase 2. Motor de evaluación y puntuación de riesgo

**Estado general: reglas deterministas implementadas; justificación, calibración y validación independiente pendientes.**

### Qué se ha realizado

Se implementó un cálculo de scorecard en `server.js` mediante la función `recalculateVendorScore(vendorId)`. El motor combina criticidad del proveedor, severidad y estado de hallazgos, vencimiento de reevaluación y evaluaciones pendientes.

La regla actualmente codificada funciona de la siguiente manera:

1. La puntuación comienza en 100.
2. Se calcula el multiplicador de criticidad: `0.7 + criticality × 0.12`.
3. Las deducciones base por severidad son: critical = 22; high = 12; medium = 5; low = 2; info = 0.
4. Los hallazgos cerrados no descuentan puntos. Un hallazgo `in_progress` aplica el 60 % de la deducción y uno `accepted` aplica el 40 %.
5. Una reevaluación vencida resta 5 puntos.
6. Si el proveedor está en estado `reevaluation` y tiene una evaluación `pending` o `in_progress`, se restan 3 puntos.
7. La puntuación se limita al rango 0–100 y se redondea a un decimal.
8. Se guarda el resultado en `vendors.current_score`, `vendors.current_risk` y `score_history`.

Los umbrales de riesgo codificados son:

| Condición de score | Clasificación |
|---|---|
| Menor que 45 | critical |
| Desde 45 y menor que 65 | high |
| Desde 65 y menor que 80 | medium |
| Desde 92 y criticidad ≤ 3 | minimal |
| Otros casos restantes | low |

El portal de evaluación también calcula una puntuación de cuestionario ponderada: suma el peso de las respuestas afirmativas y lo divide entre el peso total. Si el proveedor estaba en reevaluación, una puntuación de 75 o más permite actualizar su estado a `approved`; por debajo de 75, a `conditional`.

### Qué falta completar

1. Documentar el fundamento de cada peso, multiplicador y umbral; actualmente el código contiene valores explícitos, pero el repositorio no aporta una validación empírica de que sean óptimos.
2. Revisar el comportamiento de puntuación cuando hay muchos hallazgos repetidos o hallazgos de distintas fuentes sobre una misma causa.
3. Definir si la severidad, la explotación conocida, la exposición y la criticidad deben ponderarse de forma diferenciada.
4. Ejecutar análisis de sensibilidad para verificar cuánto cambia el score al modificar cada factor.
5. Contrastar resultados con evaluación experta independiente o criterios externos documentados.
6. Probar límites, transiciones entre categorías y persistencia del historial.
7. Explicar que este motor es un sistema de reglas deterministas, no un modelo de machine learning entrenado.

**No se ha implementado entrenamiento de modelos, selección de algoritmos, Optuna ni validación cruzada.** Esas funciones no son necesarias para describir el motor actual de VRM.

## Fase 3. Monitorización de ciberseguridad y detección de hallazgos

**Estado general: workflows y rutas de backend implementados; ejecución integral con activos reales autorizados pendiente.**

### Qué se ha realizado

Los workflows de monitorización son:

| Workflow | Función implementada |
|---|---|
| WF-01 | Consulta vulnerabilidades NVD/CVE asociadas a tecnologías mediante CPE 2.3, con paginación y umbral CVSS |
| WF-02 | Consulta Certificate Transparency mediante crt.sh y analiza certificados/subdominios nuevos |
| WF-03 | Comprueba certificados TLS y fechas de expiración |
| WF-04 | Consulta Shodan para información pública de hosts, puertos, banners y CVE asociadas |
| WF-07 | Solicita el recálculo del scorecard de proveedores activos |

La API también incluye resolución DNS y validación de direcciones públicas. El módulo `server/host-security.js` bloquea direcciones privadas, loopback, link-local y rangos reservados; rechaza respuestas DNS mixtas para evitar el uso de una dirección privada dentro de una respuesta parcialmente pública.

La comprobación TLS se realiza en el backend, que valida el host resuelto antes de establecer la conexión. El workflow persiste resultados y reporta el estado del job.

### Qué falta completar

1. Recuperar n8n y repetir la validación de los workflows con credenciales funcionales.
2. Crear una muestra de activos cuyo dominio y autorización de prueba estén documentados.
3. Verificar producto, versión y correspondencia CPE antes de atribuir una CVE a un activo.
4. Ejecutar pruebas positivas, negativas y sin datos para cada fuente.
5. Distinguir ausencia de hallazgos de fallo de consulta; un resultado vacío no demuestra que un activo sea seguro.
6. Registrar la fecha de consulta, fuente, identificador externo, evidencia, versión detectada y límites de cobertura.
7. Evaluar falsos positivos y falsos negativos usando un conjunto de referencia revisado.
8. Mantener los escaneos activos limitados a activos propios o autorizados. El uso de fuentes pasivas públicas no autoriza a ejecutar pruebas intrusivas contra infraestructura de terceros.

**Limitación específica:** WF-03 detecta expiración de certificados TLS; no debe describirse como auditoría completa de configuración criptográfica o suites débiles.

## Fase 4. Seguridad, control de acceso y trazabilidad

**Estado general: controles implementados en código y esquema; auditoría de seguridad independiente pendiente.**

### Qué se ha realizado

- Supabase Auth valida la identidad del usuario.
- Express valida JWT, correo confirmado, estado activo del perfil y pertenencia a roles.
- Se contemplan los roles `admin`, `risk_analyst` y `auditor`.
- Las rutas sensibles verifican los roles permitidos.
- RLS está activado en las tablas de negocio y el esquema revoca privilegios directos de `anon` y `authenticated`.
- Las claves de servicio y secretos de portal permanecen en el backend.
- El portal utiliza enlaces HMAC-SHA256 con expiración. Se guarda el hash del token, no el enlace reutilizable en claro como identificador de acceso.
- Al completar la evaluación, el sistema valida el token, actualiza condicionalmente la evaluación y elimina el hash y la fecha de expiración, impidiendo el segundo uso.
- Los callbacks de n8n se autentican mediante `X-N8N-Signature` y un secreto compartido.
- La API incorpora Helmet, CORS por orígenes permitidos, límites de payload y validaciones de entrada.
- Las operaciones relevantes escriben eventos en `audit_log`.

### Qué falta completar

1. Preparar una matriz de permisos por rol y endpoint.
2. Ejecutar pruebas negativas: JWT ausente, inválido, expirado, perfil inactivo y rol no autorizado.
3. Verificar manipulación, expiración, revocación y segundo uso de enlaces HMAC.
4. Comprobar que los callbacks con firma incorrecta sean rechazados.
5. Ejecutar pruebas DNS con IP privadas, reservadas y respuestas mixtas.
6. Realizar revisión de dependencias, configuración HTTP, CORS, headers y exposición de secretos.
7. Documentar un modelo de amenazas y una prueba de seguridad independiente.
8. Revisar que los eventos de auditoría cubran las acciones administrativas y los fallos relevantes.

## Fase 5. Automatización, alertas y reportes

**Estado general: definiciones implementadas; operación actual bloqueada por la instancia n8n caducada y WF-10 pendiente de prueba segura.**

### Qué se ha realizado

El repositorio incluye once workflows:

| ID | Nombre | Responsabilidad |
|---|---|---|
| WF-00 | Global Error Handler | Capturar fallos de workflows y reportarlos |
| WF-01 | NVD CVE Monitoring | Consultar NVD y registrar hallazgos |
| WF-02 | CT Logs | Consultar certificados públicos y subdominios |
| WF-03 | TLS Certificate Expiry | Identificar certificados próximos a vencer |
| WF-04 | Attack Surface | Consultar Shodan y analizar exposición |
| WF-05 | Re-evaluation Scheduler | Encontrar reevaluaciones vencidas y preparar invitaciones |
| WF-06 | Alerts Multi-channel | Enviar notificaciones a Slack y, según severidad, correo |
| WF-07 | Scorecard Refresh | Recalcular scorecards |
| WF-08 | Health Check | Revisar salud de backend y jobs atrasados |
| WF-09 | Weekly Digest | Crear y enviar resumen semanal |
| WF-10 | Cleanup & Archive | Cerrar hallazgos antiguos, archivar auditoría y purgar score history |

El backend centraliza la deduplicación de alertas en PostgreSQL mediante `alert_notifications` y una huella de notificación en una ventana de una hora. La ruta de entrega se define como Slack para severidades distintas de critical/high y Slack + email para critical/high.

WF-10 contiene operaciones de mantenimiento con estos valores predeterminados:
- Cierre de hallazgos abiertos cuyo `due_date` supera `STALE_FINDING_DAYS` (90 días por defecto).
- Archivo de auditoría anterior a `AUDIT_RETENTION_YEARS` (5 años por defecto).
- Eliminación de historial de puntuaciones anterior a `SCORE_RETENTION_YEARS` (2 años por defecto).

### Evidencia de pruebas realizadas hasta el 11 de noviembre de 2026

| Workflow | Evidencia disponible | Alcance de la evidencia |
|---|---|---|
| WF-01 | Tuvo una ejecución anterior sin objetivos de escaneo; la corrección del timestamp está en GitHub, pero la repetición posterior falló cuando caducó n8n Cloud | No valida escaneo CVE completo |
| WF-02 | Ejecución satisfactoria reportada en el panel | Prueba preliminar; no acredita cobertura real de dominios |
| WF-03 | Ejecución satisfactoria reportada en el panel | Prueba preliminar; no acredita un conjunto TLS amplio |
| WF-04 | Ejecución satisfactoria reportada en el panel | Prueba preliminar; no acredita cobertura Shodan amplia |
| WF-05 | `success`: no había proveedores con reevaluación vencida | Valida la rama sin proveedores, no la invitación completa |
| WF-06 | `success`: notificación procesada y enviada | Confirma un flujo de notificación en la instancia utilizada |
| WF-07 | Ejecución satisfactoria reportada en el panel | No sustituye una prueba cuantitativa de recalculación con muestra |
| WF-08 | `partial`: detectó atraso de NVD y ausencia de ejecución de cleanup_archive | Confirma detección de problemas; no es un resultado saludable |
| WF-09 | `success`: digest enviado a un destinatario | Confirma un envío de resumen en la instancia utilizada |
| WF-10 | No ejecutado | Pendiente por contener operaciones de modificación/eliminación |
| WF-00 | Definición de Error Trigger y reporte presente en el repositorio | Falta volver a verificar su asociación y ejecución en nueva instancia |

### Qué falta completar

1. Recuperar o migrar n8n.
2. Importar los once JSON de la rama.
3. Crear nuevamente las credenciales PostgreSQL, NVD, Shodan, SMTP y autenticaciones de callbacks.
4. Definir variables globales no sensibles.
5. Asignar WF-00 como gestor de errores de WF-01 a WF-10.
6. Revisar los webhooks y probar callbacks antes de habilitar cron.
7. Ejecutar una prueba completa de WF-05 con un proveedor de prueba autorizado y correo controlado.
8. Repetir WF-06 con verificación de entrega y deduplicación.
9. Repetir WF-08 después de que todos los jobs tengan registros válidos.
10. Ejecutar WF-10 primero en una copia aislada de la base de datos, registrar los conteos afectados y aprobar explícitamente los cambios antes de usarlo sobre datos operativos.

### Inconsistencias de documentación que deben corregirse

- Algunas descripciones del frontend todavía mencionan Redis para la deduplicación de WF-06. El README y el backend actuales indican que la deduplicación está centralizada en PostgreSQL (`alert_notifications`).
- Algunas descripciones visuales de WF-03/WF-04 no reflejan que la validación DNS y la negociación TLS se realizan en el backend.
- Deben alinearse `src/data/seedData.ts`, `src/components/WorkflowsView.tsx` y `src/components/AlertsView.tsx` con el diseño efectivo del backend.

## Fase 6. Evaluación experimental y validación del software

**Estado general: pruebas funcionales preliminares realizadas; protocolo experimental sistemático pendiente.**

### Qué se ha realizado

- Se comprobó el estado de la API y la conectividad con PostgreSQL mediante `/health`.
- Se realizaron ejecuciones manuales desde el panel VRM con `request_id` y callback de finalización.
- Se comprobó el flujo sin proveedores pendientes de reevaluación.
- Se verificó una notificación de WF-06 y un digest de WF-09.
- Se observó cómo WF-08 informa estados parciales cuando detecta jobs atrasados o ausentes.
- El repositorio contiene pruebas unitarias del módulo `server/host-security.js` para rangos IP privados/reservados, normalización de host, IPv6 pública, resolución pública y respuestas DNS mixtas.

### Qué falta completar

Debe prepararse un plan de pruebas reproducible con casos, precondiciones, entradas, resultado esperado, evidencia, versión de software y fecha.

| Dimensión | Pruebas que faltan |
|---|---|
| Funcional | Alta/edición de proveedor, tecnologías, cuestionario, respuestas, hallazgos y cierre |
| Integración | Frontend–API–Supabase, n8n–API, PostgreSQL–n8n y callbacks |
| Seguridad | RBAC, RLS, HMAC, expiración, un solo uso, callbacks y DNS |
| Monitorización | Consultas con objetivos válidos, ausencia de datos, timeout, límite de API y recuperación |
| Rendimiento | Latencia API p50/p95, duración de workflow, concurrencia y volumen procesado |
| Fiabilidad | Tasa de éxito, ejecuciones parciales/fallidas, reintentos y recuperación |
| Calidad | Usabilidad, mantenibilidad, compatibilidad y documentación |

Las métricas deben obtenerse ejecutando el sistema. No deben inventarse ni inferirse de una ejecución sin datos.

Para el artículo científico se debe declarar qué datos son registros públicos, cuáles son resultados de ejecución y cuáles son fixtures usados exclusivamente para pruebas unitarias. Los proveedores reales no deben asociarse a vulnerabilidades sin evidencia de activo y versión.

## Fase 7. Validación final, optimización y evolución

**Estado general: no existe un programa de optimización experimental completo; se define como trabajo pendiente.**

### Qué se ha realizado

El sistema ya incorpora índices SQL para búsquedas y relaciones frecuentes, consultas con filtros, ejecución concurrente limitada para algunas comprobaciones del backend, deduplicación de alertas y registros de monitorización.

### Qué falta completar

1. Medir cuellos de botella de consultas, API y workflows antes de optimizar.
2. Revisar índices a partir de planes de ejecución y consultas reales.
3. Evaluar límites de concurrencia, paginación, timeouts y reintentos.
4. Revisar idempotencia de cada workflow y callbacks.
5. Probar la política de retención y recuperación de auditoría.
6. Validar los umbrales de scorecard con evidencia y revisión experta.
7. Preparar una versión reproducible del sistema, variables no secretas, scripts de despliegue y dataset documentado.
8. Repetir las pruebas de regresión tras cada cambio.

No se ha implementado una interfaz Optuna ni entrenamiento de modelos de machine learning. No se propone incorporarlos como requisito para completar VRM; solo tendrían sentido si una investigación posterior define y justifica un problema predictivo, obtiene etiquetas confiables y diseña una validación apropiada.

## 4. Actividades prioritarias para completar el proyecto

| Prioridad | Actividad | Motivo | Criterio de cierre |
|---|---|---|---|
| P0 | Recuperar n8n y sus credenciales | Automatizaciones actualmente bloqueadas por vencimiento de la prueba Cloud | Workflows importados, callbacks y credenciales verificados |
| P0 | Corregir descripciones UI desactualizadas | Evitar que el panel describa Redis o ejecución TLS/DNS en un componente equivocado | Textos alineados con backend y README |
| P0 | Verificar WF-01 y WF-08 | Corregir estado de monitorización NVD y confirmar salud después de la recuperación | Ejecuciones y monitoring_jobs coherentes |
| P1 | Probar WF-05 con proveedor controlado | Validar creación, enlace, correo y respuesta del proveedor | Evaluación completada, score guardado y token inutilizable |
| P1 | Validar seguridad de roles y portal | Demostrar controles negativos y protección del portal | Matriz de pruebas aprobada |
| P1 | Probar WF-10 en copia aislada | Evitar pérdida de datos por cierre/archivo/purga | Conteos revisados y resultado reproducible |
| P1 | Ampliar y documentar dataset público | Base empírica trazable para la evaluación y artículo | Fuentes, licencia, diccionario y procedencia archivados |
| P2 | Medir rendimiento y fiabilidad | Obtener resultados experimentales del software | Tabla de métricas reproducible |
| P2 | Validar el scorecard | Sustentar pesos y umbrales | Análisis de sensibilidad y revisión experta |
| P2 | Preparar versión de publicación | Reproducibilidad y evaluación científica | Código, datos, pruebas y documentación versionados |

## 5. Límites y decisiones metodológicas

1. VRM es un sistema de gestión continua de riesgo de terceros y no una aplicación de visión por computadora.
2. El scorecard implementado es determinista y basado en reglas; no es un modelo de ML entrenado.
3. Una adjudicación pública no demuestra que una empresa tenga una vulnerabilidad.
4. Una CVE asociada a un producto no demuestra que una organización lo ejecute en una versión vulnerable.
5. Las consultas pasivas a fuentes públicas y las pruebas activas sobre activos autorizados deben registrarse por separado.
6. Una ejecución `success` sin objetivos demuestra que la rama vacía se procesó, no que el escáner detecte correctamente vulnerabilidades.
7. Un estado `partial` de WF-08 es evidencia de detección de problemas, no de salud completa.
8. WF-10 modifica y elimina datos conforme a políticas de retención; debe probarse en un entorno aislado y con conteos previos.
9. Las métricas de rendimiento y eficacia deben medirse. No se incluyen valores estimados como si fueran resultados.
10. Los secretos nunca deben incorporarse a documentación pública ni a Git.

## 6. Referencias internas del proyecto

- `README.md`: arquitectura, módulos y descripción de los workflows.
- `SUPABASE_RENDER_SETUP.md`: configuración de Supabase, Render y n8n.
- `database/01-schema.sql`: esquema inicial de base de datos.
- `database/04-upgrade-existing-supabase.sql`: actualización incremental para la base existente.
- `server.js`: API, autenticación, RBAC, scorecard, portal, callbacks y alertas.
- `server/host-security.js`: validación de hosts y direcciones públicas.
- `tests/host-security.test.js`: pruebas del control de hosts.
- `src/components/`: módulos de interfaz.
- `src/data/seedData.ts`: catálogo descriptivo de workflows (debe mantenerse alineado con su implementación).
- `automation/n8n/workflows/`: definiciones WF-00 a WF-10.
- `scripts/validate-n8n-cloud.mjs`: validación estática de workflows para n8n Cloud.

## 7. Conclusión

VRM ya cuenta con una base de ingeniería sustancial: arquitectura web desplegable, API protegida, esquema PostgreSQL, inventario de proveedores, tecnologías, evaluaciones, portal HMAC, hallazgos, scorecard determinista, auditoría y once automatizaciones versionadas.

El proyecto no está terminado en términos de validación científica y operación continua. Las tareas de mayor impacto son recuperar n8n, probar los flujos con activos autorizados y datos verificables, validar el motor de puntuación, completar la matriz de seguridad y medir rendimiento y fiabilidad. Esta hoja de ruta distingue lo construido de lo que todavía debe demostrarse y evita presentar como resultados experimentales las capacidades que solo están definidas en código.
