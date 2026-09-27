# Flujos de operación — Comprador, Vendedor y Agente

Documento de producto y desarrollo. Describe **cómo se vive una operación** según los tres roles, con énfasis en:

- creación e invitación
- aceptación / confirmación
- **pagos** (contratación del Agente vs resguardo completo)
- intermediación (agente)
- verificación, entrega y arribo
- **plazos** (21 días operativos, 72 h post-entrega, 14 días de comisión)
- disputas

**Última actualización:** 2026-09-27.

**Fuente de código:**  
`packages/database` (enums) · `apps/api/src/modules/transactions` · `payments` · `agents` · `disputes` · `finance` · `apps/web/src/features/transactions`.

---

## Leyenda de colores (diagramas)

| Color | Significado |
|-------|-------------|
| 🔵 Azul (`buyer`) | Acción o pantalla del **Comprador** |
| 🟠 Ámbar (`seller`) | Acción o pantalla del **Vendedor** |
| 🟢 Teal (`agent`) | Acción o pantalla del **Agente** |
| 💜 Púrpura (`pay`) | **Pago** / retención de fondos |
| 🟡 Amarillo (`deadline`) | Activación o vencimiento de **plazos** |
| 🔴 Rojo (`dispute`) | **Disputa** / reclamo |
| ⬜ Gris (`system`) | Job automático / sistema / admin |

En Mermaid, los nodos usan `classDef` con esos roles.

---

## 1. Roles y qué hace cada uno

| Rol | Quién es | Responsabilidades principales |
|-----|----------|-------------------------------|
| **Comprador** | Parte que adquiere el producto | Crear op (o unirse), pagar la **contratación del Agente** (modo default), aceptar/rechazar producto, confirmar **arribo**, abrir **disputa** si hace falta |
| **Vendedor** | Parte que ofrece el producto | Crear op (o unirse), confirmar venta / condiciones, esperar pago del comprador, coordinar retiro |
| **Agente** | Intermediario independiente | Onboarding + ID Digital, tomar trabajo, checklist, verificación, **confirmar entrega**, comisión 80 % tras COMPLETED |

En el modelo: `TransactionInitiator` = `BUYER` \| `SELLER`. El agente es `INTERMEDIARY` con `ACCEPTED`.

---

## 2. Modos de fondeo

| Modo | Código | Qué paga el comprador en la app |
|------|--------|----------------------------------|
| **Solo pago del Agente** (default) | `AGENT_FEE_ONLY` | Fijo **UYU $400** (`AGENT_FEE_ONLY_UYU_CENTS`) — “contratación del Agente”. El precio del producto se arregla fuera de ConfiApp. |
| **Resguardo completo** | `ESCROW_FULL` | Precio + comisión (solo si `FUNDING_ESCROW_FULL_ENABLED=true`) |

**Cobro técnico** (`PAYMENTS_CHECKOUT_MODE`):

| Valor | Comportamiento |
|-------|----------------|
| `mercadopago` | Checkout Pro (o MOCK sin token). Confirmación por webhook + sync al volver. |
| `manual_prex` | Transferencia Prex + comprobante → admin confirma → `FUNDED`. |

---

## 3. Máquina de estados (vista global)

```mermaid
stateDiagram-v2
  [*] --> CREATED: crear operación
  CREATED --> WAITING_PARTICIPANT: invite listo
  WAITING_PARTICIPANT --> PENDING_BUYER_CONFIRM: vendedor confirma con cambios
  WAITING_PARTICIPANT --> ACCEPTED: contraparte acepta sin diffs / join OK
  PENDING_BUYER_CONFIRM --> ACCEPTED: comprador acepta cambios
  PENDING_BUYER_CONFIRM --> CANCELLED: comprador rechaza cambios
  ACCEPTED --> FUNDED: pago capturado
  FUNDED --> IN_PROGRESS: agente opera / checklist
  IN_PROGRESS --> COMPLETED: entrega + arribo (o auto 72h)
  FUNDED --> COMPLETED: cierre con arribo/entrega
  ACCEPTED --> CANCELLED: cancelación
  FUNDED --> DISPUTED: comprador abre disputa
  IN_PROGRESS --> DISPUTED: comprador abre disputa
  DISPUTED --> IN_PROGRESS: admin reanuda
  DISPUTED --> CANCELLED: admin cancela / reembolsa
  DISPUTED --> COMPLETED: resolución excepcional
  COMPLETED --> [*]
```

**Labels UI** (no mostrar enums crudos): p. ej. `FUNDED` → “Pago protegido”, `WAITING_PARTICIPANT` → “esperando a la otra parte”.

---

## 4. Flujo A — Compra iniciada por el Comprador

### 4.1 Diagrama de secuencia (pasos + pagos + plazos)

```mermaid
flowchart TB
  subgraph create ["1. Creación"]
    B1([Comprador: /operaciones/nueva/comprador]):::buyer
    B2[API: POST /transactions]:::buyer
    B3[Estado: WAITING_PARTICIPANT<br/>+ enlace invite]:::system
    B1 --> B2 --> B3
  end

  subgraph join ["2. Vendedor se une"]
    S1([Vendedor: /operaciones/unirse/:token]):::seller
    S2[confirm-sale]:::seller
    S3{¿Cambios vs propuesta?}:::system
    S4[PENDING_BUYER_CONFIRM]:::system
    S5[ACCEPTED]:::system
    B4([Comprador: aceptar / rechazar cambios]):::buyer
    S1 --> S2 --> S3
    S3 -->|sí| S4 --> B4
    B4 -->|acepta| S5
    B4 -->|rechaza| CX[CANCELLED]:::dispute
    S3 -->|no| S5
  end

  subgraph deadline21 ["⏱ Plazo operativo"]
    D21[Se setea operationDeadlineAt<br/>= ahora + 21 días]:::deadline
    S5 --> D21
  end

  subgraph agent ["3. Intermediación"]
    A0{¿Hay agente?}:::system
    A1([Agente: trabajos / oferta + ID Digital]):::agent
    A2[POST accept job]:::agent
    A0 -->|sí| PAY
    A0 -->|no| A1 --> A2 --> PAY
  end

  D21 --> A0

  subgraph pay ["4. Pago — Contratación del Agente"]
    PAY([Comprador: /operaciones/:code/pagar]):::buyer
    PAY2{Modo cobro}:::pay
    PAY3[Mercado Pago Checkout Pro<br/>UYU $400]:::pay
    PAY4[Prex + comprobante → admin]:::pay
    PAY5[Hold CAPTURED<br/>Estado: FUNDED]:::pay
    PAY --> PAY2
    PAY2 -->|mercadopago| PAY3 --> PAY5
    PAY2 -->|manual_prex| PAY4 --> PAY5
  end

  subgraph delivery ["5. Entrega física"]
    V1([Agente: checklist + verificación]):::agent
    V2([Comprador: aceptar producto]):::buyer
    V3([Agente: Confirmar entrega]):::agent
    V4([Comprador: Confirmar arribo]):::buyer
    V5[Primera confirmación → autoReleaseAt +72h]:::deadline
    V6[COMPLETED + release]:::system
    PAY5 --> V1 --> V2 --> V3
    V3 --> V5
    V2 --> V4
    V4 --> V5
    V5 --> V6
  end

  subgraph after ["6. Post-completado"]
    C1[Comisión agente PENDING<br/>disponible en +14 días]:::deadline
    C2[Admin liquidación días 1–10]:::system
    R21[Si pasan 21d sin COMPLETED:<br/>email a comprador + agente<br/>¿abrir disputa? — NO cancela]:::deadline
    V6 --> C1 --> C2
    D21 -.-> R21
  end

  classDef buyer fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
  classDef seller fill:#ffedd5,stroke:#c2410c,color:#0f172a
  classDef agent fill:#ccfbf1,stroke:#0f766e,color:#0f172a
  classDef pay fill:#dcfce7,stroke:#15803d,color:#0f172a
  classDef deadline fill:#fef9c3,stroke:#a16207,color:#0f172a
  classDef dispute fill:#fee2e2,stroke:#b91c1c,color:#0f172a
  classDef system fill:#f1f5f9,stroke:#475569,color:#0f172a
```

### 4.2 Acciones por rol (compra iniciada por comprador)

| Paso | Comprador | Vendedor | Agente |
|------|-----------|----------|--------|
| Crear | Crea op + checklist + invite | — | — |
| Unirse | — | Abre enlace, confirma venta | — |
| Reconfirm | Si hay diffs: acepta/rechaza | Espera | — |
| Agente | Puede buscar / esperar open job | Idem | Acepta trabajo (ID Digital) |
| Pagar | Paga **$400** contratación | Espera “Pago protegido” | Aparece trabajo fondeado |
| Producto | Acepta / rechaza verificación | Coordina retiro | Checklist + finalize |
| Entrega | Confirma **arribo** | — | Confirma **entrega** |
| Disputa | Puede abrir disputa | Informado | Comisión puede bloquearse |
| Plazo 21d | Recibe recordatorio si sigue abierta | — | Recibe recordatorio |

---

## 5. Flujo B — Venta iniciada por el Vendedor

```mermaid
flowchart TB
  S1([Vendedor: /operaciones/nueva/vendedor]):::seller
  S2[POST /transactions/as-seller<br/>WAITING_PARTICIPANT]:::seller
  B1([Comprador: unirse + accept-purchase]):::buyer
  ACC[ACCEPTED<br/>+ operationDeadlineAt +21d]:::deadline
  REST[Continúa igual que flujo A<br/>desde Agente → Pago → Entrega]:::system

  S1 --> S2 --> B1 --> ACC --> REST

  classDef buyer fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
  classDef seller fill:#ffedd5,stroke:#c2410c,color:#0f172a
  classDef deadline fill:#fef9c3,stroke:#a16207,color:#0f172a
  classDef system fill:#f1f5f9,stroke:#475569,color:#0f172a
```

**Diferencia clave:** no suele haber `PENDING_BUYER_CONFIRM` (ese estado nace cuando el **vendedor** confirma una venta iniciada por comprador **con cambios**). Aquí el comprador acepta la propuesta del vendedor de una y queda `ACCEPTED`.

| Paso | Comprador | Vendedor | Agente |
|------|-----------|----------|--------|
| Crear | — | Crea op + invite | — |
| Unirse | Acepta compra | Comparte enlace | — |
| Resto | Igual que §4 | Igual que §4 | Igual que §4 |

---

## 6. Flujo C — Intermediación (Agente)

```mermaid
flowchart TB
  subgraph onboard ["Alta"]
    O1([/agente — onboarding]):::agent
    O2[ID Digital Abitab · purpose agent_onboarding]:::agent
    O3[Términos · área · horarios · submit]:::agent
    O1 --> O2 --> O3
  end

  subgraph work ["Trabajo"]
    W1([/agente/trabajos — open jobs]):::agent
    W2[ID Digital · purpose accept_job]:::agent
    W3[POST /agents/jobs/:code/accept]:::agent
    W4[O oferta: accept assignment]:::agent
    W1 --> W2 --> W3
    W4 --> W3
  end

  subgraph ops ["En la operación FUNDED / IN_PROGRESS"]
    P1[Checklist ítems]:::agent
    P2[Finalizar verificación]:::agent
    P3[Comprador acepta producto]:::buyer
    P4[Confirmar entrega del producto]:::agent
    P5[Comprador confirma arribo]:::buyer
    P1 --> P2 --> P3 --> P4
    P4 --> P5
  end

  subgraph money ["Dinero del agente"]
    M1[COMPLETED → comisión PENDING]:::pay
    M2[⏱ +14 días → AVAILABLE]:::deadline
    M3[Admin payout días 1–10 → PAID]:::system
    M1 --> M2 --> M3
  end

  O3 --> W1
  W3 --> P1
  P5 --> M1

  X1[Solicitar salida: intermediario REMOVED<br/>escrow intacto · “Buscando nuevo agente”]:::agent
  W3 -.-> X1

  classDef buyer fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
  classDef agent fill:#ccfbf1,stroke:#0f766e,color:#0f172a
  classDef pay fill:#dcfce7,stroke:#15803d,color:#0f172a
  classDef deadline fill:#fef9c3,stroke:#a16207,color:#0f172a
  classDef system fill:#f1f5f9,stroke:#475569,color:#0f172a
```

**ID Digital:** obligatorio al start de onboarding y en cada aceptación de trabajo (web). Credenciales: `ID_DIGITAL_*`. Detalle: [`ID_DIGITAL_AGENTS.md`](./ID_DIGITAL_AGENTS.md).

**Open jobs:** solo operaciones **fondeadas** visibles; el agente no “reserva” trabajo sin pago previo en el modo actual de producto.

---

## 7. Momentos de pago (detalle)

```mermaid
sequenceDiagram
  autonumber
  participant C as Comprador
  participant App as ConfiApp API
  participant MP as Mercado Pago / Prex
  participant Ag as Agente

  Note over C,Ag: Estado ACCEPTED + Agente asignado (fee-only)
  C->>App: POST .../checkout o manual-transfer
  alt PAYMENTS_CHECKOUT_MODE=mercadopago
    App->>MP: Preference Checkout Pro ($400)
    C->>MP: Paga (sandbox o live)
    MP-->>App: Webhook payment.updated
    C->>App: Vuelve ?pago=ok → sync-checkout
  else manual_prex
    C->>App: Sube comprobante
    Note over App: Admin confirma en /admin/pagos
  end
  App->>App: Hold CAPTURED · tx FUNDED
  App-->>Ag: Trabajo visible / notificaciones
```

| Momento | Quién | Qué ocurre |
|---------|-------|------------|
| Checkout | Comprador | Preferencia MP o panel Prex |
| Confirmación | Sistema / admin | Webhook, sync return, o admin Prex |
| `FUNDED` | Sistema | Retención; open jobs ven la op |
| Release | Sistema | Al completar entrega/arribo (o auto 72h) |
| Comisión | Sistema | `AgentCommission` PENDING → AVAILABLE (+14d) |
| Liquidación | Admin | PayoutBatch días **1–10** del mes |

OAuth MP de agentes (vincular cuenta): independiente del cobro al comprador — ver [`FINANCE_MVP_NOTES.md`](./FINANCE_MVP_NOTES.md).

---

## 8. Plazos (activación y efecto)

```mermaid
flowchart LR
  subgraph t21 ["Plazo operativo 21 días"]
    A1[ACCEPTED / join]:::system
    A2[operationDeadlineAt = now+21d]:::deadline
    A3{¿COMPLETED?}:::system
    A4[Job horario: email + in-app<br/>a Comprador y Agente<br/>¿abrir disputa?]:::deadline
    A5[operationDeadlineReminderSentAt]:::system
    A1 --> A2 --> A3
    A3 -->|no, plazo venció| A4 --> A5
    A3 -->|sí| OK[Sin recordatorio]:::system
  end

  subgraph t72 ["Plazo entrega 72 horas"]
    B1[Primera confirmación<br/>entrega O arribo]:::system
    B2[autoReleaseAt = +72h]:::deadline
    B3[~48h: reminder]:::deadline
    B4[72h: auto-completa la otra parte<br/>+ release → COMPLETED]:::deadline
    B1 --> B2 --> B3 --> B4
  end

  subgraph t14 ["Hold comisión 14 días"]
    C1[COMPLETED]:::system
    C2[Commission PENDING]:::pay
    C3[availableAt = +14d]:::deadline
    C4[AVAILABLE → payout 1–10]:::pay
    C1 --> C2 --> C3 --> C4
  end

  classDef pay fill:#dcfce7,stroke:#15803d,color:#0f172a
  classDef deadline fill:#fef9c3,stroke:#a16207,color:#0f172a
  classDef system fill:#f1f5f9,stroke:#475569,color:#0f172a
```

| Plazo | Constante | Se activa cuando | Efecto |
|-------|-----------|------------------|--------|
| **21 días** operativos | `OPERATION_DEADLINE_DAYS` | Acuerdo (`ACCEPTED` / join) | **No cancela.** Recordatorio a comprador + agente (1 vez). Copy: “más de 20 días”. |
| **72 horas** post-entrega | `DELIVERY_AUTO_RELEASE_MS` | Primera de: entrega agente **o** arribo comprador | Auto-completa la otra confirmación y libera |
| **14 días** comisión | `AGENT_COMMISSION_HOLD_DAYS` | `COMPLETED` | Comisión pasa a AVAILABLE; liquidación admin 1–10 |

`assertNotPastDeadline` es **no-op**: la operación sigue usable tras los 21 días.

---

## 9. Disputa (reclamo)

Término en producto: **disputa** (ayuda/términos también dicen “reclamo”).

```mermaid
flowchart TB
  B([Comprador: Reportar / No recibí el producto]):::buyer
  API[POST /disputes/transactions/:code/open]:::dispute
  ST[tx → DISPUTED<br/>comisión agente BLOCKED]:::dispute
  AD([Admin: /admin/disputas]):::system
  R1[RESUME → IN_PROGRESS]:::system
  R2[CANCEL → CANCELLED]:::dispute
  R3[COMPLETE_WITH_REFUND]:::dispute
  B --> API --> ST --> AD
  AD --> R1
  AD --> R2
  AD --> R3

  classDef buyer fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
  classDef dispute fill:#fee2e2,stroke:#b91c1c,color:#0f172a
  classDef system fill:#f1f5f9,stroke:#475569,color:#0f172a
```

| Quién | Puede |
|-------|--------|
| Comprador | Abrir disputa en `FUNDED` / `IN_PROGRESS` |
| Vendedor / Agente | No abren disputa; reciben efectos / notificaciones |
| Admin | Resolver: reanudar, cancelar, reembolso |

---

## 10. Swimlane resumido (los tres roles)

```mermaid
flowchart TB
  subgraph Comprador
    direction TB
    c1[Crear o unirse]:::buyer
    c2[Pagar contratación $400]:::pay
    c3[Aceptar producto]:::buyer
    c4[Confirmar arribo]:::buyer
    c5[Abrir disputa si hace falta]:::dispute
  end

  subgraph Vendedor
    direction TB
    s1[Crear o unirse]:::seller
    s2[Confirmar venta / condiciones]:::seller
    s3[Esperar fondeo y entrega]:::seller
  end

  subgraph Agente
    direction TB
    a1[Onboarding + ID Digital]:::agent
    a2[Aceptar trabajo + ID Digital]:::agent
    a3[Checklist / verificación]:::agent
    a4[Confirmar entrega]:::agent
    a5[Comisión 14d → liquidación]:::pay
  end

  c1 <--> s1
  c1 --> a2
  s1 --> a2
  a2 --> c2
  c2 --> a3
  a3 --> c3
  c3 --> a4
  a4 --> c4
  c4 --> a5
  c5 -.-> a5

  classDef buyer fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
  classDef seller fill:#ffedd5,stroke:#c2410c,color:#0f172a
  classDef agent fill:#ccfbf1,stroke:#0f766e,color:#0f172a
  classDef pay fill:#dcfce7,stroke:#15803d,color:#0f172a
  classDef dispute fill:#fee2e2,stroke:#b91c1c,color:#0f172a
```

---

## 11. Rutas web por rol

| Rol | Rutas |
|-----|-------|
| Comprador / Vendedor | `/operaciones`, `/operaciones/nueva/*`, `/operaciones/unirse/:token`, `/operaciones/:code`, `/operaciones/:code/pagar`, `/wallet`, `/mensajes`, `/notificaciones` |
| Agente | `/agente`, `/agente/trabajos`, `/agente/buscar` (+ mismas ops como intermediario) |
| Admin | `/admin/pagos`, `/admin/finanzas`, `/admin/disputas`, `/auditoria` |

---

## 12. Jobs / timers (sistema)

| Job | Frecuencia aprox. | Efecto |
|-----|-------------------|--------|
| `expireOperationalDeadlines` | 1 h | Recordatorio 21d (email + in-app); **no cancela** |
| `autoCompleteStaleDeliveries` | 15 min | Auto 72h entrega/arribo + release |
| `releaseDue` comisiones | 15 min | PENDING → AVAILABLE tras 14d |
| Expire ofertas agente | 15 s | Ofertas de asignación vencidas |

Endpoints: `POST /transactions/jobs/expire-deadlines`, `.../auto-delivery`, `POST /finance/jobs/release-commissions` (header `x-job-secret`).

---

## 13. Archivos ancla

```text
Estados / funding     packages/database/src/types/enums.ts
State machine         apps/api/src/modules/transactions/state-machine.ts
Plazo 21d             apps/api/src/modules/transactions/operation-deadline.ts
Plazo 72h             apps/api/src/modules/transactions/delivery-deadline.ts
Pagos                 apps/api/src/modules/payments/service.ts
Agentes               apps/api/src/modules/agents/*
Disputas              apps/api/src/modules/disputes/service.ts
Comisiones            apps/api/src/modules/finance/commission.service.ts
Constantes $400/14d   packages/shared/src/finance-constants.ts
UI detalle por rol    apps/web/src/features/transactions/ui/*OperationDetail.tsx
Legal / ayuda         apps/web/src/features/legal/content/{terms,help}.ts
```

---

## Ver también

- [`WEB_APP.md`](./WEB_APP.md) — pantallas y copy
- [`FINANCE_MVP_NOTES.md`](./FINANCE_MVP_NOTES.md) — cobro Prex/MP, OAuth agentes
- [`CONFIAPP_FINANCIAL_MVP.md`](./CONFIAPP_FINANCIAL_MVP.md) — spec financiera
- [`ID_DIGITAL_AGENTS.md`](./ID_DIGITAL_AGENTS.md) — Identidad Digital Abitab
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — monorepo
