# ConfiApp

Plataforma de **escrow físico** con control digital de participantes, condiciones, evidencias, estados y auditoría.

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo | pnpm + Turborepo |
| API | Node · Express · MongoDB · Mongoose · Socket.io |
| Web | React · Vite · TypeScript · Bootstrap 5 · TanStack Query · Socket.io-client |
| Arquitectura | Clean Architecture (ver `docs/ARCHITECTURE.md`) |

## Estructura

```text
confiapp/
├── apps/
│   ├── api/       # Backend Express
│   └── web/       # Frontend React + Vite + Bootstrap
├── packages/
│   ├── shared/    # Contratos compartidos
│   ├── database/  # Persistencia / seed
│   ├── config/    # Tooling
│   └── ui/        # Design system (prep)
└── docs/
    ├── ARCHITECTURE.md
    ├── SYSTEM_ARCHITECTURE.md
    ├── WEB_APP.md
    ├── DEMO_PUBLICO.md
    └── design-system/
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

- API: `http://localhost:3000` · Health: `/health` · Docs: `/docs`
- Web: `http://localhost:3001`

## Documentación

| Doc | Contenido |
|-----|-----------|
| [`docs/WEB_APP.md`](./docs/WEB_APP.md) | Estado del producto web (rutas, UI, estados internos) |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Estructura del monorepo |
| [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) | Diseño SaaS (pagos, realtime, escala) |
| [`docs/DEMO_PUBLICO.md`](./docs/DEMO_PUBLICO.md) | Demo público con túnel Cloudflare |
| [`docs/design-system/GUIDE.md`](./docs/design-system/GUIDE.md) | Design system |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contribución |
| [`TESTING.md`](./TESTING.md) | Tests |
