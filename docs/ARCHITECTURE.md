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
> se migrará módulo a módulo sin romper lo existente.

---

## `apps/api` — Backend

### Módulos implementados (`src/modules/`)

| Módulo | Rol |
|--------|-----|
| `auth` | Registro, login, verify email, reset password |
| `users` | Perfil, KYC, preferencias, payout methods |
| `transactions` | Ciclo de vida escrow + invites (`WAITING_PARTICIPANT`, …) |
| `payments` | Checkout / hold / webhooks (Mercado Pago / stub) |
| `wallet` | Saldos, retiros, comisiones, export |
| `notifications` | Inbox + `NotificationsService.notify` + gating prefs |
| `chats` | Mensajería + realtime |
| `agents` | Ofertas, open jobs, asignación |
| `reviews` | Calificaciones |
| `audit` | Append-only log de actividad |
| `health` | Healthcheck |

Estructura típica por feature: `{controller,service,repository,routes,dto,validation}.ts`.

Persistencia actual: `src/database/` (Mongoose schemas/models/indexes).  
Realtime: Socket.io cableado en el bootstrap del server (chat + notificaciones).

---

## `apps/web` — Frontend

```text
apps/web/src/
├── main.tsx
├── app/                 # layout, router, providers, styles (global.css)
├── pages/               # re-exports lazy por ruta
├── features/            # UI por dominio
│   ├── landing/
│   ├── auth/
│   ├── profile/         # edición, KYC, wallet section, verify phone stub
│   ├── transactions/    # listado, hub, comprador/vendedor, join, detalle
│   ├── payments/
│   ├── wallet/
│   ├── notifications/   # inbox
│   ├── chat/
│   ├── agent-ops/
│   ├── agent-onboarding/
│   ├── audit/
│   ├── reputation/
│   ├── admin/
│   └── home/
└── shared/              # api client, toast, form helpers, preferences
```

Detalle de rutas, copy vs estados internos y patrones UI: [`WEB_APP.md`](./WEB_APP.md).

---

## `packages/`

| Package | Responsabilidad |
|---|---|
| `@confiapp/shared` | Enums, contratos DTO compartidos, constantes de dominio |
| `@confiapp/database` | Tipos/seed/helpers de Mongo (compartidos con API) |
| `@confiapp/config` | Tooling TS/ESLint/Prettier del monorepo |
| `@confiapp/ui` | Design system React reutilizable (preparado) |

---

## Documentación relacionada

| Doc | Contenido |
|-----|-----------|
| [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | Diseño SaaS a escala |
| [`WEB_APP.md`](./WEB_APP.md) | Estado del producto web / UI |
| [`DEMO_PUBLICO.md`](./DEMO_PUBLICO.md) | Túnel Cloudflare para demos |
| [`design-system/GUIDE.md`](./design-system/GUIDE.md) | Tokens y componentes |
| [`BACKEND_BOOTSTRAP.md`](./BACKEND_BOOTSTRAP.md) | Snapshot histórico del bootstrap Express |
| `.cursor/skills/notifications/` | Cómo emitir notificaciones |

---

## Qué ya está implementado (no rehacer)

- Monorepo pnpm + Turborepo
- API Express con auth, users, transactions, payments, wallet, notifications, chats, agents, reviews, audit, health
- Web Vite con landing + app autenticada (perfil, operaciones, pagos, wallet, chat, notificaciones, auditoría, agentes)
- Persistencia Mongoose + `@confiapp/database` + seed
- Toasts Bootstrap globales (`useAppToast`)
- Design tokens + Bootstrap como UI primaria

## Próximos pasos naturales

1. Completar cableado de eventos de notificación (P0–P2 en skill `notifications/reference.md`).
2. Verificación de teléfono real (hoy stub UI + limpieza de `phoneVerified` al cambiar número).
3. Migrar módulos API hacia carpetas Clean Architecture target.
4. Workers/outbox para email/push reales a escala.
