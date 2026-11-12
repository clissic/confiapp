# Blindaje anti-bots y costo (Railway)

Estado de la defensa contra abuso de requests / storage / APIs externas que inflan la factura.
**En `master`** (merge de `harden/anti-bots-cost`). Turnstile verificado en local; Redis sigue opcional con 1 réplica.

## Hecho en código

| Área | Qué |
|------|-----|
| Rate limits | Global + auth + webhook + checkout + geo + chat + media + oauth |
| Redis (opcional) | `REDIS_URL` → store compartido; sin URL = memoria del proceso |
| Turnstile | Login / register / forgot / resend (`TURNSTILE_*` + `VITE_TURNSTILE_SITE_KEY`) |
| Email cooldown | Forgot/resend por email (Redis o memoria) |
| Webhook MP | Rate limit; no loguea body pre-firma; payload truncado; TTL 90d en logs |
| Checkout | Reutiliza preference `REQUIRES_ACTION` existente |
| Crons | `RUN_CRONS` + locks Mongo (`jobs_locks`) |
| Jobs HTTP | `TRANSACTIONS_JOB_SECRET` obligatorio; `limit` capado |
| Media | Presign S3 Railway (`AWS_*`); KYC/Prex/chat/product pueden subir al bucket |
| KYC email | Sin `fetch` HTTP arbitrario (anti-SSRF) |
| Listados | Sin `receiptDataUrl` en gates/list admin; caps `page` / finds |

## Config externa (ops)

| Item | Dónde | Notas |
|------|-------|--------|
| Turnstile Site + Secret | Cloudflare + Railway web/API | Probado en local |
| `TRANSACTIONS_JOB_SECRET` | API | Mismo valor en todos los entornos |
| Bucket S3 | Railway → vars `AWS_*` en API | Ya referenciable |
| `RUN_CRONS=true` | Solo **una** réplica API | Otras: `false` |
| `MERCADOPAGO_WEBHOOK_SECRET` | API prod | Fail-closed sin secret |
| Redis | Opcional | Necesario con 2+ réplicas |

## Pendiente

1. **Redis en prod** cuando haya multi-réplica (o Upstash free).
2. **`STORAGE_REQUIRE_OBJECT_KEYS=true`** en prod tras validar uploads + backfill:
   `node apps/api/scripts/backfill-media-to-storage.mjs --dry-run`
3. **WAF/Cloudflare** delante del dominio (edge DDoS) — ops, no código.
4. **Socket.io Redis adapter** (multi-réplica realtime).
5. **BullMQ / workers** desacoplados (hoy crons in-process con lock).
6. **Antivirus** en confirm de upload.
7. Typecheck legacy: tipado `ITransaction` / `operationDeadlineReminderSentAt` (ajeno al blindaje).

## Variables clave

Ver `apps/api/.env.example` y `apps/web/.env.example`.
