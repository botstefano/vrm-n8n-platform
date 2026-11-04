# Despliegue en Render

Esta aplicación se despliega como dos servicios independientes:

1. **Static Site:** React/Vite, publicado desde `dist`.
2. **Web Service:** API Express que valida Supabase Auth/RBAC y accede a PostgreSQL.

La configuración detallada, variables de entorno y pasos de n8n está en [SUPABASE_RENDER_SETUP.md](./SUPABASE_RENDER_SETUP.md).

## Frontend — Static Site

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`

## Backend — Web Service

- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`
- Variables privadas: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PORTAL_TOKEN_SECRET`, `VRM_FRONTEND_URL`, `N8N_WEBHOOK_SECRET`, `N8N_BASE_URL`, `ALERTS_WEBHOOK_TOKEN`, `N8N_MANUAL_WEBHOOK_BASE_URL`.

No expongas variables privadas en el Static Site ni en variables `VITE_*`.

## Blueprint

El archivo `render.yaml` define ambos servicios. Puedes usar **New + → Blueprint** para crear el conjunto a partir del repositorio. Si ya tienes el Static Site configurado manualmente, revisa sus variables y crea el Web Service de API por separado o aplica el Blueprint teniendo cuidado de no duplicar el sitio existente.

Consulta [SUPABASE_RENDER_SETUP.md](./SUPABASE_RENDER_SETUP.md) antes de realizar el despliegue.