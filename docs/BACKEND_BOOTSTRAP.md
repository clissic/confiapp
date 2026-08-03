# Bootstrap del backend ConfiApp (`apps/api`)

Stack de plataforma inicializado. **No incluye diseño de endpoints nuevos** en este documento.

## Qué quedó configurado

| Pieza | Dónde | Decisión |
|-------|-------|----------|
| **Node.js ≥ 20** | `engines` monorepo | LTS actual; performance + `fetch` nativo |
| **Express** | `src/app.ts`, `src/server.ts` | Maduro, middleware ecosystem, encaja MERN |
| **TypeScript** | `tsconfig.json` strict | Contratos en el borde y menos bugs en pagos/auth |
| **ESLint** | `eslint.config.mjs` + `@confiapp/config` | Flat config ESLint 9; reglas compartidas del monorepo |
| **Prettier** | raíz + dep en api | Estilo único; cero debates de formato en PR |
| **dotenv** | `shared/config/env.ts` | Carga `.env` / `.env.local` + **validación Zod** (fail-fast) |
| **Helmet** | `app.ts` | Headers seguros (XSS, sniffing, clickjacking…) |
| **Morgan** | `app.ts` → `morganStream` | Access log HTTP; en prod `combined`, en dev `dev`; skip `/health` |
| **CORS** | `app.ts` | Origen explícito (`CORS_ORIGIN`) + credentials para cookies futuras |
| **Compression** | `app.ts` | gzip/deflate; menos bytes en JSON/Swagger |
| **Rate limiter** | `middleware/rate-limit.ts` | Mitiga brute-force/DoS básico; límites por env |
| **JWT** | `infrastructure/security/jwt.ts` | `jsonwebtoken`; sign/verify listos **sin** exponer rutas aún |
| **Bcrypt** | `utils/password.ts` (`bcryptjs`) | 12 rounds; portable (sin binding nativo en Windows CI) |
| **Mongoose** | `database/` + `DatabaseModule` | ODM tipado; conexión con reconexión y shutdown limpio |
| **Logger** | `utils/logger.ts` | JSON estructurado + niveles (`LOG_LEVEL`) |
| **Error handler** | `middleware/error-handler.ts` | Envelope estable; AppError + ValidationError Mongoose |

## Orden de middleware (importante)

1. Helmet  
2. CORS  
3. Compression  
4. Body parsers  
5. Morgan  
6. Rate limit  
7. Rutas  
8. 404 → error handler  

Justificación: seguridad y CORS antes de parsear cuerpos; compresión antes de enviar respuestas; rate limit tras identificar método/path; errores al final para capturar todo.

## Variables de entorno

Ver `apps/api/.env.example`:

- `DATABASE_URL` — MongoDB  
- `JWT_SECRET` / `JWT_EXPIRES_IN` — tokens (aún sin endpoints de login)  
- `CORS_ORIGIN` — frontend Vite (`3001`)  
- `RATE_LIMIT_*` — ventana y máximo  
- `LOG_LEVEL` — filtrado del logger  

## Qué no se hizo a propósito

- No se agregaron endpoints nuevos (pedido explícito).
- No se montó middleware `authenticate` en rutas (se hará con el módulo Auth).
- Redis para rate-limit distribuido queda para la fase de escala (hoy in-memory por proceso).

## Arranque

```bash
pnpm --filter @confiapp/api dev
```
