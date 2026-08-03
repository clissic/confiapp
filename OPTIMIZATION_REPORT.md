# Informe de optimización — ConfiApp

Fecha: 2026-08-02  
Alcance: Performance · Mongo · React · Bundle · Lazy loading · Caching · Seguridad · Escalabilidad

---

## Resumen ejecutivo

Se aplicaron mejoras de alto impacto en **API** y **Web** sin reescritura de dominio. El foco fue:

1. Reducir trabajo en el **hot path** autenticado y listados N+1.
2. Endurecer **seguridad** (IDOR, webhooks, docs, body size, rate limits).
3. Bajar el **bundle inicial** con lazy routes + `manualChunks`.
4. Mejorar **caching** de React Query y polling.

---

## 1. Performance (API)

| Mejora | Archivo | Efecto |
|--------|---------|--------|
| `authenticate` con `.select(...).lean()` | `apps/api/src/middleware/authenticate.ts` | Menos I/O y proyección en **cada** request autenticado |
| Body JSON 256kb global / 6mb solo chat | `apps/api/src/app.ts` | Menos memoria DoS; chat sigue con adjuntos |
| Rate limit skip `/health` y webhooks | `apps/api/src/middleware/rate-limit.ts` | Health/checks y MP no consumen cuota |
| Morgan skip auth + webhooks | `apps/api/src/app.ts` | Menos I/O de logs; evita filtrar tokens en access log |
| CORS multi-origen (CSV) | `apps/api/src/app.ts` | Escalabilidad de frontends |

---

## 2. Consultas Mongo

| Mejora | Archivo | Efecto |
|--------|---------|--------|
| Batch products en `listMine` | `transactions/service.ts` | Elimina N+1 de productos (1 query vs N) |
| `loadProductDto` con `.lean()` | `transactions/service.ts` | Menos overhead de documentos Mongoose |
| Open jobs: batch users + `.lean()` + `.select()` | `agents/open-jobs.service.ts` | Elimina N+1 de creators/ratings |
| Agent search: `countActiveJobsForAgents` (aggregate) | `agents/search.repository.ts` | Elimina hasta ~80 `countDocuments` por búsqueda |
| Agent search `.lean()` + select | `agents/search.repository.ts` | Menos payload desde geo near |
| Chats `listMine` `.limit(100)` | `chats/service.ts` | Cota superior de listados |
| Índice `payee` + compound | `database/indexes/payment.indexes.ts` | Acelera listados payer/payee |
| Índice `{ status, deletedAt, createdAt }` | `database/indexes/transaction.indexes.ts` | Open jobs / filtros por estado |

---

## 3. React / renderizados / caching

| Mejora | Archivo | Efecto |
|--------|---------|--------|
| React Query `staleTime` 60s, `gcTime` 10m | `shared/lib/query-client.ts` | Menos refetch; mejor hit de cache |
| Polling ofertas 30s (antes 10s) | `agent-ops/hooks/useAgentOps.ts` | Menos red + CPU en background |
| `loading="lazy"` + `decoding="async"` en chat | `chat/ui/MessagesPage.tsx` | Menos trabajo de decode en viewport |

---

## 4. Bundle / lazy loading

| Mejora | Archivo | Efecto |
|--------|---------|--------|
| `React.lazy` + `Suspense` en todas las rutas | `app/router/AppRouter.tsx` | Code-splitting por página |
| Page wrappers → import directo UI (sin barrels) | `pages/*.tsx` | Evita arrastrar Leaflet/hermanas en el mismo chunk |
| `manualChunks` (react, leaflet, socket, motion, bootstrap, query) | `vite.config.ts` | Vendors cacheables y paralelos |
| Prefetch al hover/focus del Sidebar | `app/layout/Sidebar.tsx` | UX rápida sin cargar mapa/chat en first paint |

**Rutas pesadas aisladas del entry:** `/mensajes`, `/agente/trabajos`, `/agente/buscar`, `/agente/ofertas`, wallet, reputación, etc.

---

## 5. Seguridad

| Mejora | Archivo | Efecto |
|--------|---------|--------|
| Swagger `/docs` solo fuera de producción | `app.ts` | Superficie de ataque reducida |
| `GET /payments/logs` → `requireRoles(ADMIN)` | `payments/routes.ts` | Evita fuga de payloads webhook |
| Mock confirm solo `!production && isMock()` | `payments/routes.ts` | Cierra confirmación pública en prod |
| Webhook MP fail-closed sin secret en prod | `mercadopago.client.ts` | Obliga firma en producción |
| `join:transaction` valida participación | `socket-realtime.server.ts` | Cierra IDOR de rooms realtime |
| Historial de usuario solo self/admin | `users/service.ts` + controller | Evita IDOR de pagos/tx ajenas |
| Rate limit en `POST /users/register` | `users/routes.ts` | Cierra bypass del auth rate limit |

---

## 6. Escalabilidad (aplicado + backlog)

### Aplicado
- Pool Mongo ya tipado por entorno (`maxPoolSize` 20 prod).
- Queries acotadas (limits) en chats/open-jobs/search.
- Separación de chunks / menos trabajo por instancia web.

### Backlog recomendado (multi-instancia)
| Ítem | Por qué |
|------|---------|
| Redis adapter Socket.io | Pub/sub cross-instance |
| Rate-limit store Redis | Límites globales, no por proceso |
| Cron `expireDueOffers` con flag `RUN_CRONS` + lock | Evitar N workers duplicando trabajo |
| `bcrypt` nativo o worker thread | bcryptjs bloquea event loop bajo storm |
| Compresión/resize de imágenes chat (no data-URL ilimitado) | Memoria cliente + payload API |

---

## 7. Métricas esperadas (cualitativas)

| Área | Antes | Después (esperado) |
|------|-------|---------------------|
| First load JS | Todas las páginas + Leaflet/socket | Shell + vendors; mapa/chat on-demand |
| `GET /transactions` (50 items) | 1 + hasta 50 product finds | 1 + 1 product `$in` |
| Agent search (80 candidatos) | hasta 80 counts | 1 aggregate |
| Open jobs list | N finds de users en loop | 1 find de users |
| Auth middleware | documento User completo | 5 campos lean |
| Superficie prod | `/docs`, mock confirm, logs abiertos | cerrados / restringidos |

---

## 8. Cómo verificar

```bash
# Typecheck
pnpm typecheck

# Bundle (inspeccionar chunks)
pnpm --filter @confiapp/web build

# API unit/coverage
pnpm --filter @confiapp/api test:coverage
```

En el report de Vite deberían aparecer chunks `leaflet`, `socket`, `motion`, `react-vendor`, etc.

---

## 9. Archivos tocados (checklist)

**Web:** `AppRouter.tsx`, `vite.config.ts`, `query-client.ts`, `Sidebar.tsx`, `pages/*`, `useAgentOps.ts`, `MessagesPage.tsx`  
**API:** `app.ts`, `authenticate.ts`, `rate-limit.ts`, `payments/routes.ts`, `mercadopago.client.ts`, `socket-realtime.server.ts`, `transactions/service.ts`, `open-jobs.service.ts`, `search.repository.ts`, `chats/service.ts`, `users/*`, indexes payment/transaction
