# Finanzas MVP — notas de implementación

Spec: [`CONFIAPP_FINANCIAL_MVP.md`](./CONFIAPP_FINANCIAL_MVP.md).

## Piezas clave

| Pieza | Ubicación |
|---|---|
| Franjas UYU + 80/20 | `packages/shared` (`agent-fee-tiers`, `intermediation-fees`) |
| Hold 21 días / ventana 1–10 | `packages/shared/finance-constants.ts` |
| Modelos | `AgentCommission`, `PayoutBatch`, `AgentPayout`, `FinancialAuditEvent` |
| Módulo API | `apps/api/src/modules/finance` |
| PaymentProvider | `apps/api/src/infrastructure/payments/payment-provider.ts` |
| ManualPayoutProvider | `apps/api/src/infrastructure/payments/payout-provider.ts` |
| Job AVAILABLE | timer en `server.ts` + `POST /finance/jobs/release-commissions` |
| Admin UI | `/admin/finanzas` |

## Flujo dinero al COMPLETED

`releaseEscrow` → seller neto + platform fee + `AgentCommission` **PENDING** (`availableAt = completedAt + 21d`). No acredita `availableCents` de agente al instante.

## Liquidación

Admin crea `PayoutBatch` de comisiones AVAILABLE → reserva → confirma transferencia → `PAID`.

## OAuth Mercado Pago (vendedores)

Vinculación por usuario (sin split aún):

| Pieza | Ubicación |
|---|---|
| Modelo | `MercadoPagoSellerAccount` + `MercadoPagoOAuthState` |
| Cliente | `apps/api/src/infrastructure/payments/mercadopago-oauth.client.ts` |
| API | `GET/DELETE /payments/mercadopago/connection`, `GET .../oauth/start`, `GET .../oauth/callback` |
| UI | Configuración → `MercadoPagoConnectSection` |

Env: `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_OAUTH_REDIRECT_URI`, `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`. El `MERCADOPAGO_ACCESS_TOKEN` de plataforma sigue para Checkout Pro.
