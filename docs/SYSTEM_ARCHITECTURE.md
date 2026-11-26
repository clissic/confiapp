# ConfiApp — Arquitectura de sistema

Documento de diseño de arquitectura (visión a escala + decisiones).  
Estado implementado del monorepo y de la web: [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`WEB_APP.md`](./WEB_APP.md).

Plataforma SaaS de **intermediación segura** para compras entre particulares (encuentro físico mediado por Agente + control digital).

**Objetivo de escala:** cientos de miles de usuarios activos, picos concurrentes altos en operaciones en curso, evidencias multimedia y eventos en tiempo real.

> **Estado de producto (2026-11):** el dinero del **producto** no se custodia en la app. Solo se cobra/gestiona la **contratación del Agente**. El resguardo monetario del precio (`ESCROW_FULL`) queda como capacidad de arquitectura / roadmap.

---

## 1. Visión del producto (contexto)

Dos particulares (y un intermediario físico — el Agente) acuerdan una operación. ConfiApp:

1. Formaliza el acuerdo (condiciones, participantes, estados).
2. Cobra y gestiona la **contratación del Agente**; en el futuro podrá custodiar también el precio del producto (escrow monetario).
3. Exige **evidencias** (fotos, documentos, geolocalización).
4. Gestiona **disputas** y deja **auditoría** inmutable.
5. Notifica y sincroniza en tiempo real a las partes.

El riesgo principal no es solo técnico: es de **confianza, fraude, compliance (pagos/KYC) y evidencia forense**. La arquitectura prioriza trazabilidad, aislamiento de secretos y separación de dominios.

---

## 2. Arquitectura general

### 2.1 Estilo

| Decisión | Elección | Justificación |
|---------|----------|---------------|
| Estilo de código | **Clean Architecture** + módulos por bounded context | Domina el negocio (transacción, disputa, pago) sobre el framework; facilita tests y evolución |
| Empaquetado | **Monorepo** (pnpm + Turborepo) | Contratos compartidos, un solo pipeline, onboarding único; a escala se pueden extraer servicios sin reescribir dominio |
| Runtime API | **Node.js + Express + TypeScript** | Equipo MERN, I/O bound (API + websockets + uploads), tipado extremo a extremo |
| Frontend | **React + Vite + TypeScript** | UX rica, ecosistema maduro, builds rápidos; SPA + BFF-lite vía API |
| Persistencia primaria | **MongoDB** | Documentos agregados naturales (Transaction + participantes + historial resumido); escala horizontal con sharding |
| Tiempo real | **Socket.io** (sobre Engine.IO / WebSocket) | Rooms por operación, fallbacks, modelo mental simple para el equipo |
| Colas / async | **Cola de trabajos** (BullMQ + Redis) | Desacoplar emails, webhooks de pago, procesamiento de media, geocoding |
| Caché / sesión / rate-limit | **Redis** | Sesiones/blacklist JWT, rate limits distribuidos, pub/sub Socket.io sticky-friendly |
| Objetos / evidencias | **Object storage** (S3-compatible) | No servir binarios desde Node; CDN delante |
| Observabilidad | OpenTelemetry + logs estructurados + métricas + tracing | Imprescindible a 10⁵ usuarios |

### 2.2 Diagrama lógico

```text
                    ┌─────────────┐
   Web / Mobile ───►│  CDN + WAF  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
        ┌──────────┐              ┌──────────┐
        │  Web SPA │              │  API GW  │  (TLS, rate-limit, auth)
        │ React    │              │  / Edge  │
        └────┬─────┘              └────┬─────┘
             │ REST / WS                │
             └──────────┬───────────────┘
                        ▼
              ┌─────────────────────┐
              │   API cluster       │  Express (stateless)
              │   + Socket.io       │  sticky o Redis adapter
              └──────────┬──────────┘
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────────┐
   │ MongoDB  │   │  Redis   │   │ Object Store │
   │ (primary)│   │ cache/Q  │   │ (evidencias) │
   └──────────┘   └────┬─────┘   └──────────────┘
                       │
                       ▼
                ┌──────────────┐     ┌─────────────────┐
                │ Worker pool  │────►│ Providers        │
                │ BullMQ       │     │ Stripe/MP, KYC,  │
                └──────────────┘     │ Push, Email, SMS │
```

### 2.3 Bounded contexts (dominio)

1. **Identity & Access** — registro, login, sesiones, roles, KYC.
2. **Transactions (Escrow físico)** — ciclo de vida de la operación.
3. **Evidence** — captura, validación, retención de pruebas.
4. **Disputes** — mediación, estados, resolución.
5. **Payments** — intención de pago, captura, reembolso, ledger interno.
6. **Notifications** — preferencias, delivery multi-canal.
7. **Location** — puntos de encuentro, geofences, anti-fraude espacial.
8. **Audit** — append-only, compliance.

Cada contexto expone **puertos** (interfaces). Los adaptadores (Mongo, Stripe, S3, Socket.io) viven en infraestructura. Así se puede sustituir Mercado Pago por Stripe o viceversa sin reescribir el dominio.

### 2.4 Estrategia de escala (10⁵ usuarios)

| Capa | Estrategia |
|------|------------|
| API | Horizontal pod/VM; **stateless**; secretos en vault/env; HPA por CPU/RPS/lag de cola |
| Socket.io | **Redis adapter**; sticky sessions en LB *o* adapter puro; rooms `transaction:{id}` |
| MongoDB | Replica set → shards por `userId` / `transactionId` hash; índices compuestos por query real |
| Redis | Cluster o managed; separación lógica cache vs queues vs pub/sub |
| Workers | Escalado independiente del API (media, webhooks, notificaciones) |
| Lecturas | Caché de perfiles públicos; projections; evitar N+1 con agregados bien modelados |
| Escrituras calientes | Un documento `Transaction` como agregado; eventos de dominio → cola → proyecciones |
| Multi-región (fase 2) | Active-passive DB + CDN global; latencia de pagos siempre regional al PSP |

**Por qué no microservicios el día 1:** con un equipo pequeño, el costo de red, consistencia distribuida y ops supera el beneficio. El monorepo modular + workers permite **extraer** Payments o Notifications cuando el throughput o el compliance lo exijan (strangler).

---

## 3. Frontend

### 3.1 Stack y estructura

- **React + Vite + TypeScript**
- Organización: `app / pages / features / entities / widgets / shared` (híbrido Clean + Feature-Sliced)
- Estado servidor: TanStack Query (cache HTTP, revalidación)
- Estado UI local: React state / context mínimo
- Realtime: Socket.io-client suscrito a rooms de operación
- Formularios: validación alineada a contratos Zod compartidos (`packages/shared`)

### 3.2 Decisiones

| Tema | Decisión | Justificación |
|------|----------|---------------|
| SPA vs SSR | SPA + API | Producto app-like; SEO no es crítico en flujos autenticados |
| Auth en cliente | Access token corto + refresh httpOnly cookie (o BFF) | Reduce XSS sobre refresh; access en memoria |
| Design system | `packages/ui` | Consistencia multi-superficie (web, futuro admin) |
| Offline | No full offline day-1 | Evidencias requieren red; cola local solo para drafts |
| Admin | App separada o `/admin` con code-splitting | Menor superficie de ataque, permisos distintos |

### 3.3 Superficies UX críticas

- Onboarding + verificación (email; teléfono UI stub → backend pendiente)
- Crear / aceptar operación (comprador/vendedor + invite + checklist)
- Checkout / fondeo
- Agentes: onboarding, open jobs, suspender/cerrar agencia, salida/reasignación por operación
- Subida de evidencias con progreso *(roadmap — API stub)*
- Mapa de punto de encuentro / open jobs
- Live status de la operación (Socket)
- Centro de disputas *(roadmap — API stub)* e **inbox de notificaciones** (`/notificaciones` + campana)
- Wallet, auditoría, reputación, perfil/KYC

Detalle de rutas y patrones UI actuales: [`WEB_APP.md`](./WEB_APP.md).

---

## 4. Backend

### 4.1 Capas Clean Architecture

```text
presentation (HTTP / Socket) → application (use cases) → domain
                                    ↓
                             infrastructure (Mongo, Redis, S3, PSP, mail…)
```

### 4.2 API HTTP

- Express modular por contexto
- Validación de entrada (Zod) en el borde
- Errores tipados → problem+json / envelope estable
- Rate limiting por IP + por usuario (Redis)
- Idempotency-Key en endpoints financieros y de creación de operación
- Versionado `/v1` cuando haya clientes externos

### 4.3 Workers

Procesos separados del HTTP server:

- Webhooks de pago (verificar firma, actualizar ledger)
- Transcoding / virus scan / thumbnails de evidencias
- Envío de notificaciones
- Jobs de expiración (operación no aceptada, fondeo timeout)
- Geocoding / reverse geocoding batch

**Justificación:** un webhook lento o un upload pesado no debe tumbar el event loop del API ni bloquear WebSockets.

### 4.4 Consistencia

- **Agregado Transaction** como fuente de verdad del ciclo de vida.
- Cambios de estado vía máquina de estados explícita (solo transiciones válidas).
- Side-effects (notificar, cobrar, emitir socket) **después** del commit, vía outbox o cola.
- Pagos: ledger interno + reconciliación con PSP (nunca confiar solo en el cliente).

---

## 5. Base de datos

### 5.1 MongoDB como sistema primario

**Por qué MongoDB**

- El agregado `Transaction` (participantes embebidos, condiciones, `statusHistory` resumido) se lee junto en la mayoría de pantallas.
- Evidencias y disputas como colecciones referenciadas evitan documentos gigantes.
- Escala horizontal conocida; Atlas u operador self-hosted.

**Qué no va en Mongo**

- Binarios de evidencia → Object Storage.
- Colas / locks / rate limits → Redis.
- Analytics pesados (fase 2) → warehouse (BigQuery/ClickHouse) vía CDC/eventos.

### 5.2 Modelado (alto nivel)

| Colección | Rol | Notas de escala |
|-----------|-----|-----------------|
| `users` | Identidad + perfil básico + KYC/reputación embebidos livianos | Índice unique email; soft delete |
| `transactions` | Agregado de operación | Índices `(participants.user, status)`, `(status, createdAt)` |
| `evidence` | Metadatos + `storageKey` | TTL/archivado por política legal |
| `disputes` | Caso de mediación | Un open activo por operación (regla de app) |
| `payments` / `ledger_entries` | Intenciones y movimientos | Idempotencia por `providerEventId` |
| `notifications` | Inbox persistente | Particionar por `userId` + `createdAt` |
| `audit_logs` | Append-only | Solo insert; índice `(entityType, entityId, createdAt)` |
| `meetups` / campos geo en transaction | Punto de encuentro | Índice `2dsphere` |

### 5.3 Soft delete vs hard delete

- Soft delete en usuarios/operaciones/evidencias para forense.
- Audit y ledger **nunca** se borran lógicamente.
- Retención y anonimización gobernadas por política (Ley 18.331 / Política de Privacidad).

#### Eliminación de cuenta (usuario)

Flujo implementado (no es hard-delete del `_id`):

1. **`POST /users/me/delete-account`** (`confirmation: "Eliminar"`) → `status=SUSPENDED` + `accountDeletionRequestedAt`; revoca refresh tokens.
2. **Bloqueos server-side** (409, no bypasseables desde UI): operaciones activas/disputa como comprador/vendedor; trabajos de Agente `ACCEPTED` activos; saldo wallet (`available`+`pending`+`held`); retiros `PENDING`/`PROCESSING`; comisiones de agente abiertas (`PENDING`/`AVAILABLE`/`RESERVED`/`BLOCKED`). Update atómico exige wallet en cero; re-check post-update.
3. **Gracia 30 días** (`ACCOUNT_DELETION_GRACE_DAYS` en `@confiapp/shared`): login con password válido **restaura** (`ACTIVE`, limpia `accountDeletionRequestedAt`). Suspensión admin (sin pedido de baja) no se recupera así.
4. **Cron** `cron:purge-account-deletions` (~1 h): si gracia vencida y sin bloqueos → anonimiza PII (`email` → `deleted_<id>@deleted.local`, limpia teléfono/documento/avatar/etc.), setea `deletedAt`. Si hay bloqueos (p. ej. comisión acreditada en gracia), **no** purgea.
5. Operaciones, pagos, auditoría y evidencias **permanecen** para disputas / ministerio público / obligaciones legales (TyC §17 + Política §10).

### 5.4 Sharding (cuando haga falta)

Orden de activación sugerido:

1. Replica set + índices correctos + connection pooling.
2. Read preference secundarios para listados no críticos.
3. Shard key: `transactionId` para evidence/disputes; `userId` para notifications.

---

## 6. Comunicación en tiempo real

### 6.1 Socket.io

**Eventos típicos (ejemplos de diseño)**

- `transaction:updated` — cambio de estado
- `evidence:added`
- `dispute:opened|updated`
- `payment:status`
- `presence:participant`

**Rooms:** `user:{userId}`, `transaction:{transactionId}`.  
Autorización al join: el socket debe probar membresía en la operación.

### 6.2 Escalado Socket.io

- **@socket.io/redis-adapter** para fan-out multi-instancia.
- Load balancer con sticky sessions *o* diseño que no dependa de sticky si el adapter está bien configurado.
- Heartbeats y límites de conexiones por usuario.
- No usar sockets para uploads grandes ni para lógica de pago (solo señales).

### 6.3 Alternativa evaluada

| Opción | Por qué no day-1 |
|--------|------------------|
| SSE | Unidireccional; rooms/presencia más pobres |
| Raw WS | Más control, más código de reconexión/rooms |
| Ably/Pusher | Excelente a escala, costo y vendor lock; opción fase 2 |

---

## 7. Autenticación y autorización

### 7.1 Modelo

- **Registro / login** email+password (bcrypt/argon2).
- **JWT access** corto (5–15 min) + **refresh** rotativo en cookie httpOnly Secure SameSite.
- Opcional fase 2: OAuth (Google/Apple), WebAuthn.
- **KYC** asíncrono (provider externo / review admin) → estados `UNVERIFIED | PENDING | VERIFIED | REJECTED` en usuario; gates en fondeo/retiro.
- **Step-up Identidad Digital Abitab (previsto, no implementado):** solo **Agentes**, en **cada login**, además de email/password (authorization code). No sustituye KYC de alta. Detalle y decisiones: [`ID_DIGITAL_AGENTS.md`](./ID_DIGITAL_AGENTS.md). Doc proveedor: [primeros pasos](https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/first-steps).

### 7.2 Autorización

- RBAC de plataforma: `USER`, `ADMIN`, `SUPPORT`.
- ABAC de operación: rol embebido `CREATOR | COUNTERPARTY | INTERMEDIARY`.
- Middleware/guards por use case, no solo por ruta.
- Principio de mínimo privilegio en admin (impersonation auditada).

### 7.3 Seguridad asociada

- Rate limit login / register / forgot-password.
- Device fingerprinting liviano + alertas de login anómalo (fase 2).
- Revocación: denylist de jti en Redis hasta expiración.

---

## 8. Manejo de archivos (evidencias)

### 8.1 Flujo recomendado (direct-to-storage)

1. Cliente solicita **URL prefirmada** (PUT) al API.
2. API valida tipo/tamaño/cuota y crea registro `Evidence` en estado `UPLOADING`.
3. Cliente sube directo a S3/R2/GCS.
4. Webhook o confirmación cliente → job: antivirus, thumbnail, hash, marcar `SUBMITTED`.
5. CDN firmada para lectura (URLs temporales).

**Justificación:** el API no hace de proxy de binarios (CPU, memoria, timeouts). Escala con el object store.

### 8.2 Políticas

- Allowlist MIME + magic-byte check en worker.
- Tamaño máximo por tipo; cuota por usuario/operación.
- Cifrado en reposo (gestionado por el cloud).
- Retención alineada a disputas abiertas + período legal.

---

## 9. Sistema de pagos

### 9.1 Principios

1. **Nunca** confiar en el cliente para confirmar un pago.
2. El PSP (Stripe / Mercado Pago / similar) es fuente de verdad externa.
3. ConfiApp mantiene un **ledger interno** (doble entrada simplificada) para saldo retenido, liberado, reembolsado.
4. Toda mutación financiera es **idempotente**.

### 9.2 Flujo de alto nivel (modo vigente + roadmap)

**Hoy (`AGENT_FEE_ONLY`):**

```text
CREATED → WAITING_PARTICIPANT → ACCEPTED → FUNDED (contratación del Agente capturada)
                                              ↓
                                         IN_PROGRESS (verificación / entrega)
                                              ↓
                                      COMPLETED → comisión Agente PENDING 14d → liquidación admin
                                      CANCELLED / DISPUTED → reembolso de la contratación (si aplica)
```

**Roadmap (`ESCROW_FULL`):** mismo esqueleto, pero `FUNDED` implica hold del precio del producto y al `COMPLETED` release neto al vendedor (+ fees).

- **`WAITING_PARTICIPANT`**: operación creada; se espera que la contraparte acepte el invite/enlace. Es estado **interno** (ver [`WEB_APP.md`](./WEB_APP.md)).
- **`FUNDED` en UI hoy:** «Agente contratado» (no “pago protegido” del producto).

### 9.3 Componentes

| Componente | Rol |
|------------|-----|
| Payment Intent / Preference | Crear cobro en PSP |
| Webhook ingress | Firma verificada, cola, retry |
| Ledger service | Asientos: hold, capture, release, refund, fee |
| Reconciliation job | Diff diario PSP ↔ ledger |
| Payouts (fase 2) | Retiros a cuentas verificadas + KYC |

### 9.4 Compliance

- PCI: **no** almacenar PAN; solo tokens PSP.
- Separar fees de plataforma en ledger.
- Congelamiento por disputa automática.
- Multi-moneda: moneda de la operación inmutable una vez fondeada.

### 9.5 Producto por fuera vs resguardo en la app

Hoy el precio del producto se paga **P2P / fuera de plataforma**; ConfiApp aporta mediación del Agente, trazabilidad y cobro del fee. El modo `ESCROW_FULL` (custodia del precio) está previsto en arquitectura y flag de producto, pero **no** es el modo vigente. En fee-only, `FUNDED` = contratación del Agente cobrada, no dinero del producto custodiado.

---

## 10. Geolocalización

### 10.1 Casos de uso

- Definir **punto de encuentro** (geo JSON Point).
- Validar que una evidencia se tomó cerca del punto (geofence).
- Anti-fraude: distancia inconsistente entre partes en el momento del handoff.
- Búsqueda de intermediarios cercanos (fase 2).

### 10.2 Diseño

- Coordenadas en EPSG:4326; índice Mongo `2dsphere`.
- Precisión mostrada al usuario redondeada (privacidad).
- Consentimiento explícito para compartir ubicación en vivo (TTL corto vía Redis, no historial infinito).
- Reverse geocoding vía provider en worker (cuotas, cache Redis).

### 10.3 Privacidad

- No exponer ubicación exacta continua sin opt-in.
- Audit de quién vio qué coordenada en disputas.

---

## 11. Sistema de notificaciones

### 11.1 Estado actual (implementado)

- Servicio único: `NotificationsService.notify` en `apps/api/src/modules/notifications/`.
- Gating por `preferences.notifications` (`resolveDelivery`).
- Persistencia in-app + eventos Socket `notification:new` / `notification:updated`.
- Web: inbox `/notificaciones` + campana en topbar.
- Push/email reales: parcial / stub según canal; SMS diferido.
- Guía operativa: `.cursor/skills/notifications/`.

**No confundir** con toasts de UI (`useAppToast`): esos son feedback efímero, no inbox.

### 11.2 Canales (diseño a escala)

| Canal | Uso |
|-------|-----|
| In-app (persistente) | Fuente de verdad del inbox |
| Push (FCM/APNs) | Mobile / PWA |
| Email | Transaccional + resumen |
| SMS | Solo críticos (fondeo, disputa) — costo; diferido |
| Socket | Echo inmediato si el usuario está online |

### 11.3 Arquitectura objetivo (workers)

```text
Domain event → Notification use case → Outbox/Queue
                                      ├─ write inbox
                                      ├─ push worker
                                      ├─ email worker
                                      └─ sms worker (opt)
```

- Preferencias por usuario (canal × tipo de evento).
- Deduplicación por `eventId`.
- Templates versionados.
- Dead-letter queue + alertas.

---

## 12. Seguridad transversal

- TLS extremo a extremo; HSTS.
- Helmet, CORS estricto, CSP en web.
- Secrets en gestor (no en git).
- WAF / DDoS en edge.
- Dependency scanning + SAST en CI.
- Backups Mongo + drills de restore.
- Threat model: takeover de cuenta, evidencia falsa, chargeback, colusión intermediario.

---

## 13. Observabilidad y SLOs (escala)

| Señal | Ejemplo |
|-------|---------|
| Latencia API p95 | &lt; 300 ms lecturas; &lt; 800 ms escrituras |
| Error rate | &lt; 0.5 % 5xx (ex-webhooks) |
| Lag cola pagos | &lt; 30 s |
| Disponibilidad | 99.9 % API mensual |

Tracing distribuido en HTTP → use case → Mongo/Redis/PSP.

---

## 14. Roadmap arquitectónico por fases

| Fase | Alcance |
|------|---------|
| **MVP** *(gran parte hecho)* | Auth, users, transactions (+ `WAITING_PARTICIPANT`), web app, health, monorepo |
| **Trust** *(en curso)* | Pagos fee-only + ledger de comisión, KYC, notificaciones in-app, Socket (chat/notif), wallet, audit UI, agentes (open jobs, salida/cierre); escrow de producto pendiente |
| **Cost / anti-bots** *(en master)* | Rate limits por ruta, Turnstile auth, webhook/checkout endurecidos, crons con lock, media presign S3 (`AWS_*`), Redis opcional — ver [`SECURITY_COST_HARDENING.md`](./SECURITY_COST_HARDENING.md) |
| **Scale** *(parcial)* | ~~S3 uploads~~ (presign listo), ~~rate limits distribuidos~~ (Redis opcional). Pendiente ops/código: Redis prod multi-réplica, `STORAGE_REQUIRE_OBJECT_KEYS` + backfill, Socket.io Redis adapter, workers/BullMQ, WAF edge, antivirus uploads, geofence, phone verify real, evidence/disputes UI |
| **Hardening** | Sharding, multi-región lectura, admin forense, warehouse analytics, WAF edge |

---

## 15. Resumen de justificaciones

1. **Clean Architecture** protege el dominio de operaciones/pagos de cambios de vendor.
2. **Monorepo modular** acelera delivery; extracción a servicios cuando el dolor sea real.
3. **Mongo + agregados** encaja en lecturas de operación; **S3** para binarios; **Redis** para tiempo real y colas.
4. **Workers** aíslan webhooks y media del path síncrono.
5. **Pagos con ledger + idempotencia** son no negociables para dinero.
6. **Socket.io + Redis adapter** da UX live sin complejidad de un bus de eventos day-1.
7. **Geolocalización y notificaciones** como contextos propios evitan contaminar el agregado Transaction.

Este documento es la referencia de diseño. La estructura de carpetas del repo se detalla en [`ARCHITECTURE.md`](./ARCHITECTURE.md). Las convenciones de contribución están en [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
