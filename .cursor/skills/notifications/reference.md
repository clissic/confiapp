# Inventario de eventos de notificación

Eventos derivados de lo **ya implementado** en API. Auth verification / forgot-password **ya envían email** y se documentan como canal email de seguridad (no marketing).

## Ya cableados (vía NotificationsService)

| Evento | Tipo | Categoría pref | Caller |
|--------|------|----------------|--------|
| Nuevo mensaje de chat | `MESSAGE` | `messageAlerts` | `chats/service.ts` |
| Oferta de asignación a agente | `AGENT_ASSIGNMENT` | `transactionUpdates` | `agents/notification-delivery.service.ts` |

## P0 — alta prioridad

| Evento | Tipo sugerido | Categoría | Dónde muta hoy |
|--------|---------------|-----------|----------------|
| Hold capturado / escrow liberado | `PAYMENT` | `paymentAlerts` | `payments/service.ts` |
| Payout agente | `PAYMENT` | `paymentAlerts` | `payments/service.ts` |
| Retiro completado | `PAYMENT` | `paymentAlerts` | `wallet/service.ts` |
| Compra aceptada / venta confirmada | `TRANSACTION_UPDATE` | `transactionUpdates` | `transactions/service.ts` |
| Agente aceptó oferta u open job | `TRANSACTION_UPDATE` / `AGENT_ASSIGNMENT` | `transactionUpdates` | `agents/assignment.service.ts`, `open-jobs.service.ts` |
| KYC aprobado/rechazado al usuario | `SYSTEM` | canales (no marketing) | `users/service.ts` `decideKycReview` |
| Password reset completado / password changed | `SYSTEM` | canales seguridad | `auth/service.ts` |

## P1

| Evento | Tipo sugerido | Categoría | Dónde |
|--------|---------------|-----------|-------|
| Contraparte se unió por invite | `TRANSACTION_UPDATE` | `transactionUpdates` | transactions |
| Checkout creado | `PAYMENT` / `TRANSACTION_UPDATE` | según impacto | payments / transactions |
| Retiro solicitado | `PAYMENT` | `paymentAlerts` | wallet |
| Oferta rechazada/expirada → notificar requester | `AGENT_ASSIGNMENT` / `TRANSACTION_UPDATE` | `transactionUpdates` | agents |
| Review request post-complete; reseña recibida | `REVIEW` | `transactionUpdates` | `reviews/service.ts` |
| Confirmación in-app email verificado | `SYSTEM` | canales | auth |

## P2 / cuando exista mutator

| Evento | Notas |
|--------|-------|
| `IN_PROGRESS`, cancelación, disputa/evidencia | Hoy SM/stubs |
| Lock de cuenta | `SYSTEM` |
| Marketing | Solo con pref `marketing === true`; no usar para seguridad |
| `CHAT_CREATED` | Cuando exista el flujo de creación notifiable |

## Fuera de alcance actual

- SMS real / FCM-APNs real (push sigue stub en `push.provider.ts`)
- Unificar schema `packages/database` vs `apps/api/src/database`
- Verificación de teléfono end-to-end (UI stub + limpieza de `phoneVerified` al cambiar número; ver `docs/WEB_APP.md`)
