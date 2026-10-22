# Guía de Despliegue en Render (Render.com)

Esta plataforma está 100% preparada para desplegarse en **Render** sin configuraciones complejas. Puedes elegir cualquiera de las siguientes alternativas según tu preferencia:

---

## Opción 1: Despliegue Automático mediante Blueprint (`render.yaml`) ⭐ *Más Rápido*

Render detectará automáticamente el archivo `render.yaml` incluido en la raíz del repositorio:

1. Inicia sesión en [Render Dashboard](https://dashboard.render.com/).
2. Haz clic en **New +** y selecciona **Blueprint**.
3. Conecta tu repositorio de GitHub (`vrm-n8n-platform`).
4. Render leerá automáticamente la configuración de `render.yaml` (comando de compilación `npm install && npm run build`, directorio de publicación `dist` y reglas de reescritura SPA).
5. Haz clic en **Apply** y tu sitio estará en línea en un par de minutos con HTTPS automático y CDN global.

---

## Opción 2: Como "Static Site" (Sitio Estático) — *100% Gratuito en Render*

Si prefieres configurarlo manualmente en la interfaz web de Render:

1. Ve a [Render Dashboard](https://dashboard.render.com/) y haz clic en **New +** → **Static Site**.
2. Conecta tu repositorio de GitHub.
3. Completa los siguientes campos:
   - **Name**: `vrm-platform` (o el nombre que elijas)
   - **Branch**: `main` (o tu rama activa)
   - **Root Directory**: *(dejar en blanco)*
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Configura la regla de reescritura SPA (para que no dé error 404 al recargar):
   - En la sección **Redirects/Rewrites**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
5. Haz clic en **Create Static Site**.

---

## Opción 3: Como "Web Service" (Servidor Node.js con Express)

Si prefieres desplegarlo como un servicio web Node.js completo que incluya el endpoint de monitoreo de salud `/health`:

1. Ve a [Render Dashboard](https://dashboard.render.com/) y haz clic en **New +** → **Web Service**.
2. Conecta tu repositorio de GitHub.
3. Completa los siguientes campos:
   - **Name**: `vrm-platform-service`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (ejecuta `node server.js` y sirve la carpeta `dist`)
   - **Health Check Path**: `/health`
4. Render inyectará la variable de entorno `PORT` automáticamente y el servidor Express se vinculará a `0.0.0.0:$PORT`.
5. Haz clic en **Create Web Service**.

---

## Verificación Post-Despliegue

Una vez completado el despliegue:
- La aplicación cargará con todas las capacidades del **Centro de Automatización n8n (11 Workflows)**, matriz de proveedores, escáneres de vulnerabilidades y simuladores de alerta.
- Si usaste la Opción 3 (Web Service), puedes comprobar el estado de salud en `https://tu-app.onrender.com/health`.
