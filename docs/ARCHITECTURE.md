# ConfiApp — Arquitectura del repositorio

Stack: **React · Vite · TypeScript · Node · Express · MongoDB · Socket.io**  
Estilo: **Clean Architecture** en monorepo (`pnpm` + Turborepo).

## Vista general

```text
confiapp/
├── apps/
│   ├── api/                 # Backend HTTP + realtime (Express, Mongoose, Socket.io)
│   └── web/                 # Frontend (React + Vite)
├── packages/
│   ├── shared/              # Contratos/tipos/constantes cross-app
│   ├── database/            # Modelos/seed/utilidades de persistencia compartidas
│   ├── config/              # ESLint / TS / Prettier compartidos
│   └── ui/                  # Design system / componentes reutilizables (prep)
├── docs/                    # Documentación de arquitectura y ADRs
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

> Estado actual: los módulos en `apps/api/src/modules/*` ya implementan el flujo
> controller → service → repository. Las carpetas `domain/`, `application/`,
> `infrastructure/` y `presentation/` son el **target** Clean Architecture;
> se migrará módulo a módulo sin romper lo existente.

---

## `apps/api` — Backend

```text
apps/api/src/
├── app.ts                         # Composition HTTP (Express app)
├── server.ts                      # Bootstrap: DB + HTTP + (futuro) Socket.io
│
├── domain/                        # Capa de dominio (pura)
│   ├── entities/                  # User, Transaction, Evidence, Dispute…
│   ├── value-objects/             # Email, Money (futuro), TransactionCode…
│   ├── repositories/              # Interfaces (puertos de persistencia)
│   ├── events/                    # Domain events (TransactionStatusChanged…)
│   └── errors/                    # Errores de dominio
│
├── application/                   # Casos de uso / aplicación
│   ├── use-cases/
│   │   ├── auth/
│   │   ├── users/                 # RegisterUser, GetUser, UpdateUser…
│   │   ├── transactions/
│   │   ├── evidence/
│   │   └── disputes/
│   ├── dto/                       # DTOs de aplicación (entrada/salida)
│   └── ports/                     # Puertos: Hasher, Mailer, RealtimePublisher…
│
├── infrastructure/                # Adaptadores concretos
│   ├── database/                  # (alias/migración de src/database)
│   ├── realtime/                  # Socket.io server, rooms, emitters
│   ├── storage/                   # Evidencias (S3/local) — futuro
│   ├── security/                  # JWT, bcrypt adapters
│   └── logger/                    # Logger estructurado
│
├── presentation/                  # Adaptadores de entrada
│   ├── http/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── validators/
│   └── realtime/                  # Handlers Socket.io (eventos cliente)
│
├── composition/                   # Wiring / DI manual
│
├── modules/                       # ★ Implementación actual por feature
│   ├── auth|users|transactions|evidence|disputes|health
│   └── */{controller,service,repository,routes,dto,validation}.ts
│
├── database/                      # ★ Persistencia actual (Mongoose)
│   ├── connection.ts
│   ├── database.module.ts
│   ├── schemas|indexes|models/
│
├── middleware/                    # ★ Middlewares Express actuales
├── shared/                        # config, errors compartidos en API
└── utils/                         # helpers (password, logger, openapi)
```

### Responsabilidades clave (API)

| Directorio | Responsabilidad |
|---|---|
| `domain/` | Reglas de negocio puras, entidades e interfaces de repositorio |
| `application/use-cases/` | Orquestación de un caso de uso (1 acción de negocio) |
| `application/ports/` | Contratos hacia afuera (hash, realtime, storage) |
| `infrastructure/realtime/` | Socket.io: conexión, rooms por `transactionId`, broadcasts |
| `infrastructure/database/` | Implementación Mongoose de los puertos de persistencia |
| `presentation/http/` | Controllers, routes, validation HTTP |
| `presentation/realtime/` | Eventos entrantes Socket.io → use cases |
| `modules/` | Features ya implementadas (Users, Health, scaffolds) |
| `database/` | Conexión Mongo + schemas/indexes/models actuales |
| `composition/` | Ensambla use cases + repos + HTTP/Socket al boot |

---

## `apps/web` — Frontend (React + Vite)

```text
apps/web/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx                   # Entry Vite
│   ├── app/                       # Shell de aplicación
│   │   ├── providers/             # QueryClient, Auth, Socket providers
│   │   ├── router/                # React Router
│   │   └── styles/                # tokens / global CSS
│   ├── pages/                     # Rutas/páginas (composition de features)
│   ├── widgets/                   # Bloques UI compuestos (header, sidebars)
│   ├── features/                  # Casos de uso de UI por dominio
│   │   ├── auth/
│   │   ├── users/
│   │   ├── transactions/
│   │   ├── evidence/
│   │   └── disputes/
│   ├── entities/                  # Modelos de cliente + UI atómica de entidad
│   │   ├── user/
│   │   └── transaction/
│   └── shared/
│       ├── api/                   # HTTP client (fetch/axios) hacia Express
│       ├── realtime/              # Socket.io-client
│       ├── config/                # env (VITE_*)
│       ├── lib/                   # utils, dates, formatters
│       └── ui/                    # primitivos locales (si no vienen de packages/ui)
```

### Responsabilidades clave (Web)

| Directorio | Responsabilidad |
|---|---|
| `app/` | Bootstrap, providers globales, router |
| `pages/` | Páginas por ruta; ensamblan features/widgets |
| `features/` | Flujos de producto (login, crear operación, subir evidencia) |
| `entities/` | Representación de entidades de negocio en el cliente |
| `widgets/` | UI reutilizable de alto nivel |
| `shared/api/` | Cliente REST tipado contra `apps/api` |
| `shared/realtime/` | Cliente Socket.io (estado de operación en vivo) |
| `shared/ui/` | Componentes base locales |

---

## `packages/`

| Package | Responsabilidad |
|---|---|
| `@confiapp/shared` | Enums, contratos DTO compartidos, constantes de dominio |
| `@confiapp/database` | Tipos/seed/helpers de Mongo (compartidos con API) |
| `@confiapp/config` | Tooling TS/ESLint/Prettier del monorepo |
| `@confiapp/ui` | Design system React reutilizable (preparado) |

---

## Realtime (Socket.io)

Flujo previsto:

1. Cliente (`web/shared/realtime`) se conecta al namespace Socket.io del API.
2. Servidor (`api/infrastructure/realtime`) autentica y une rooms `transaction:{id}`.
3. Cambios de estado / evidencia / disputa emiten eventos desde use cases vía puerto `RealtimePublisher`.
4. UI actualiza sin polling.

---

## Qué ya está implementado (no rehacer)

- Monorepo pnpm + Turborepo
- API Express con health, middleware, rate-limit, users register/get/patch
- Persistencia Mongoose (`database/`) + modelos de dominio
- Package `@confiapp/database` + seed

## Próximos pasos naturales

1. Scaffold Vite real en `apps/web` (entry + deps).
2. Socket.io server en `infrastructure/realtime` + composition en `server.ts`.
3. Migrar `modules/users` → `application/use-cases/users` + ports.
