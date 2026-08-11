# API — capas Clean Architecture

Estas carpetas definen el **target** arquitectónico.

| Capa | Contenido |
|------|-----------|
| `domain/` | Entidades, VOs, puertos de repositorio, eventos, errores |
| `application/` | Use cases, DTOs de aplicación, ports (Hasher, Realtime…) |
| `infrastructure/` | Mongoose, Socket.io, storage, security, logger |
| `presentation/` | HTTP + gateways realtime |
| `composition/` | Wiring al boot |

La implementación activa hoy vive en:

- `src/modules/*` — features (auth, users, transactions, payments, wallet, notifications, chats, agents, reviews, audit, health; stubs evidence/disputes)
- `src/database/*` — persistencia Mongoose
- `src/infrastructure/*` — realtime, email, payments, security (parcialmente ya extraído)
- `src/middleware/*`, `src/shared/*`, `src/utils/*`

Migración: feature por feature, sin big-bang. Estado del monorepo: [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md).
