---
name: notifications
description: >-
  Emite notificaciones de dominio vía NotificationsService.notify con gating por
  preferences.notifications. Usar al mutar estado de operación, dinero, mensaje,
  KYC, seguridad, oferta de agente o reseña; nunca NotificationModel.create suelto.
---

# Notificaciones ConfiApp

## Cuándo aplicar

Cualquier mutación de dominio con impacto al usuario (estado de operación, dinero, mensaje, KYC, seguridad, oferta agente, reseña).

## Qué hacer

1. Llamar `NotificationsService.notify` (o el singleton `notificationsService`) desde `apps/api/src/modules/notifications/service.ts`.
2. **Nunca** `NotificationModel.create` suelto.
3. Elegir `NotificationType` + categoría de pref; no inventar canales nuevos sin schema (`IN_APP` | `PUSH` | `EMAIL`). SMS queda diferido.
4. Pasar `extraRealtimeEvents` solo si el dominio necesita eventos extra (`agent:offer`, etc.). `notification:new` / `notification:updated` ya los emite el servicio.
5. Deep-links útiles van en `data.href` (ruta web relativa).

## Matriz de gating (regla de negocio — verbatim)

1. **Categoría** (tema) debe estar ON según el tipo:
   - `MESSAGE` → `messageAlerts`
   - `AGENT_ASSIGNMENT` / `TRANSACTION_UPDATE` → `transactionUpdates`
   - `PAYMENT` → `paymentAlerts`
   - `DISPUTE` → `disputeAlerts`
   - `REVIEW` → `transactionUpdates`
   - `SYSTEM` (seguridad/KYC/cuenta) → no usa `marketing`; respeta `inApp`/`email`/`push` (email de seguridad se envía salvo `email === false`)
2. **Canales** pedidos ∩ prefs de canal (`inApp`, `push`, `email`). `sms` queda documentado como diferido (no hay canal SMS en el enum).
3. Si categoría OFF o ningún canal queda → **no** se crea documento.
4. Si `inApp` ON → persiste + socket. Si solo `push`/`email` → entrega esos canales sin exigir inbox (o persiste con `channel` primario y `channelsDelivered`).

La implementación canónica está en `resolveDelivery` (`apps/api/src/modules/notifications/resolve-delivery.ts`).

## Checklist

- [ ] Tipo (`NotificationType`) correcto
- [ ] Destinatarios correctos (userId)
- [ ] Gating vía `notify` (sin bypass de prefs)
- [ ] Realtime: inbox/campana reciben `notification:new`
- [ ] Tests si hay lógica nueva de resolución o caller
- [ ] Evento listado en [reference.md](reference.md) marcado como implementado al cablear

## UI web (inbox)

- Ruta: `/notificaciones` (`NotificationsInboxPage`).
- Campana en topbar: últimas 5 + “Ver más”; en viewport &lt; lg el panel es fixed full-width bajo el topbar.
- Proxy Vite debe incluir `/notifications` en `API_PROXY_PATHS`.
- Empty state amigable; `Alert` danger solo si `isError`.
- **Toast ≠ notificación:** feedback efímero con `useAppToast`; inbox es persistente.

Detalle: `docs/WEB_APP.md`.

## Inventario pendiente

Ver [reference.md](reference.md). **No emitir** eventos P0–P2 en PRs no relacionados; cablear uno por PR cuando toque el mutator.
