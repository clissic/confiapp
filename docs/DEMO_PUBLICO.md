# Demo público (túnel) — solo desarrollo

Exponé la versión de **desarrollo** a un cliente con una sola URL HTTPS, sin deploy.

En `vite`/`pnpm` el front usa **same-origin automático**: Local, link Network (IP LAN) y túneles funcionan sin cambiar IPs en `.env`. En producción el build usa `VITE_API_URL` absoluta del backend; este flujo no aplica.

El front (Vite `:3001`) proxyea la API (`:3000`). El túnel solo apunta al front.

## Requisitos

1. [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) instalado y en el `PATH`.
2. API + Web corriendo (`pnpm dev`).
3. Mongo (Atlas o local) accesible desde tu PC.

## Pasos

### 1. Arrancar la app

```powershell
pnpm dev
```

- Local: http://localhost:3001  
- Network: la URL `http://192.168.x.x:3001` que muestra Vite (válida en la misma Wi‑Fi)

No hace falta tocar `VITE_API_URL` ni `CORS_ORIGIN` por cambios de IP.

### 2. Abrir el túnel (otra red / cliente externo)

```powershell
pnpm demo:tunnel
```

El script busca `cloudflared` en el PATH y en rutas típicas de Windows
(`Program Files` / `Program Files (x86)`), así no falla si la terminal
no refrescó el PATH después de instalarlo.

Cloudflare imprime una URL tipo `https://xxxx.trycloudflare.com`. **Esa** es la que le pasás al cliente.

### 3. Al terminar

Cortá `cloudflared` (Ctrl+C). Podés dejar `pnpm dev` o cerrarlo también.

## Notas

| Tema | Detalle |
|------|---------|
| Solo desarrollo | Same-origin + CORS permisivo LAN/túnel solo con `NODE_ENV !== production` / `import.meta.env.DEV`. |
| PC encendida | El túnel solo funciona mientras tu máquina y `pnpm dev` estén activos. |
| URL variable | El túnel “quick” gratis cambia de URL cada vez que lo reiniciás. |
| Seguridad | Entorno de desarrollo expuesto; no uses datos reales sensibles. |

## Solución de problemas

- **Network Error en el link Network**: reiniciá Vite después de actualizar el código; confirmá que la API está en `:3000`.
- **`cloudflared` no se reconoce**: `winget install --id Cloudflare.cloudflared -e` y volvé a correr `pnpm demo:tunnel` (el script también prueba la ruta del `.exe`).
- **Blocked request / host not allowed**: Vite debe incluir `.trycloudflare.com` en `server.allowedHosts` (ya está en `apps/web/vite.config.ts`). Reiniciá `pnpm dev` y el túnel.
- **Login falla por túnel**: las peticiones deben ir al host del túnel (no a `localhost:3000` en el Network tab).
