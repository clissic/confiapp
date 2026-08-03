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

- `src/modules/*` — features
- `src/database/*` — persistencia
- `src/middleware/*`, `src/shared/*`, `src/utils/*`

Migración: feature por feature, sin big-bang.
