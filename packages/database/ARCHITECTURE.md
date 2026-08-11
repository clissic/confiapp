# Decisiones arquitectónicas — MongoDB / Mongoose

## Mapa de relaciones

```
User 1──1 Profile
User 1──* Product (owner)
User 1──1 AgentAvailability (si role=AGENT)
User 1──* Notification
User *──* Chat (participants)
User 1──* Message (sender)
User 1──* Review (reviewer | reviewee)
User 1──* Payment (payer | payee)
User 1──* Transaction (createdBy / participants.user)
User 1──* Dispute (openedBy | assignedTo | resolvedBy)

Product *──1 Transaction (product) ← opcional
Transaction 1──1 Chat (transaction ↔ chat)
Transaction 1──* Message (vía Chat)
Transaction 1──* Evidence
Transaction 1──* Dispute
Transaction 1──* Payment
Transaction 1──* Review
Chat 1──* Message
```

## Embebido vs referencia

| Dato | Estrategia | Motivo |
|------|------------|--------|
| `User.kyc`, `User.reputation` | Embebido | Viaja con la identidad |
| `User.agent`, `User.schedule`, `User.location` | Embebido | Onboarding / disponibilidad del intermediario |
| `Profile` | Colección + ref User | Login lean vs perfil público |
| `Transaction.participants` | Embebido (1–3) | Siempre se lee con la operación; `REMOVED` = agente saliente |
| `Transaction.conditions` / `statusHistory` | Embebido | Acuerdo + historial resumido |
| `Transaction.evidenceIds` | Array de refs | Evidencias crecen sin hinchar el doc |
| `Product.images` | Embebido (≤20) | Galería acotada |
| `Chat` / `Message` | Colecciones + refs | Mensajería de alto volumen |
| `Notification` | Colección + ref User | Inbox por usuario |
| `Review` | Colección + refs | Consultas de reputación |
| `Payment` | Colección + ref Transaction | Auditoría financiera / idempotencia |
| `AgentAvailability.weeklySlots` | Embebido | Config pequeña del agente |
| `Evidence`, `Dispute` | Colecciones + refs | Ciclo de vida propio |
| `AuditLog` | Append-only | Reconstrucción forense |
| `RefreshToken` | Colección + TTL | Sesiones |

## Índices clave

- `users.email` unique, `role`, `status`, `deletedAt`
- `products.owner+status`, `status+category+createdAt`, text `title/description`
- `transactions.code` unique, `status+createdAt`, `participants.user+status`, `product+status`
- `chats.transaction` unique parcial, `participants+lastMessageAt`
- `messages.chat+createdAt`
- `notifications.user+createdAt`, `user+readAt`
- `reviews.(transaction,reviewer,reviewee)` unique parcial
- `payments.idempotencyKey` unique, `transaction+status`
- `agent_availability.user` unique, `isAcceptingAssignments`
- `disputes.transaction+status`, `assignedTo+status`
- `refresh_tokens.expiresAt` TTL

## Soft delete

`deletedAt` en User, Profile, Product, Transaction, Chat, Message, Notification, Review, Payment, AgentAvailability, Evidence, Dispute.

**AuditLog y RefreshToken (TTL)** no usan soft delete de negocio.

## Estados de Transaction (resumen)

Flujo típico post-creación:

`CREATED` → `WAITING_PARTICIPANT` (invite pendiente) → `ACCEPTED` → … → fondeo / progreso / cierre.

Documentación de producto/UI (sin exponer códigos al usuario): `docs/WEB_APP.md`.  
Diseño a escala: `docs/SYSTEM_ARCHITECTURE.md` §9.2.

## Teléfono del usuario

`phone` + `phoneVerifiedAt` / `verification.phone.verified`.  
Si el usuario cambia el número al actualizar perfil, la API limpia la verificación (`phoneVerifiedAt` unset, `verification.phone.verified = false`).

## Dinero

Montos siempre en **centavos enteros** (`amountCents`) + `currency` ISO 4217.
