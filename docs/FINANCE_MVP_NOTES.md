# Finanzas MVP — notas de implementación

Spec: [`CONFIAPP_FINANCIAL_MVP.md`](./CONFIAPP_FINANCIAL_MVP.md).

## Cobro al comprador (modo actual)

| Modo | Env | Comportamiento |
|---|---|---|
| **`manual_prex`** (default MVP) | `PAYMENTS_CHECKOUT_MODE=manual_prex` | UI en `/operaciones/:code/pagar`: QR + datos Prex + upload de comprobante → `POST /payments/transactions/:code/manual-transfer` → hold `REQUIRES_ACTION` (pendiente admin). Admin confirma en `/admin/pagos` → `FUNDED` + visible para agentes. |
| **`mercadopago`** (standby) | `PAYMENTS_CHECKOUT_MODE=mercadopago` | Checkout Pro / MOCK intacto (`POST .../checkout`, webhooks, página simular). Sin credenciales → MOCK. |

Cuenta Prex plataforma (configurable):

- `PAYMENTS_PREX_ACCOUNT_NAME` (default `Ignacio La Cava`)
- `PAYMENTS_PREX_ACCOUNT_NUMBER` (default `1065233`)

El monto a transferir es el **total del comprador** (`buyerPaysCents` + tip ConfiAnza si el creador es comprador y misma moneda).

Al subir comprobante:

- Operación queda pendiente de confirmación admin (no `FUNDED` todavía)
- Email a `PLATFORM_NOTIFY_EMAIL` (o `MAIL_FROM` / `SMTP_USER`) con adjunto y link a `/admin/pagos`
- Admin confirma con switch en `/admin/pagos` → `PATCH .../confirmation` → `FUNDED` + agentes ven el trabajo
- API admin: `GET /payments/admin/manual-transfers?page=&limit=` (paginado, default 15)
- UI admin: `/admin/pagos` — listado minimalista + preview/descarga de comprobante
- Eventos de pago (incl. Prex): Auditoría → `/auditoria/pagos` (paginado)

## Piezas clave

| Pieza | Ubicación |
|---|---|
| Franjas UYU + 80/20 | `packages/shared` (`agent-fee-tiers`, `intermediation-fees`) |
| Hold 21 días / ventana 1–10 | `packages/shared/finance-constants.ts` |
| Modelos | `AgentCommission`, `PayoutBatch`, `AgentPayout`, `FinancialAuditEvent` |
| Módulo API | `apps/api/src/modules/finance` |
| PaymentProvider | `apps/api/src/infrastructure/payments/payment-provider.ts` |
| Manual Prex (MVP) | `PaymentsService.submitManualPrexTransfer` + UI `PrexTransferPanel` |
| ManualPayoutProvider | `apps/api/src/infrastructure/payments/payout-provider.ts` |
| Job AVAILABLE | timer en `server.ts` + `POST /finance/jobs/release-commissions` |
| Admin UI | `/admin/finanzas` |

## Flujo dinero al COMPLETED

`releaseEscrow` → seller neto + platform fee + `AgentCommission` **PENDING** (`availableAt = completedAt + 21d`). No acredita `availableCents` de agente al instante.

## Liquidación

Admin crea `PayoutBatch` de comisiones AVAILABLE → reserva → confirma transferencia → `PAID`.

## OAuth Mercado Pago (vendedores)

Vinculación por usuario (sin split aún) — **sigue disponible**; el checkout comprador está en standby mientras `PAYMENTS_CHECKOUT_MODE=manual_prex`.

| Pieza | Ubicación |
|---|---|
| Modelo | `MercadoPagoSellerAccount` + `MercadoPagoOAuthState` |
| Cliente | `apps/api/src/infrastructure/payments/mercadopago-oauth.client.ts` |
| API | `GET/DELETE /payments/mercadopago/connection`, `GET .../oauth/start`, `GET .../oauth/callback` |
| UI | Configuración → `MercadoPagoConnectSection` |

Env: `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_OAUTH_REDIRECT_URI`, `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`. El `MERCADOPAGO_ACCESS_TOKEN` de plataforma sigue para Checkout Pro cuando el modo sea `mercadopago`.
