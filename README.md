# ConfiApp

Plataforma de **escrow físico** con control digital de participantes, condiciones, evidencias, estados y auditoría.

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo | pnpm + Turborepo |
| API | Node · Express · MongoDB · Mongoose · Socket.io |
| Web | React · Vite · TypeScript · Bootstrap 5 · TanStack Query · Socket.io-client |
| Arquitectura | Clean Architecture (ver [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)) |

## Qué hace el producto hoy

- **Operaciones** con invite, checklist de entrega y flujo de estados hasta fondeo / progreso.
- **Pagos**: MVP con transferencia Prex + comprobante; Mercado Pago / mock queda en standby (`PAYMENTS_CHECKOUT_MODE`). Wallet de saldos y retiros.
- **Agentes intermediarios**: onboarding, búsqueda, trabajos abiertos, ofertas de asignación; **suspender / cerrar agencia** y **solicitar salida** de una operación (escrow intacto).
- **Chat** y **notificaciones** in-app en tiempo real.
- **KYC** (review admin), **reputación** y **auditoría** (admin).
- **Previsto:** confirmación de identidad de **Agentes** con Identidad Digital Abitab en cada login (step-up; aún no implementado) — [`docs/ID_DIGITAL_AGENTS.md`](./docs/ID_DIGITAL_AGENTS.md).

Detalle de pantallas: [`docs/WEB_APP.md`](./docs/WEB_APP.md).  
Finanzas / cobro MVP: [`docs/FINANCE_MVP_NOTES.md`](./docs/FINANCE_MVP_NOTES.md).  
Visión a escala: [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md).

## Estructura

```text
confiapp/
├── apps/
│   ├── api/       # Backend Express + Socket.io
│   └── web/       # Frontend React + Vite + Bootstrap
├── packages/
│   ├── shared/    # Contratos / fees / constantes
│   ├── database/  # Tipos, seed, helpers Mongo
│   ├── config/    # Tooling ESLint / TS / Prettier
│   └── ui/        # Design system (prep)
├── docs/          # Arquitectura, producto web, design system
└── .cursor/       # Rules + skills para agentes
```

## Arranque

```powershell
pnpm install
docker compose up -d mongo

Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item packages/database/.env.example packages/database/.env

pnpm --filter @confiapp/api dev
pnpm --filter @confiapp/web dev
```

- API: `http://localhost:3000` · Health: `/health` · OpenAPI: `/docs`
- Web: `http://localhost:3001`

Alternativa: `pnpm demo:tunnel` — ver [`docs/DEMO_PUBLICO.md`](./docs/DEMO_PUBLICO.md).

## Documentación

| Doc | Contenido |
|-----|-----------|
| [`docs/WEB_APP.md`](./docs/WEB_APP.md) | Estado del producto web (rutas, UI, estados internos) |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Estructura del monorepo y módulos |
| [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) | Diseño SaaS (pagos, realtime, escala) |
| [`docs/ID_DIGITAL_AGENTS.md`](./docs/ID_DIGITAL_AGENTS.md) | ID Digital Abitab — step-up de identidad de Agentes (diseño; no implementado) |
| [`docs/BACKEND_BOOTSTRAP.md`](./docs/BACKEND_BOOTSTRAP.md) | Snapshot histórico del bootstrap Express |
| [`docs/DEMO_PUBLICO.md`](./docs/DEMO_PUBLICO.md) | Demo público con túnel Cloudflare |
| [`docs/design-system/GUIDE.md`](./docs/design-system/GUIDE.md) | Design system / tokens |
| [`packages/database/ARCHITECTURE.md`](./packages/database/ARCHITECTURE.md) | Modelo Mongo (embebido vs ref) |
| [`apps/api/src/CLEAN_ARCHITECTURE.md`](./apps/api/src/CLEAN_ARCHITECTURE.md) | Capas target de la API |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contribución y convenciones |
| [`TESTING.md`](./TESTING.md) | Vitest / Playwright / cobertura |
| [`.cursor/skills/notifications/`](./.cursor/skills/notifications/) | Cómo emitir notificaciones de dominio |

## Tests

```powershell
pnpm test
pnpm test:coverage
pnpm --filter @confiapp/api test:integration
pnpm test:e2e
```

Detalle en [`TESTING.md`](./TESTING.md).

## Contribución

Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md). No commitear `.env` ni secretos.
