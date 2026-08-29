# ConfiApp — Especificación Financiera MVP

**Versión:** 1.1  
**Estado:** Implementación MVP  
**Moneda operativa:** UYU  
**Proveedor de pagos (objetivo):** Mercado Pago  
**Cobro comprador (transitorio MVP):** transferencia manual a cuenta Prex de la plataforma + comprobante (`PAYMENTS_CHECKOUT_MODE=manual_prex`). El flujo Checkout Pro / webhooks / OAuth permanece en el código y se reactiva con `PAYMENTS_CHECKOUT_MODE=mercadopago`.  
**Payouts de Agentes:** Manuales  
**Período de disponibilidad:** 21 días

---

# 1. DIRECTIVA PRINCIPAL PARA EL AGENTE DE IA

Este documento constituye la especificación técnica y funcional oficial para implementar el sistema financiero del MVP de ConfiApp.

El Agente de IA desarrollador debe:

1. Leer completamente este documento antes de modificar código.
2. Auditar primero el proyecto existente.
3. Reutilizar la arquitectura existente cuando sea razonable.
4. No inventar funcionalidades, APIs o capacidades de Mercado Pago.
5. No modificar funcionalidades no relacionadas sin justificación.
6. Implementar por fases.
7. Ejecutar tests después de cada fase.
8. No continuar si una fase deja errores críticos sin resolver.
9. Priorizar integridad financiera sobre velocidad de implementación.
10. Nunca confiar en cálculos financieros realizados por el frontend.
11. Toda decisión financiera definitiva debe ejecutarse en backend.
12. Mantener trazabilidad completa de las operaciones financieras.
13. Nunca eliminar ni modificar destructivamente registros financieros históricos.
14. Utilizar transacciones, constraints e idempotencia donde corresponda.
15. Si una decisión necesaria no está definida en este documento, detenerse y documentar la ambigüedad antes de inventar una regla.

---

# 2. CONTEXTO DEL PRODUCTO

ConfiApp es una plataforma C2C para operaciones entre particulares.

La plataforma combina:

- acuerdo digital
- encuentro físico
- comprador
- vendedor
- Agente intermediario
- checklist de entrega
- evidencia del proceso
- pago protegido
- reputación
- chat
- notificaciones
- verificación de identidad
- historial de estados
- auditoría

El Agente actúa como intermediario de la operación.

Cuando una operación finaliza exitosamente, el Agente recibe económicamente el 80% de la comisión cobrada por ConfiApp.

ConfiApp conserva el 20%.

---

# 3. MODELO FINANCIERO DEL MVP

## 3.1 Moneda

La moneda operativa actual es exclusivamente:

`UYU`

Todos los valores financieros actuales deben manejarse en UYU:

- precio del producto
- comisión
- fee del comprador
- fee del vendedor
- participación del Agente
- participación de ConfiApp
- pagos
- refunds
- balances
- ledger
- payouts
- reportes
- auditoría

La arquitectura puede conservar un campo `currency` para permitir expansión futura, pero solamente `UYU` debe estar habilitado.

Las demás monedas deben permanecer deshabilitadas.

El backend debe rechazar operaciones financieras utilizando monedas no habilitadas.

---

# 4. TABLA OFICIAL DE COMISIONES

La comisión depende directamente del precio del producto expresado en UYU.

| Precio del producto | Comisión |
|---|---:|
| $0 – < $8.000 | $400 |
| $8.000 – < $24.000 | $600 |
| $24.000 – < $48.000 | $800 |
| $48.000 – < $80.000 | $1.000 |
| $80.000 o más | $1.400 |

Los límites son inclusivos/exclusivos exactamente como aparecen en la tabla.

## Casos obligatorios

```text
$7.999  → $400
$8.000  → $600

$23.999 → $600
$24.000 → $800

$47.999 → $800
$48.000 → $1.000

$79.999 → $1.000
$80.000 → $1.400
```

La función de cálculo de comisión debe encontrarse centralizada en backend.

No duplicar esta lógica en frontend.

---

# 5. DISTRIBUCIÓN DE LA COMISIÓN

La comisión corresponde a ConfiApp.

La distribución económica interna es:

```text
Agente      = 80%
ConfiApp    = 20%
```

Fórmulas:

```text
agentShare = commission × 0.80
platformShare = commission × 0.20
```

Debe cumplirse siempre:

```text
agentShare + platformShare = commission
```

La distribución se aplica sobre la comisión.

Nunca sobre el precio del producto.

---

# 6. FEE PAYER

La comisión puede ser pagada por:

```text
BUYER
SELLER
SPLIT
```

## 6.1 BUYER

El comprador paga:

```text
productPrice + commission
```

El vendedor recibe:

```text
productPrice
```

Ejemplo:

```text
Producto:       $30.000
Comisión:          $800

Comprador paga: $30.800
Vendedor recibe: $30.000

Agente:             $640
ConfiApp:           $160
```

---

# 7. SELLER

El comprador paga:

```text
productPrice
```

El vendedor recibe:

```text
productPrice - commission
```

Ejemplo:

```text
Producto:       $30.000
Comisión:          $800

Comprador paga: $30.000
Vendedor recibe: $29.200

Agente:             $640
ConfiApp:           $160
```

---

# 8. SPLIT

La comisión se divide entre comprador y vendedor.

Regla:

```text
buyerFee + sellerFee = commission
```

Cuando la división no sea exactamente divisible, utilizar una regla determinista de redondeo.

Nunca debe aparecer ni desaparecer dinero por redondeos.

Ejemplo:

```text
Producto:       $30.000
Comisión:          $800

Comprador paga: $30.400
Vendedor recibe: $29.600

Agente:             $640
ConfiApp:           $160
```

---

# 9. PRECISIÓN MONETARIA

Nunca utilizar `float` para valores financieros.

Los importes deben representarse como enteros en unidades mínimas de UYU.

Ejemplo:

```text
$640,50 UYU
```

debe almacenarse como:

```text
64050
```

La estrategia monetaria debe ser consistente en:

- backend
- base de datos
- APIs
- servicios
- ledger
- payouts
- tests

---

# 10. MERCADO PAGO

Mercado Pago será el proveedor de pagos del MVP.

La integración debe encapsularse detrás de una abstracción:

```text
PaymentProvider
```

Debe contemplar conceptualmente:

```text
createPayment
getPayment
cancelPayment
refundPayment
createCheckout
handleWebhook
getPaymentStatus
```

El Agente de IA debe utilizar únicamente APIs y capacidades realmente disponibles para la cuenta y país configurados.

No inventar endpoints.

No asumir funcionalidades no habilitadas.

---

# 11. MODELO DE PAGOS

El MVP utilizará un modelo 1:1.

Conceptualmente:

```text
                 OPERACIÓN
                     │
          ┌──────────┴──────────┐
          │                     │
      PRODUCTO              COMISIÓN
          │                     │
          ▼                     ▼
      VENDEDOR              CONFIAPP
                                │
                                │ 80%
                                ▼
                         AGENT LEDGER
```

El dinero correspondiente al producto pertenece al vendedor.

La comisión pertenece a ConfiApp.

El 80% correspondiente al Agente se registra contablemente dentro del sistema.

No realizar transferencia automática del 80% al Agente.

---

# 12. AGENT LEDGER

El saldo del Agente debe implementarse mediante un ledger contable interno.

No utilizar simplemente:

```text
agent.walletBalance += amount
```

como única fuente de verdad.

El ledger debe permitir reconstruir el balance completo.

Cada movimiento debe ser inmutable.

Tipos mínimos:

```text
COMMISSION_EARNED
COMMISSION_AVAILABLE
PAYOUT_RESERVED
PAYOUT_COMPLETED
PAYOUT_REVERSED
ADJUSTMENT
```

---

# 13. ESTADOS DEL LEDGER

Las ganancias del Agente deben utilizar:

```text
PENDING
AVAILABLE
PAID
```

## PENDING

La operación terminó exitosamente, pero todavía no transcurrieron los 21 días.

## AVAILABLE

Transcurrieron exactamente 21 días y el dinero puede ser incluido en una liquidación.

## PAID

El administrador confirmó que realizó la transferencia al Agente.

---

# 14. REGLA DE LOS 21 DÍAS

Cuando una operación pasa a estado:

```text
COMPLETED
```

debe establecerse:

```text
availableAt = completedAt + 21 días
```

Ejemplo:

```text
COMPLETED:
11/08/2026 18:00

AVAILABLE:
01/09/2026 18:00
```

La disponibilidad debe calcularse exclusivamente en backend.

El frontend no puede modificar:

```text
availableAt
```

---

# 15. JOB DE DISPONIBILIDAD

Implementar un worker, cron o job equivalente que busque:

```text
availableAt <= currentTime
AND status = PENDING
```

y convierta las ganancias a:

```text
AVAILABLE
```

El proceso debe ser:

- idempotente
- transaccional
- reintentable
- seguro ante concurrencia
- auditable

No generar duplicaciones.

No crear una segunda ganancia.

No modificar el importe.

---

# 16. WALLET DEL AGENTE

La interfaz del Agente debe mostrar:

```text
Total ganado
Pendiente
Disponible
Liquidado
```

Ejemplo:

```text
Ganado:       $12.450
Pendiente:     $3.200
Disponible:   $6.750
Liquidado:     $2.500
```

Cada movimiento debe mostrar:

- operación
- fecha
- comisión
- participación del Agente
- importe
- estado
- fecha de disponibilidad
- payout relacionado

El balance mostrado debe derivarse del ledger.

---

# 17. PAYOUTS MANUALES

Durante el MVP, los Agentes NO reciben transferencias automáticas.

El administrador financiero realizará las transferencias manualmente.

Crear:

```text
PayoutBatch
Payout
```

---

# 18. PAYOUT BATCH

Campos mínimos:

```text
id
createdBy
createdAt
totalAmount
numberOfPayouts
status
notes
```

Estados:

```text
DRAFT
PENDING_TRANSFER
PARTIALLY_PAID
PAID
CANCELLED
```

---

# 19. PAYOUT

Campos mínimos:

```text
id
batchId
agentId
amount
status
transferDate
transferReference
paymentMethod
proofUrl
processedBy
processedAt
notes
```

Estados:

```text
PENDING
PROCESSING
PAID
FAILED
CANCELLED
```

---

# 20. RESERVA DE SALDO

Cuando se crea un payout:

```text
AVAILABLE
```

debe quedar reservado para ese payout.

El mismo saldo no puede formar parte de otro payout.

Evitar doble liquidación mediante:

- transacciones
- constraints
- locks cuando correspondan
- idempotencia

---

# 21. CONFIRMACIÓN DE PAGO MANUAL

Cuando el administrador confirma una transferencia:

1. validar payout
2. validar importe
3. validar Agente
4. registrar referencia
5. registrar fecha
6. registrar administrador
7. registrar comprobante si corresponde
8. marcar payout como PAID
9. registrar `PAYOUT_COMPLETED`
10. registrar auditoría

Nunca eliminar registros anteriores.

---

# 22. ROLES Y PERMISOS

Solamente usuarios autorizados con permisos financieros podrán:

- consultar información financiera administrativa
- crear PayoutBatch
- crear Payout
- reservar fondos
- confirmar transferencias
- marcar payouts como PAID

Un Agente solamente puede consultar sus propios movimientos.

Un Agente nunca puede consultar:

- saldo de otro Agente
- payout de otro Agente
- información bancaria de otro Agente
- información financiera interna de ConfiApp

---

# 23. REFUNDS

Implementar refunds sin destruir historial financiero.

Tipos:

```text
REFUND_TOTAL
REFUND_PARTIAL
```

Nunca eliminar una comisión existente.

Las correcciones financieras deben utilizar entradas compensatorias.

Si la comisión del Agente todavía está PENDING:

```text
PENDING → REVERSED
```

Si está AVAILABLE pero no fue liquidada:

```text
AVAILABLE → REVERSED
```

Si ya fue liquidada:

crear una entrada negativa/compensatoria en el ledger.

Nunca modificar retrospectivamente movimientos históricos.

---

# 24. DISPUTAS

Una disputa puede impedir que una ganancia pase a AVAILABLE.

Mientras exista una condición que bloquee la liquidación:

```text
PENDING
```

debe permanecer bloqueada.

La resolución de la disputa debe generar los movimientos financieros correspondientes.

Todo debe quedar auditado.

---

# 25. AUDITORÍA FINANCIERA

Crear:

```text
FinancialAuditEvent
```

Registrar como mínimo:

```text
eventId
operationId
paymentId
commissionId
agentId
payoutId
actorId
actorRole
action
amount
previousStatus
newStatus
metadata
timestamp
idempotencyKey
```

Los eventos históricos no pueden editarse ni eliminarse.

Debe ser posible reconstruir una operación financiera completa a partir de la auditoría.

---

# 26. RECONCILIACIÓN

Implementar:

```text
reconcileOperation(operationId)
reconcileAgent(agentId)
```

Deben detectar:

- comisión faltante
- comisión duplicada
- payout duplicado
- balance incorrecto
- payment sin operación
- operación sin payment
- payout sin ledger
- ledger sin operación
- estados inválidos
- inconsistencias de importes

---

# 27. WEBHOOKS

Los webhooks de Mercado Pago deben:

- validarse
- persistirse
- procesarse de forma idempotente
- soportar retries
- soportar eventos fuera de orden
- registrar auditoría

Nunca confiar exclusivamente en el frontend para determinar el estado del pago.

El backend debe verificar el estado real del pago.

Un webhook duplicado nunca debe generar:

- segundo pago
- segunda comisión
- segunda entrada de ledger
- segundo payout

---

# 28. SEGURIDAD

El frontend nunca debe poder modificar directamente:

```text
productPrice
commission
agentShare
platformShare
walletBalance
availableAt
paymentStatus
commissionStatus
payoutStatus
```

Todos estos valores deben ser controlados por backend.

Auditar especialmente:

- IDOR
- manipulación de IDs
- manipulación de importes
- manipulación de Agentes
- doble payout
- replay attacks
- webhooks falsos
- permisos administrativos
- secrets
- OAuth
- información bancaria

---

# 29. ABSTRACCIÓN DE PAYOUTS

Preparar arquitectura para una futura automatización.

Crear:

```text
PayoutProvider
```

Conceptualmente:

```text
createPayout()
getPayout()
cancelPayout()
executePayout()
getPayoutStatus()
```

El MVP utilizará:

```text
ManualPayoutProvider
```

Este provider no realiza transferencias automáticamente.

En el futuro podrá implementarse:

```text
AutomatedPayoutProvider
```

El sistema financiero no debe depender del proveedor utilizado.

La futura automatización debe poder implementarse sin modificar:

- Commission
- AgentLedger
- AgentBalance
- Operation
- FinancialAudit
- reglas de comisión
- regla de 21 días

---

# 30. TESTS OBLIGATORIOS

Implementar tests unitarios, integración y end-to-end.

## Caso principal

```text
Producto:       $30.000
Comisión:          $800
Agente:            $640
ConfiApp:          $160
feePayer:        BUYER
```

Flujo:

```text
CREATED
↓
AGREED
↓
PAYMENT_PENDING
↓
PAYMENT_CONFIRMED
↓
FUNDS_PROTECTED
↓
MEETING_SCHEDULED
↓
MEETING_STARTED
↓
CHECKLIST_IN_PROGRESS
↓
DELIVERY_CONFIRMED
↓
COMPLETED
↓
Commission = $800
↓
Agent = $640 PENDING
↓
21 días
↓
$640 AVAILABLE
↓
Payout creado
↓
Saldo reservado
↓
Transferencia manual
↓
Payout PAID
↓
$640 liquidado
```

Probar además:

- BUYER
- SELLER
- SPLIT
- todos los escalones
- límites exactos
- refunds
- disputas
- webhooks duplicados
- webhooks fuera de orden
- retries
- concurrencia
- doble payout
- manipulación de balances
- permisos incorrectos

---

# 31. CRITERIOS DE ACEPTACIÓN

La implementación se considera correcta únicamente si:

- las comisiones coinciden exactamente con la tabla
- el Agente recibe contablemente 80%
- ConfiApp conserva 20%
- el precio del producto no se diluye
- el fee payer funciona correctamente
- las ganancias quedan PENDING durante 21 días
- AVAILABLE solamente contiene fondos liberados
- un mismo saldo nunca puede pagarse dos veces
- los payouts manuales son auditables
- los refunds generan compensaciones correctas
- los webhooks son idempotentes
- el frontend no puede manipular importes financieros
- el ledger permite reconstruir los balances
- existe trazabilidad completa
- los tests pasan
- la reconciliación no encuentra inconsistencias

---

# 32. ORDEN DE IMPLEMENTACIÓN

Implementar estrictamente en este orden:

### Fase 1
Auditoría del proyecto.

### Fase 2
Modelo de datos financiero.

### Fase 3
Motor de comisiones.

### Fase 4
Integración Mercado Pago.

### Fase 5
Máquina de estados.

### Fase 6
Webhooks e idempotencia.

### Fase 7
Regla de disponibilidad de 21 días.

### Fase 8
Wallet/ledger del Agente.

### Fase 9
Payouts manuales.

### Fase 10
Panel administrativo financiero.

### Fase 11
Refunds y disputas.

### Fase 12
Auditoría y reconciliación.

### Fase 13
Tests end-to-end.

### Fase 14
Auditoría de seguridad.

### Fase 15
Abstracción para futuros payouts automáticos.

### Fase 16
Auditoría final.

---

# 33. REGLA DE EJECUCIÓN

Después de completar cada fase:

1. ejecutar tests
2. comprobar migraciones
3. comprobar integridad de datos
4. comprobar lint/type checking
5. revisar errores
6. documentar cambios
7. continuar con la siguiente fase solamente si la fase actual está estable

No declarar la implementación terminada si existen:

- errores financieros
- tests fallando
- inconsistencias de ledger
- problemas de idempotencia
- problemas de autorización
- doble payout posible
- estados imposibles

Si se encuentra una ambigüedad funcional no definida en este documento:

**NO inventar una solución silenciosamente.**

Documentar la ambigüedad, indicar las alternativas y solicitar decisión antes de implementar una regla que pueda afectar dinero.

---

# 34. RESULTADO FINAL ESPERADO

El MVP debe permitir:

```text
COMPRADOR
    │
    │ paga producto + comisión
    ▼
MERCADO PAGO
    │
    ├──────────────► VENDEDOR
    │
    └──────────────► CONFIAPP
                           │
                           │ 80%
                           ▼
                    AGENT LEDGER
                           │
                       21 días
                           │
                           ▼
                       AVAILABLE
                           │
                           ▼
                    PAYOUT MANUAL
                           │
                           ▼
                         AGENTE
```

La arquitectura debe ser suficientemente robusta para manejar el MVP manualmente y suficientemente desacoplada para permitir automatización futura de las liquidaciones sin rehacer el sistema financiero.