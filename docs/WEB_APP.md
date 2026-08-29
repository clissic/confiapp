# ConfiApp Web — estado del producto (UI)

Documento orientado a **desarrolladores y producto**.  
La UI de cara al usuario debe usar copy claro; los estados internos de dominio (p. ej. `WAITING_PARTICIPANT`) viven **aquí** y en la API, no en pantallas de uso cotidiano.

Última actualización: **2026-08-11**.

---

## Stack UI

| Pieza | Tecnología |
|-------|------------|
| App | React 19 · Vite · TypeScript |
| Estilos | Bootstrap 5 + react-bootstrap · tokens en `docs/design-system` · Tailwind solo `tw-*` (Shadcn) |
| Datos | TanStack Query · Axios · React Hook Form + Zod |
| Realtime | Socket.io-client (chat / notificaciones) |
| Motion | Framer Motion (transiciones de panel) |

Reglas Cursor: `.cursor/rules/frontend-bootstrap.mdc`, `.cursor/rules/web-aesthetic-friendly.mdc`, `.cursor/rules/web-toasts.mdc`.

---

## Rutas autenticadas (shell `MainLayout`)

| Ruta | Feature | Notas |
|------|---------|--------|
| `/inicio` | Home / placeholder workspace | Accesos Comprar / Vender / Mi Agencia / Mensajes |
| `/perfil` | Perfil | Tabs: Perfil, Historial, Calificaciones, Wallet; settings vía `?tab=settings` |
| `/perfil/verificar-telefono` | Verificación OTP (stub UI) | 6 dígitos; reenvío con countdown 120s; **sin backend** aún |
| `/agente` | Onboarding + panel de agencia | Suspender / reactivar / cerrar; listado de ops activas como intermediario |
| `/agente/buscar` | Búsqueda de agentes | |
| `/agente/trabajos` | Open jobs + mapa | Guard `RequireAgent` |

> **Previsto (no implementado):** en cada login, los Agentes deberán completar un step-up con Identidad Digital Abitab además de email/password. Ver [`ID_DIGITAL_AGENTS.md`](./ID_DIGITAL_AGENTS.md).

| `/operaciones` | Listado | |
| `/operaciones/nueva` | Hub rol comprador/vendedor | |
| `/operaciones/nueva/comprador` | Crear como comprador | Hero con `/landing/Shopping.png` |
| `/operaciones/nueva/vendedor` | Crear como vendedor | Hero con `/landing/Sale.png` |
| `/operaciones/unirse/:token` | Join por invite | |
| `/operaciones/:code` | Detalle | Checklist agente; CTA salida/reasignación; badge “Buscando nuevo agente” |
| `/operaciones/:code/pagar` | Pago protegido (MVP Prex / MP standby) | |
| `/operaciones/:code/pagar/simular` | Mock de pago MP | Solo con `PAYMENTS_CHECKOUT_MODE=mercadopago` + MOCK |
| `/mensajes` | Chat | Composer **excluido** de reglas de botones full-width |
| `/pagos` | Checkout / pagos | |
| `/wallet` | Saldos, retiros, movimientos | Agentes: Ganado/Pendiente/Disponible/Liquidado; sin retiro self-service de comisiones |
| `/admin/pagos` | Transferencias Prex entrantes (admin) | Comprobantes + detalle |
| `/auditoria/pagos` | Auditoría de pagos (paginado) | Incluye eventos Prex |
| `/admin/finanzas` | Liquidaciones a agentes | Solo admin · PayoutBatch 1–10 |
| `/auditoria` | Audit log paginado | Solo admin (`RequireAdmin`) |
| `/reputacion` | Reputación | |
| `/notificaciones` | Inbox in-app | Campana en topbar → últimas 5 + “Ver más” |
| `/admin/kyc/:token` | Review KYC (admin) | |

Públicas: `/`, `/ingresar`, `/registro`, `/verificar-email` (alias `/verify-email`).

> **Nota:** la API aún expone ofertas de asignación (`GET/POST /agents/offers…`). En web, el deep-link de `AGENT_ASSIGNMENT` apunta a `/agente/trabajos`; no hay ruta `/agente/ofertas` cableada en el router.

---

## Agentes — ciclo de vida (UI)

| Acción | Comportamiento de producto |
|--------|----------------------------|
| **Onboarding** (`/agente`) | Términos, horarios/área, activación como agente |
| **Suspender** | Soft: deja de recibir trabajo nuevo; sigue a cargo de ops activas |
| **Reactivar** | Vuelve a `ACTIVE` y acepta asignaciones |
| **Cerrar agencia** | Hard: bloqueado si hay ops activas (`ACTIVE_JOBS`); quita el rol de agente |
| **Trabajos abiertos** | Tablero geo + filtros; aceptar trabajo |
| **Solicitar salida** | Desde detalle de op (agente asignado): intermediario `REMOVED`, escrow intacto, aviso a partes + “Buscando nuevo agente” |

Estados internos de onboarding: `NONE` → `DRAFT` → `ACTIVE` / `INACTIVE` (y `SUSPENDED` admin). En UI: “en pausa”, no enums crudos.

---

## Checklist para el Agente

- Al crear la operación (comprador/vendedor), el usuario agrega **ítems línea a línea** (no textarea libre).
- Se persiste como `{ id, text, done }` en `conditions.checklist` (compat con `string[]` legacy al leer).
- El **Agente** asignado (`INTERMEDIARY` + `ACCEPTED`) puede marcar ítems en el detalle (`PATCH /transactions/by-code/:code/checklist/:itemId`), en `FUNDED` / `IN_PROGRESS`.
- Tras aceptar desde open jobs u oferta API, el historial puede mostrar label **“Agenciada”** (no repetir “Aceptada”).
- Si el agente solicita salida, el historial puede mostrar **“Agente saliente”**.

Al crear una operación (comprador o vendedor), la API persiste el agregado y deja la operación en:

```text
CREATED → WAITING_PARTICIPANT → ACCEPTED → FUNDED → IN_PROGRESS → COMPLETED
```

- **`WAITING_PARTICIPANT`**: la operación existe y hay (o habrá) un enlace de invitación; se espera que la contraparte se una.
- Ese nombre de estado es **interno**. En pantallas de usuario se habla de “enlace para compartir”, “esperando a la otra parte”, etc.

Detalle de diseño a escala: [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md).

---

## Chat

- Lista + room; en phone se navega lista ↔ chat; desde tablet (≥768) layout split.
- Código de operación en el header del room → link a `/operaciones/{código}`.
- Ticks de leído alineados con `markRead` + realtime.

---

## Perfil y teléfono

- **Editar perfil** (`Settings` → formulario unificado): datos personales, dirección, teléfono (código país + número).
- Botón de verificación dentro del input Número (`bi-question-circle`), mismo patrón que el ojo de contraseña.
- Si el teléfono está **verificado** y el valor no cambió → botón deshabilitado.
- Si el usuario cambia **código de país o número** → estado UI “sin verificar” y el botón se reactiva; el ícono de estado del header refleja eso en la pestaña settings.
- Al **guardar** un teléfono distinto → `phoneVerified` se limpia (API + demo profile).
- Página OTP: stub de sesión (`sessionStorage`); no envía SMS ni valida código en backend todavía.

Mobile: en Datos personales el CTA “Editar” es **solo ícono** (`Pencil`).

---

## Notificaciones

- **API:** `NotificationsService.notify` + gating por `preferences.notifications` (ver skill `.cursor/skills/notifications/`).
- **Web:** inbox `/notificaciones`, campana en topbar (panel full-width bajo el topbar en &lt; lg), proxy Vite incluye `/notifications`.
- Empty state vs error: mensaje vacío amigable; `Alert` danger solo con `isError`.
- Layout inbox: filas full-width; en desktop título/cuerpo a la izquierda, badge/hora/acciones a la derecha.

Distinción: **toast** (`useAppToast`) = feedback efímero de UI; **notificación** = registro persistente en inbox.

---

## Toasts

- Provider global `ToastProvider` / `useAppToast`.
- Usar para success / copy / avisos cortos.
- Errores de formulario y banners de estado permanente siguen como `Alert`.
- Contraste light/dark vía tokens `--success-*`, etc.

---

## Formularios (mobile ≤767.98px)

En `apps/web/src/app/styles/global.css`:

- `.ca-form-actions` en columna; botones al 100% de ancho.
- Submits/CTA hijos de `form` (excepto `.ca-chat-composer`).
- Grillas de lookup/filtros (pagos, open jobs, auditoría) en una columna.
- Botón “Abrir Wallet” en card de perfil también full-width.

---

## Shell / layout

- Topbar: menú usuario + notificaciones; en compacto, paneles fixed full-width.
- Bottom nav + menú: operaciones, mensajes, wallet, reputación; auditoría solo admin.
- **Footer** desktop-only (`d-none d-lg-block`): Términos, Privacidad, Ayuda (placeholders) + © ConfiApp.
- Breadcrumbs según ruta.

---

## Pago protegido (MVP Prex)

- Ruta: `/operaciones/:code/pagar`.
- Default: transferencia a cuenta Prex (`Ignacio La Cava` / `1065233`) + QR + upload de comprobante.
- API: `POST /payments/transactions/:code/manual-transfer`.
- Reactivar Mercado Pago: `PAYMENTS_CHECKOUT_MODE=mercadopago` en la API (código MP intacto).
- Admin: `/admin/pagos` — transferencias Prex con comprobante. Eventos en `/auditoria/pagos`.
- Notas: [`FINANCE_MVP_NOTES.md`](./FINANCE_MVP_NOTES.md).

---

## Assets públicos relevantes

| Asset | Uso |
|-------|-----|
| `/landing/ConfiApp-logo.png` | Landing, auth, topbar |
| `/landing/Shopping.png` | Hero “Iniciar como comprador” |
| `/landing/Sale.png` | Hero “Iniciar como vendedor” |
| `/landing/QRprex.png` | QR cuenta Prex (pago MVP) |
| `/landing/Folder.png` | Panel de agencia |
| `/landing/flow-agents.png`, `cta-lifestyle.png` | Landing |

Tipografía landing: **Plus Jakarta Sans**. App shell: tipografía del design system (ver GUIDE).

---

## Demo / túnel

Ver [`DEMO_PUBLICO.md`](./DEMO_PUBLICO.md) (`pnpm demo:tunnel`).
