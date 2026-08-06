# Contributing to ConfiApp

Gracias por contribuir. Este documento define cómo trabajamos en el monorepo para mantener calidad, trazabilidad y una arquitectura escalable.

Documentación relacionada:

- [Estado del producto web](./docs/WEB_APP.md)
- [Arquitectura de sistema](./docs/SYSTEM_ARCHITECTURE.md)
- [Estructura del repositorio](./docs/ARCHITECTURE.md)
- [Design system](./docs/design-system/GUIDE.md)

---

## Tabla de contenidos

1. [Principios](#1-principios)
2. [Setup local](#2-setup-local)
3. [Convenciones de código](#3-convenciones-de-código)
4. [Nomenclatura](#4-nomenclatura)
5. [Organización de componentes (Frontend)](#5-organización-de-componentes-frontend)
6. [Organización del Backend](#6-organización-del-backend)
7. [ESLint](#7-eslint)
8. [Prettier](#8-prettier)
9. [Git Flow](#9-git-flow)
10. [Conventional Commits](#10-conventional-commits)
11. [Pull Requests](#11-pull-requests)
12. [Buenas prácticas](#12-buenas-prácticas)
13. [Checklist antes de pedir review](#13-checklist-antes-de-pedir-review)

---

## 1. Principios

- **Dominio primero:** las reglas de escrow, pagos y disputas viven en la capa de aplicación/dominio, no en controllers React ni en schemas sueltos.
- **Cambios pequeños:** PRs enfocados; un problema = un PR cuando sea posible.
- **No romper el monorepo:** `pnpm build`, `pnpm lint` y `pnpm typecheck` deben pasar en los paquetes tocados.
- **Seguridad por defecto:** nunca commitear secretos, `.env`, claves PSP ni dumps con PII.
- **Observabilidad:** logs estructurados; no `console.log` de depuración en `main`.

---

## 2. Setup local

Requisitos: Node ≥ 20, pnpm 9, MongoDB (Docker Compose disponible).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/database/.env.example packages/database/.env
docker compose up -d mongo
pnpm --filter @confiapp/api dev
pnpm --filter @confiapp/web dev
```

No subas archivos `.env` reales. Usá solo `.env.example` como plantilla.

---

## 3. Convenciones de código

### TypeScript

- `strict` habilitado; evitar `any`. Preferir `unknown` + narrowing.
- Preferir `import type` cuando solo se usan tipos (salvo DI Nest-like / emit decorators si aplicara).
- Funciones y módulos **pequeños**; un archivo = una responsabilidad clara.
- Errores de dominio/aplicación tipados; no tragar excepciones en silencio.
- Async/await sobre callbacks; siempre manejar rechazos (p. ej. `asyncHandler` en Express).

### Estilo general

- Inmutabilidad preferida en transforms de datos.
- Early return sobre nesting profundo.
- Comentarios solo para **porqués** no obvios; el código debe explicar el qué.
- No dejar `TODO` sin ticket/referencia.

### Tests (cuando existan)

- Unitarios para use cases y dominio.
- Integración para repositorios y webhooks de pago (firma, idempotencia).
- Nombrar: `*.spec.ts` / `*.test.ts` junto al módulo o en `__tests__/`.

---

## 4. Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Archivos / carpetas | `kebab-case` | `user.repository.ts`, `rate-limit.ts` |
| Componentes React | `PascalCase` | `TransactionStatusBadge.tsx` |
| Hooks | `use` + `PascalCase` | `useTransactionRoom.ts` |
| Funciones / variables | `camelCase` | `hashPassword`, `fullName` |
| Tipos / Interfaces | `PascalCase`; interfaces de modelo `IUser` o `User` (consistente por capa) | `RegisterUserDto` |
| Constantes | `SCREAMING_SNAKE` solo globales | `MAX_EVIDENCE_BYTES` |
| Enums | `PascalCase` nombre; valores `SCREAMING_SNAKE` | `TransactionStatus.FUNDED` |
| Colecciones Mongo | `snake` plural vía `@map` / `collection:` | `audit_logs` |
| Eventos Socket | `dominio:acción` | `transaction:updated` |
| Env vars | `SCREAMING_SNAKE` | `DATABASE_URL`, `VITE_API_URL` |
| Packages | `@confiapp/<nombre>` | `@confiapp/api` |

### Endpoints HTTP

- Sustantivos en plural: `/users`, `/transactions`.
- Acciones claras: `POST /users/register`, no verbos inventados en el path salvo casos de negocio (`/register`).
- IDs en path: `/users/:id`.
- Versionado futuro: prefijo `/v1`.

---

## 5. Organización de componentes (Frontend)

Estructura objetivo en `apps/web/src`:

```text
app/         → shell, providers, router, estilos globales
pages/       → rutas; componen features/widgets (poco negocio)
features/    → flujos de producto (auth, transactions, …)
entities/    → modelo de cliente + UI atómica de entidad
widgets/     → bloques compuestos reutilizables
shared/      → api, realtime, ui, lib, config
```

### Reglas

1. **pages** no hablan con Mongo ni conocen Express: solo features/shared.
2. **features** encapsulan un caso de uso de UI (formulario + llamadas API + estado).
3. **shared/ui** = primitivos sin reglas de negocio.
4. **shared/api** = único lugar para `fetch`/client HTTP.
5. **shared/realtime** = único lugar para Socket.io-client.
6. No importar desde `pages` hacia abajo rompiendo capas (evitar `features` → `pages`).
7. Preferir composition over inheritance; props explícitas; evitar prop drilling profundo (context acotado).

### Componentes

- Un componente visual exportado por archivo.
- Sufijos útiles: `*.page.tsx` (opcional), `*Form.tsx`, `*List.tsx`, `*Badge.tsx`.
- Side-effects (subscriptions socket) en hooks o providers, no en el render puro.

---

## 6. Organización del Backend

Estructura activa y target (ver `docs/ARCHITECTURE.md`):

```text
modules/<feature>/
  controller.ts
  service.ts
  repository.ts
  routes.ts
  dto.ts
  validation.ts

database/          → conexión, schemas, indexes, models
middleware/        → cross-cutting HTTP
shared/            → config, errors
```

Target Clean Architecture: `domain/`, `application/`, `infrastructure/`, `presentation/`.

### Reglas

1. Controllers delgados: parseo HTTP → service/use case → response.
2. Validación de entrada en el borde (`validation.ts` + Zod).
3. Repositorios = persistencia; no envían emails ni cobran pagos.
4. Side-effects de infraestructura (mail, socket, PSP) detrás de puertos cuando se migre a CA.
5. Endpoints financieros: **idempotencia** y sin lógica secreta en el cliente.
6. Nunca loguear passwords, tokens ni cuerpos de webhooks sin redactar.

---

## 7. ESLint

- Configuración compartida: `@confiapp/config` (flat config ESLint 9).
- Cada app/package puede extender reglas (p. ej. React hooks en `web`, off de `consistent-type-imports` donde rompa DI).
- Correr: `pnpm lint` o `pnpm --filter @confiapp/<pkg> lint`.
- **No** desactivar reglas en bloque sin comentario justificando.
- Preferir fix automático: `eslint --fix` cuando sea seguro.
- CI debe fallar con warnings tratados como error (`--max-warnings 0`).

---

## 8. Prettier

- Config raíz: `.prettierrc` (single quotes, trailing commas, printWidth 100, LF).
- Ignorar: `.prettierignore` (`dist`, `coverage`, lockfiles, etc.).
- Formatear: `pnpm format` · verificar: `pnpm format:check`.
- Editor: format on save con Prettier como default formatter (`.vscode/settings.json`).
- **No mezclar** discusiones de estilo en PRs de negocio: Prettier es la fuente de verdad.

---

## 9. Git Flow

Usamos un Git Flow simplificado adaptado a SaaS continuo:

| Rama | Rol |
|------|-----|
| `main` | Producción; protegida; solo merge vía PR |
| `develop` | Integración (si el equipo la usa); alternativa: trunk-based sobre `main` + feature flags |
| `feature/<ticket>-descripcion-corta` | Trabajo de feature |
| `fix/<ticket>-descripcion` | Bugfix |
| `hotfix/<ticket>-descripcion` | Fix urgente desde `main` |
| `release/x.y.z` | Opcional: estabilización |

### Flujo habitual

1. Crear rama desde `main` (o `develop`):  
   `feature/123-user-register`
2. Commits pequeños con Conventional Commits.
3. Push + Pull Request hacia la rama base.
4. Review + CI verde + squash o merge commit según acuerdo del equipo.
5. Borrar la rama remota tras el merge.

### Protecciones recomendadas en `main`

- Require PR
- Require status checks (`lint`, `typecheck`, `build`)
- No force-push
- Require review de al menos 1 persona en cambios de pagos/auth

---

## 10. Conventional Commits

Formato:

```text
<type>(<scope>)!: <description>

[optional body]

[optional footer]
```

### Types permitidos

| Type | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `style` | Formato (no cambia significado) |
| `refactor` | Cambio de código sin feat/fix |
| `perf` | Performance |
| `test` | Tests |
| `build` | Build system o dependencias |
| `ci` | CI |
| `chore` | Mantenimiento varios |
| `revert` | Revertir commit |

### Scopes sugeridos

`api`, `web`, `users`, `auth`, `transactions`, `evidence`, `disputes`, `payments`, `realtime`, `database`, `shared`, `ui`, `docs`

### Ejemplos

```text
feat(users): add PATCH /users/:id endpoint
fix(api): handle mongoose duplicate key on register
docs(architecture): add system design for payments
chore(web): scaffold vite clean architecture folders
feat(payments)!: change ledger entry schema
```

`!` o footer `BREAKING CHANGE:` marca breaking changes.

---

## 11. Pull Requests

### Título

Alineado a Conventional Commits cuando sea posible.

### Cuerpo (plantilla sugerida)

```markdown
## Summary
- Qué cambia y por qué

## Test plan
- [ ] lint / typecheck / build
- [ ] escenario manual X

## Risk
- Bajo / medio / alto (auth, pagos, migraciones)
```

### Reglas

- Un PR no debe mezclar refactor masivo + feature + upgrade de deps.
- Migraciones de datos/índices Mongo documentadas en el PR.
- Screenshots o clips para cambios UI.
- Si toca pagos/KYC: reviewer con contexto de compliance.

---

## 12. Buenas prácticas

### Seguridad

- Validar **toda** entrada en el borde.
- Hashear passwords con bcrypt/argon2; nunca loguearlos.
- Secretos solo por env / secret manager.
- Uploads: allowlist MIME, tamaño máximo, URLs prefirmadas (no proxy eterno).
- Webhooks de pago: verificar firma + idempotencia.

### Datos

- Soft delete donde haga falta forense; audit append-only.
- Índices alineados a queries reales; medir con explain.
- No embeber colecciones que crecen sin cota (evidencias → refs).

### Frontend

- No guardar tokens de larga duración en `localStorage` si hay alternativa httpOnly.
- Estados de carga/error/vacío explícitos.
- Accesibilidad básica (labels, foco, contraste).

### Backend

- APIs stateless; sesiones/blacklist en Redis a escala.
- Side-effects asíncronos vía cola cuando no sean UX-críticos síncronos.
- Timeouts y retries con backoff hacia PSP y storage.

### Performance

- Evitar N+1; proyectar campos.
- Code-splitting en rutas web.
- Caché con TTL corto en lecturas públicas.

### Colaboración

- PRs &lt; ~400 líneas netas cuando sea posible.
- Documentar ADRs cortos en `docs/` para decisiones grandes (pagos, sharding, multi-región).

---

## 13. Checklist antes de pedir review

- [ ] `pnpm --filter <pkg> lint`
- [ ] `pnpm --filter <pkg> typecheck`
- [ ] `pnpm --filter <pkg> build` (si aplica)
- [ ] Prettier / format OK
- [ ] Sin secretos en el diff
- [ ] Commits Conventional Commits
- [ ] Tests o plan de prueba manual descrito
- [ ] Docs actualizados si cambia arquitectura o contratos públicos

---

## Código de conducta (resumen)

Sé respetuoso en reviews. Criticá ideas y código, no personas. Asumí buena intención. Pedí aclaraciones antes de bloquear.

---

¿Dudas de arquitectura? Abrí una issue o un ADR draft en `docs/` antes de un PR grande.
