# ConfiApp Web — estado del producto (UI)

Documento orientado a **desarrolladores y producto**.  
La UI de cara al usuario debe usar copy claro; los estados internos de dominio (p. ej. `WAITING_PARTICIPANT`) viven **aquí** y en la API, no en pantallas de uso cotidiano.

Última actualización: **2026-08-05**.

---

## Stack UI

| Pieza | Tecnología |
|-------|------------|
| App | React 19 · Vite · TypeScript |
| Estilos | Bootstrap 5 + react-bootstrap · tokens en `docs/design-system` · Tailwind solo `tw-*` (Shadcn) |
| Datos | TanStack Query · Axios · React Hook Form + Zod |
| Realtime | Socket.io-client (chat / notificaciones) |
| Motion | Framer Motion (transiciones de panel) |

Reglas Cursor: `.cursor/rules/frontend-bootstrap.mdc`, `.cursor/rules/web-toasts.mdc`.

---

## Rutas autenticadas (shell `MainLayout`)

| Ruta | Feature | Notas |
|------|---------|--------|
| `/inicio` | Home / placeholder workspace | |
| `/perfil` | Perfil | Tabs: Perfil, Historial, Calificaciones, Wallet; settings vía `?tab=settings` |
| `/perfil/verificar-telefono` | Verificación OTP (stub UI) | 6 dígitos; reenvío con countdown 120s; **sin backend** aún |
| `/agente` | Onboarding agente | |
| `/agente/buscar` | Búsqueda agentes | |
| `/agente/ofertas` | Ofertas | |
| `/agente/trabajos` | Open jobs + mapa | |
| `/operaciones` | Listado | |
| `/operaciones/nueva` | Hub rol comprador/vendedor | |
| `/operaciones/nueva/comprador` | Crear como comprador | Hero con `/landing/Shopping.png` |
| `/operaciones/nueva/vendedor` | Crear como vendedor | Hero con `/landing/Sale.png` |
| `/operaciones/unirse/:token` | Join por invite | |
| `/operaciones/:code` | Detalle | |
| `/mensajes` | Chat | Composer **excluido** de reglas de botones full-width |
| `/pagos` | Checkout / pagos | |
| `/wallet` | Saldos, retiros, movimientos | |
| `/auditoria` | Audit log paginado | Email de usuario + copiar ID |
| `/reputacion` | Reputación | |
| `/notificaciones` | Inbox in-app | Campana en topbar → últimas 5 + “Ver más” |
| `/admin/kyc/:token` | Review KYC (admin) | |

Públicas: `/`, `/ingresar`, `/registro`, `/verificar-email`.

---

## Checklist para el Agente

- Al crear la operación (comprador/vendedor), el usuario agrega **ítems línea a línea** (no textarea libre).
- Se persiste como `{ id, text, done }` en `conditions.checklist` (compat con `string[]` legacy al leer).
- El **Agente** asignado (`INTERMEDIARY` ACCEPTED) puede marcar ítems en el detalle de la operación (`PATCH /transactions/by-code/:code/checklist/:itemId`).
- Tras aceptar una oferta en `/agente/ofertas`, se redirige al detalle de la operación para usar el checklist.

Al crear una operación (comprador o vendedor), la API persiste el agregado y deja la operación en:

```text
CREATED → WAITING_PARTICIPANT → ACCEPTED → … (fondeo / progreso / cierre)
```

- **`WAITING_PARTICIPANT`**: la operación existe y hay (o habrá) un enlace de invitación; se espera que la contraparte se una.
- Ese nombre de estado es **interno**. En pantallas de usuario se habla de “enlace para compartir”, “esperando a la otra parte”, etc.

Detalle de diseño a escala: [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md).

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
- **Footer** desktop-only (`d-none d-lg-block`): Términos, Privacidad, Ayuda (placeholders) + © ConfiApp.
- Breadcrumbs según ruta.

---

## Assets públicos relevantes

| Asset | Uso |
|-------|-----|
| `/landing/ConfiApp-logo.png` | Landing, auth, topbar |
| `/landing/Shopping.png` | Hero “Iniciar como comprador” |
| `/landing/Sale.png` | Hero “Iniciar como vendedor” |
| `/landing/flow-agents.png`, `cta-lifestyle.png` | Landing |

Tipografía landing: **Plus Jakarta Sans**. App shell: tipografía del design system (ver GUIDE).

---

## Demo / túnel

Ver [`DEMO_PUBLICO.md`](./DEMO_PUBLICO.md) (`pnpm demo:tunnel`).
