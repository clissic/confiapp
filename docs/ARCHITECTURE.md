# ConfiApp — Arquitectura del repositorio

Stack: **React · Vite · TypeScript · Node · Express · MongoDB · Socket.io**  
UI web: **Bootstrap 5 + react-bootstrap** · tokens en `docs/design-system`  
Estilo: **Clean Architecture** en monorepo (`pnpm` + Turborepo).

## Vista general

```text
confiapp/
├── apps/
│   ├── api/                 # Backend HTTP + realtime (Express, Mongoose, Socket.io)
│   └── web/                 # Frontend (React + Vite + Bootstrap)
├── packages/
│   ├── shared/              # Contratos/tipos/constantes cross-app
│   ├── database/            # Modelos/seed/utilidades de persistencia compartidas
│   ├── config/              # ESLint / TS / Prettier compartidos
│   └── ui/                  # Design system / componentes reutilizables (prep)
├── docs/                    # Arquitectura, design system, producto web
├── .cursor/                 # Rules + skills para agentes
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Regla de dependencia (Clean Architecture)

```text
presentation  →  application  →  domain
      ↓               ↓
infrastructure ───────┘
```

- **Domain**: no conoce frameworks ni DB.
- **Application**: orquesta casos de uso; define puertos (interfaces).
- **Infrastructure**: implementa puertos (Mongo/Mongoose, Socket.io, storage, crypto).
- **Presentation**: HTTP (Express) y realtime (Socket.io gateways).
- **Composition root** (`server.ts` / `composition/`): cablea dependencias.

> Estado actual: los módulos en `apps/api/src/modules/*` implementan
> controller → service → repository. Las carpetas `domain/`, `application/`,
> `infrastructure/` y `presentation/` son el **target** Clean Architecture;
> se migrará módulo a módulo sin romper lo existente. Ver
> [`apps/api/src/CLEAN_ARCHITECTURE.md`](../apps/api/src/CLEAN_ARCHITECTURE.md).

---

## `apps/api` — Backend

### Módulos (`src/modules/`)

| Módulo | Rol |
|--------|-----|
| `auth` | Registro, login, verify email, reset password |
| `users` | Perfil, KYC (review admin), preferencias, payout methods |
| `transactions` | Ciclo de vida escrow + invites + checklist |
| `payments` | Checkout / hold / webhooks (Mercado Pago / mock) |
| `wallet` | Saldos, retiros, comisiones, export |
| `notifications` | Inbox + `NotificationsService.notify` + gating prefs |
| `chats` | Mensajería + realtime |
| `agents` | Onboarding, búsqueda, open jobs, ofertas, salida de op |
| `reviews` | Calificaciones / reputación |
| `audit` | Append-only log de actividad |
| `health` | Healthcheck |
| `evidence` | Stub (`/status`) — dominio preparado, UX pendiente |
| `disputes` | Stub (`/status`) — dominio preparado, UX pendiente |

Estructura típica por feature: `{controller,service,repository,routes,dto,validation}.ts`.

### Agentes — endpoints relevantes (`/agents`)

| Método | Ruta | Notas |
|--------|------|--------|
| GET/PUT | `/onboarding` | Estado + `activeJobsCount` / lista corta |
| POST | `/onboarding/submit` | Alta como agente |
| POST | `/onboarding/suspend` \| `/resume` \| `/close` | Soft pause / hard close (`409 ACTIVE_JOBS` si hay ops) |
| GET | `/search` | Ranking geo + capacidad |
| GET | `/jobs/open` | Trabajos sin intermediario ACCEPTED (incl. post-withdraw) |
| POST | `/jobs/:code/accept` | Tomar trabajo abierto |
| POST | `/jobs/:code/withdraw` | Agente sale (`REMOVED`); escrow intacto; reabre oferta/open-jobs |
| POST | `/assignments/offer` \| `…/reassign` | Cola de ofertas |
| GET/POST | `/offers…` | Inbox de ofertas del agente (API; web usa open jobs como entry) |

Helper compartido de carga: `modules/agents/agent-jobs.ts` (solo `INTERMEDIARY` + `ACCEPTED` en statuses activos).

Persistencia: `src/database/` (Mongoose schemas/models/indexes).  
Realtime: Socket.io (chat + notificaciones + eventos de agente en room de tx).

---

## `apps/web` — Frontend

```text
apps/web/src/
├── main.tsx
├── app/                 # layout, router, providers, styles (global.css)
├── pages/               # re-exports lazy por ruta
├── features/            # UI por dominio
│   ├── landing/
│   ├── auth/            # RequireAuth, RequireAdmin, RequireAgent
│   ├── profile/
│   ├── transactions/
│   ├── payments/
│   ├── wallet/
│   ├── notifications/
│   ├── chat/
│   ├── agent-ops/       # búsqueda, open jobs
│   ├── agent-onboarding/# alta + panel suspend/cerrar
│   ├── audit/
│   ├── reputation/
│   ├── admin/
│   └── home/
└── shared/              # api client, toast, form helpers, preferences
```

Detalle de rutas y patrones UI: [`WEB_APP.md`](./WEB_APP.md).

---

## `packages/`

| Package | Responsabilidad |
|---|---|
| `@confiapp/shared` | Enums, contratos DTO compartidos, fees / constantes |
| `@confiapp/database` | Tipos/seed/helpers de Mongo (compartidos con API) |
| `@confiapp/config` | Tooling TS/ESLint/Prettier del monorepo |
| `@confiapp/ui` | Design system React reutilizable (preparado) |

Modelo de datos: [`packages/database/ARCHITECTURE.md`](../packages/database/ARCHITECTURE.md).

---

## Documentación relacionada

| Doc | Contenido |
|-----|-----------|
| [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | Diseño SaaS a escala |
| [`WEB_APP.md`](./WEB_APP.md) | Estado del producto web / UI |
| [`BACKEND_BOOTSTRAP.md`](./BACKEND_BOOTSTRAP.md) | Snapshot histórico del bootstrap Express |
| [`DEMO_PUBLICO.md`](./DEMO_PUBLICO.md) | Túnel Cloudflare para demos |
| [`design-system/GUIDE.md`](./design-system/GUIDE.md) | Tokens y componentes |
| [`.cursor/skills/notifications/`](../.cursor/skills/notifications/) | Cómo emitir notificaciones |
| [`../TESTING.md`](../TESTING.md) | Tests |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Contribución |

---

## Qué ya está implementado (no rehacer)

- Monorepo pnpm + Turborepo
- API Express con auth, users, transactions, payments, wallet, notifications, chats, agents (incl. salida/cierre), reviews, audit, health
- Web Vite con landing + app autenticada (perfil, operaciones, pagos, wallet, chat, notificaciones, auditoría, agentes)
- Salvaguardas de salida de agente: suspend soft, close hard, withdraw por operación
- Persistencia Mongoose + `@confiapp/database` + seed
- Toasts Bootstrap globales (`useAppToast`)
- Design tokens + Bootstrap como UI primaria

## Próximos pasos naturales

1. Completar cableado de eventos de notificación restantes (P0–P2 en skill `notifications/reference.md`).
2. Verificación de teléfono real (hoy stub UI + limpieza de `phoneVerified` al cambiar número).
3. UI/API reales de **evidence** y **disputes** (hoy stubs `/status`).
4. Migrar módulos API hacia carpetas Clean Architecture target.
5. Workers/outbox para email/push reales a escala.
