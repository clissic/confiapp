# Finanzas MVP — notas de implementación

Spec histórica / detallada: [`CONFIAPP_FINANCIAL_MVP.md`](./CONFIAPP_FINANCIAL_MVP.md).  
Flujos de operación (roles, pagos, plazos): [`OPERATION_FLOWS.md`](./OPERATION_FLOWS.md).

> **Modo vigente (2026-11):** `AGENT_FEE_ONLY`. En la app solo se cobra la **contratación del Agente** (UYU $490). El precio del producto **no** entra al ledger ni se “libera al vendedor”. `ESCROW_FULL` = roadmap (`FUNDING_ESCROW_FULL_ENABLED`).

## Cobro al comprador (modo actual)

Solo **Mercado Pago** (Checkout Pro). Sin `MERCADOPAGO_ACCESS_TOKEN` → MOCK local.

En `AGENT_FEE_ONLY` el monto es **UYU $490** (contratación del Agente). Reparto al cerrar: **70% Agente (UYU $343) / 30% ConfiApp (UYU $147)**. Confirmación por webhook + `POST .../sync-checkout` al volver. Tras pago aprobado → `FUNDED` (UI «Agente contratado») sin intervención admin.

Eventos de pago: Auditoría → `/auditoria/pagos` (paginado).

La vía Prex / `PAYMENTS_CHECKOUT_MODE` / `/admin/pagos` fue **retirada**.

## Piezas clave

| Pieza | Ubicación |
|---|---|
| Franjas UYU + 70/30 (Agente / ConfiApp) | `packages/shared` (`agent-fee-tiers`, `intermediation-fees`) |
| Hold **14 días** / ventana 1–10 | `packages/shared/finance-constants.ts` |
| Modelos | `AgentCommission`, `PayoutBatch`, `AgentPayout`, `FinancialAuditEvent` |
| Módulo API | `apps/api/src/modules/finance` |
| PaymentProvider | `apps/api/src/infrastructure/payments/payment-provider.ts` |
| Checkout MP | `PaymentsService.createBuyerCheckout` + UI `TransactionPayPage` |
| ManualPayoutProvider | `apps/api/src/infrastructure/payments/payout-provider.ts` |
| Job AVAILABLE | timer en `server.ts` + `POST /finance/jobs/release-commissions` |
| Admin UI | `/admin/finanzas` |

## Flujo dinero al COMPLETED

`releaseEscrow` (cierre de operación) → en **fee-only**: acredita comisión del Agente + `AgentCommission` **PENDING** (`availableAt = completedAt + **14d**`). No acredita `availableCents` al instante ni paga el producto al vendedor.  
(Rama `ESCROW_FULL`, si se habilita: neto vendedor + fees — no es el modo de producto actual.)

## Liquidación

Admin crea `PayoutBatch` de comisiones AVAILABLE → reserva → confirma transferencia → `PAID` (ventana días **1–10**).

## OAuth Mercado Pago (agentes / vendedores)

Vinculación por usuario (sin split 1:N aún).

| Pieza | Ubicación |
|---|---|
| Modelo | `MercadoPagoSellerAccount` + `MercadoPagoOAuthState` |
| Cliente | `apps/api/src/infrastructure/payments/mercadopago-oauth.client.ts` |
| API | `GET/DELETE /payments/mercadopago/connection`, `GET .../oauth/start`, `GET .../oauth/callback` |
| UI | Configuración → `MercadoPagoConnectSection` |

Env: `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_OAUTH_REDIRECT_URI` (URL de la **web** `/oauth/mercadopago/callback`, local ≠ Railway), `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`. PKCE solo con `MERCADOPAGO_OAUTH_USE_PKCE=true` y el switch habilitado en el panel MP. El `MERCADOPAGO_ACCESS_TOKEN` de plataforma sirve para Checkout Pro.
