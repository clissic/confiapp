# ConfiApp

Plataforma de **escrow físico** con control digital de participantes, condiciones, evidencias, estados y auditoría.

## Stack

| Capa | Tecnología |
|------|------------|
| Monorepo | pnpm + Turborepo |
| API | Node · Express · MongoDB · Mongoose · Socket.io (prep) |
| Web | React · Vite · TypeScript · Socket.io-client |
| Arquitectura | Clean Architecture (ver `docs/ARCHITECTURE.md`) |

## Estructura

```text
confiapp/
├── apps/
│   ├── api/       # Backend Express
│   └── web/       # Frontend React + Vite
├── packages/
│   ├── shared/    # Contratos compartidos
│   ├── database/  # Persistencia / seed
│   ├── config/    # Tooling
│   └── ui/        # Design system (prep)
└── docs/
    └── ARCHITECTURE.md
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

Documentación:

- Demo público para clientes (túnel): [`docs/DEMO_PUBLICO.md`](./docs/DEMO_PUBLICO.md)
- Sistema (SaaS, pagos, realtime, escala): [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md)
- Estructura del monorepo: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Contribución: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

