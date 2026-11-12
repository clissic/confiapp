# Bootstrap del backend ConfiApp (`apps/api`)

> **Snapshot histórico** del scaffold Express inicial.  
> El estado actual del API (módulos, auth, transacciones, etc.) está en  
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) y [`WEB_APP.md`](./WEB_APP.md).  
> Conservar este archivo como referencia de decisiones de middleware/tooling.

Stack de plataforma inicializado en el bootstrap. **No describe el inventario actual de endpoints.**

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
| **Rate limiter** | `middleware/rate-limit.ts` (+ stores Redis opc.) | Global + por ruta (webhook, checkout, geo, chat, media, oauth, auth) |
| **JWT** | `infrastructure/security/jwt.ts` | `jsonwebtoken`; sign/verify |
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

Ver `apps/api/.env.example` (incluye JWT, DB, CORS, rate limit, providers de pago, etc.).

## Notas posteriores al bootstrap

- Auth, users, transactions, payments, wallet, notifications, chats, agents, reviews, audit y **media** (presign S3) **ya están montados** como módulos.
- **Redis** (`REDIS_URL`): opcional. Con URL → rate limits / cooldowns compartidos; sin URL → memoria del proceso (OK con 1 réplica).
- **Turnstile**, object storage Railway (`AWS_*`), `RUN_CRONS` y jobs con secret: ver [`SECURITY_COST_HARDENING.md`](./SECURITY_COST_HARDENING.md).

## Arranque

```bash
pnpm --filter @confiapp/api dev
```
