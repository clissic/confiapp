# Identidad Digital Abitab — Agentes ConfiApp

> **Estado:** **implementado** en API/web (2026-09). Requiere `ID_DIGITAL_CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI` en el entorno.  
> Flujos de operación donde interviene: [`OPERATION_FLOWS.md`](./OPERATION_FLOWS.md) §6.

## 1. Objetivo

Confirmar la identidad de los **Agentes** mediante **Identidad Digital Abitab (ID Digital 2.0)**.

- **Quién:** usuarios en onboarding o activos como Agente.
- **Cuándo:**
  1. Al **inicio del onboarding** para convertirse en Agente (reemplaza la *exigencia* del KYC por fotos).
  2. En **cada aceptación de un trabajo** (misma autenticación ID Digital que en el alta).
- **Quién no:** compradores, vendedores y admin para estos gates (siguen sin ID Digital obligatorio).

No reemplaza ni elimina el flujo KYC por fotos + review admin: ese canal **sigue existiendo** como verificación de menor valor para la app. Solo se **quita el bloqueo** del wizard de agente que exige “identidad verificada (DNI/pasaporte con fotos)” (`BecomeAgentPage`).

## 2. Documentación externa

| Recurso | URL |
|---------|-----|
| Primeros pasos | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/first-steps |
| Flujo authorization code (recomendado) | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/authorization-flows/code |
| Flujo implícito (claims del `id_token`) | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/authorization-flows/implicit |
| Definiciones | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/definitions |
| Soporte | ayuda@id.com.uy |

Resumen del proveedor:

1. Credenciales: `client_id` + `client_secret` (solo backend).
2. Registrar `redirect_uri` HTTPS en ID Digital.
3. Flujo de autorización (preferimos **authorization code**).
4. Datos de identidad vía `id_token` / API según documentación.

## 3. Decisiones de producto (2026-09-26)

| # | Decisión | Detalle |
|---|----------|---------|
| D1 | Alcance | Solo flujos de **Agente** (onboarding + aceptar trabajo). |
| D2 | Onboarding | ID Digital **al inicio** del alta de agente; **deja de ser obligatorio** el KYC por fotos para continuar el wizard. |
| D3 | KYC fotos | **Se conserva** el sistema de fotos + admin review; deja de ser gate del onboarding de agente. |
| D4 | Aceptar trabajo | Cada vez que un agente **acepta** un trabajo → nueva autenticación ID Digital (mismo método que en el registro/onboarding). |
| D5 | Login app | **No** se exige ID Digital en cada login email/password (supersede decisión 2026-08-29 de step-up por login). |
| D6 | Método actual | `acr_values=pin` (PIN en la app ID Digital). |
| D7 | Roadmap ACR | Escalar luego a `liveness` (reconocimiento facial). Ver README. |
| D8 | Flujo OAuth | **Authorization code** en producción (secreto en API). Claims de usuario según lo documentado para el `id_token` (tabla del [flujo implícito](https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/authorization-flows/implicit)): `sub`, nombres, `email`, `acr`, `amr`, etc. |
| D9 | Credenciales | Aún **no** hay `client_id` / `client_secret`; primero definir y registrar `redirect_uri`(s). |
| D10 | Plataforma | Solo **web** por ahora. Flujo móvil/nativo cuando existan apps nativas. |
| D11 | Matching | Validar identidad contra la cuenta ConfiApp con los claims disponibles del proveedor (p. ej. `sub` vinculado a la cuenta agente; documento si el proveedor lo expone en userinfo/`id_token` según paquete comercial). |

### Relación con el KYC actual

```text
Antes:  BecomeAgent → exige identityVerified (fotos KYC) → términos → …
Ahora:  BecomeAgent → exige ID Digital (PIN) → términos → …
        Configuración → “Verificar identidad” (fotos) sigue disponible, sin bloquear el wizard.
```

Gate a reemplazar en UI: alerta en `apps/web/.../BecomeAgentPage.tsx`  
(“Para continuar necesitás tener la identidad verificada…”).

Segundo gate: aceptar oferta/trabajo (p. ej. `acceptOffer` / UI de trabajos abiertos) → exigir prueba ID Digital fresca antes de confirmar.

## 4. Flujo acordado (a implementar)

### 4.1 Onboarding agente

```text
Usuario autenticado ConfiApp → /agente (onboarding)
  → Si no hay idDigitalVerifiedAt / flag de sesión de onboarding:
       GET /auth/id-digital/start?purpose=agent_onboarding
       → redirect ID Digital (acr=pin)
       → callback: code → tokens → validar id_token (iss, aud, exp, …)
       → marcar step-up onboarding OK
  → Continuar wizard (términos, zona, etc.) sin exigir KYC fotos
```

### 4.2 Aceptar trabajo

```text
Agente → Aceptar trabajo / oferta
  → GET /auth/id-digital/start?purpose=accept_job&jobId=… (o notificationId)
  → ID Digital (pin) → callback
  → Solo entonces acceptOffer / claim del trabajo
```

### 4.3 Redirect URIs a registrar (borrador)

Definir con Abitab antes de pedir credenciales. Ejemplos:

| Entorno | URI (tentativa) |
|---------|-----------------|
| Local | `http://localhost:3001/auth/id-digital/callback` (si el proveedor allowlista HTTP local) o túnel HTTPS |
| Staging / prod | `https://<dominio-confiapp>/auth/id-digital/callback` |

La API puede recibir el callback y luego redirigir al front, o el front recibe y manda el `code` al backend — decidir en implementación (preferible: callback front → API exchange, o callback API → redirect front).

## 5. URLs del proveedor

| Uso | URL primaria | Alternativa |
|-----|--------------|-------------|
| Authorize | `https://login.identidaddigital.com.uy/v2/authorize` | Si falla de forma sistemática, evaluar hosts del paquete / `auth.identificaciondigital.com.uy` (ver README) |
| Token (ejemplo doc) | Host en ejemplos: `auth.identificaciondigital.com.uy` — `POST /api/v2/openid/token` | Confirmar con credenciales oficiales |
| Issuer (`iss` en id_token) | `https://auth.identificaciondigital.com.uy/api/v2/openid` | Según [flujo implícito](https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/authorization-flows/implicit) |

Hay **dos ortografías de dominio** en la documentación del proveedor (`identidaddigital` vs `identificaciondigital`). Asumir authorize en `login.identidaddigital.com.uy` y no descartar el host `auth.identificaciondigital.com.uy` para token/`iss`. Documentado también en el README raíz.

## 6. Claims del `id_token` (referencia)

Según la documentación del [flujo implícito](https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/authorization-flows/implicit) (misma forma de JWT / claims a usar como referencia de identidad):

| Claim | Uso |
|-------|-----|
| `iss` | Verificar emisor esperado |
| `aud` | Debe ser nuestro `client_id` |
| `nonce` | Obligatorio en implícito; recomendable también en code si se usa |
| `iat` / `exp` | Ventana de validez |
| `sub` | Identificador único del usuario en ID Digital (vincular a User) |
| `first_name`, `second_name`, `last_name`, `second_last_name` | Perfil |
| `email` | Correo en ID Digital |
| `acr` | Nivel (`loa2` / `loa3`) |
| `amr` | Métodos usados (p. ej. pin) |

**Nota:** el flujo de implementación será **authorization code** (más seguro). El implícito se usa como **fuente de verdad de claims**; el exchange del `code` ocurre solo en el backend.

## 7. Diseño técnico previsto (sin código aún)

### Backend

- Env: `ID_DIGITAL_CLIENT_ID`, `ID_DIGITAL_CLIENT_SECRET`, `ID_DIGITAL_AUTH_URL`, `ID_DIGITAL_TOKEN_URL`, `ID_DIGITAL_REDIRECT_URI`, `ID_DIGITAL_ACR_VALUES=pin`, `ID_DIGITAL_SCOPE=openid profile`, `ID_DIGITAL_ISSUER`.
- `GET /auth/id-digital/start` — `purpose`: `agent_onboarding` | `accept_job`; genera `state` (+ `nonce`); exige sesión.
- `GET` o `POST /auth/id-digital/callback` — valida `state`, intercambia `code`, valida `id_token`, audita.
- Persistencia: vínculo `User` ↔ `sub` ID Digital; timestamp de última verificación por propósito; para `accept_job`, prueba de vida reciente atada al job/oferta.
- Guardas: onboarding agente y `acceptOffer` requieren verificación ID Digital válida para ese acto.

### Frontend

- Sustituir alerta KYC del primer paso del wizard por CTA “Verificar con Identidad Digital Abitab”.
- Pantalla/ruta de callback (fragment no aplica en code flow: query `?code=&state=`).
- Al aceptar trabajo: interrumpir → ID Digital → reanudar aceptación.
- No montar flujo móvil nativo todavía.

### KYC fotos

- Mantener `/perfil` → Verificar identidad, emails admin, endpoints KYC.
- Quitar (solo) el `if (!identityVerified)` que bloquea términos / Continuar en onboarding agente.

## 8. Checklist previo a implementar

- [ ] Definir y registrar `redirect_uri` (local + prod) con Abitab
- [ ] Obtener `client_id` / `client_secret`
- [ ] Confirmar URL exacta de token y JWKS (si aplica) con el paquete comercial
- [ ] Cerrar si el documento/CI viene en userinfo o solo `sub`+nombre
- [ ] Env + cliente HTTP en API
- [ ] `start` + `callback` + `state` persistido (TTL corto)
- [ ] Quitar gate fotos en `BecomeAgentPage` (no borrar módulo KYC)
- [ ] Gate en aceptar trabajo
- [ ] UI errores (`error` / `error_description` del redirect)
- [ ] Tests happy path + cancelación + state inválido
- [ ] Solo web; mobile documented as later

## 9. Referencias internas

| Doc / código | Relación |
|--------------|----------|
| [`README.md`](../README.md) | Roadmap PIN → liveness; URLs primarias/alternativas |
| [`WEB_APP.md`](./WEB_APP.md) | Rutas agente |
| KYC fotos | `KycDocumentsSection`, admin review |
| Gate actual onboarding | `BecomeAgentPage.tsx` (alerta identidad verificada) |
| Aceptar trabajo | `AgentAssignmentService.acceptOffer`, UI agent-ops |
