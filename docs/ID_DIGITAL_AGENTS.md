# Identidad Digital Abitab — Agentes ConfiApp

> **Estado:** **implementado** en API/web (2026-09). Requiere `ID_DIGITAL_CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI` en el entorno.  
> **Validado contra ID Digital STG (2026-11-11)** con credenciales de testing de Abitab: hosts, firma RS256/JWKS, claims reales del `id_token` y userinfo (ver §5, §6 y §6.1).  
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
| D11 | Matching | Validar identidad contra la cuenta ConfiApp con los claims disponibles del proveedor (p. ej. `sub` vinculado a la cuenta agente; documento si el proveedor lo expone en userinfo/`id_token` según paquete comercial). **Implementación (2026-11):** ver §6.2. |

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

Confirmadas con el discovery (`/.well-known/openid-configuration`) y una prueba real con credenciales STG (2026-11-11):

| Uso | URL | Env |
|-----|-----|-----|
| Authorize | `https://login.identificaciondigital.com.uy/v2/authorize` | `ID_DIGITAL_AUTH_URL` |
| Token | `https://auth.identificaciondigital.com.uy/api/v2/openid/token` (`POST`, Basic auth `client_id:client_secret`) | `ID_DIGITAL_TOKEN_URL` |
| Issuer (`iss`) | `https://auth.identificaciondigital.com.uy/api/v2/openid` | `ID_DIGITAL_ISSUER` |
| JWKS | `https://auth.identificaciondigital.com.uy/api/v2/openid/jwks` | `ID_DIGITAL_JWKS_URL` (vacío = `${ISSUER}/jwks`) |
| Userinfo | `https://auth.identificaciondigital.com.uy/api/v2/openid/userinfo` (`GET`, `Bearer access_token`) | `ID_DIGITAL_USERINFO_URL` (vacío = `${ISSUER}/userinfo`) |

**Corrección:** versiones anteriores de este doc indicaban authorize en `login.identidaddigital.com.uy`; el host correcto es **`login.identificaciondigital.com.uy`** (el `identidaddigital` solo aparece en el sitio de documentación `integracion-id-digital-2-0.identidaddigital.com.uy`).

Respuesta del token endpoint: `access_token`, `expires_in`, `id_token`, `refresh_token`, `token_type`.

## 6. Claims del `id_token` (confirmados)

El `id_token` está firmado con **RS256** y trae `kid` en el header. La API verifica la firma contra el JWKS (cache de claves en memoria por `kid`, refetch ante `kid` desconocido) y **rechaza `alg: none` y HS\***.

Claims que devuelve ID Digital en el authorization code flow:

| Claim | Valor / uso |
|-------|-------------|
| `iss` | Verificar emisor esperado |
| `aud` | Debe ser nuestro `client_id` |
| `iat` / `exp` / `auth_time` | Ventana de validez (`exp` con 60 s de tolerancia) |
| `sub` | Identificador único del usuario en ID Digital (vincular a `User.idDigital.sub`); coincide con el `sub` del userinfo |
| `first_name`, `second_name`, `last_name`, `second_last_name` | Perfil |
| `email` | Correo en ID Digital |
| `acr` | Método/nivel usado: **`pin`** con `acr_values=pin` |
| `amr` | **Llega `null`**. El método efectivo que guardamos (`idDigital.lastMethods`) es `amr` si trae valores; si no, `[acr]` |
| `at_hash` | Hash del access_token (no se usa) |

**`nonce`:** ID Digital **no devuelve `nonce`** en el `id_token`, aunque se envíe en authorize. La API lo sigue enviando y:

- si el token **no trae** `nonce` → se acepta: el `state` aleatorio de un solo uso (persistido con TTL de 10 min y borrado al usarse) protege contra CSRF/replay, y el `code` solo lo puede canjear nuestro backend con `client_secret`;
- si el token **trae** un `nonce` distinto al generado → se rechaza (`reason=token_nonce`).

**La CI no viene en el `id_token`**: hay que leerla del userinfo.

### 6.1 Userinfo (confirmado)

`GET userinfo` con `Authorization: Bearer <access_token>` devuelve: `sub`, `acr`, `amr`, `birth_date`, `document { document_country, document_number, document_type }`, `email`, `first_name`, `middle_name`, `last_name`, `phone`, `registration_level`, `registration_level_description`, `validation_methods [{ name, last_validation_date }]`.

- La **CI** está en `document.document_number`.
- En el callback se llama al userinfo después de validar el `id_token`; se exige que su `sub` coincida (si no, se descarta y se audita).
- Se persiste en `User.idDigital`: `document { number, type, country }`, `registrationLevel`, `registrationLevelDescription`, `validationMethods`, `userInfoFetchedAt`. **No** se guardan teléfono ni fecha de nacimiento.
- Si el userinfo falla (HTTP, red, JSON, sin `sub`), **el login no se rompe**: se audita `ID_DIGITAL_FAILED` con `severity: warning`, `blocking: false`, `reason: userinfo_failed | userinfo_sub_mismatch | userinfo_missing_access_token` y se sigue.

### 6.2 Matching de documento (D11)

Comparación normalizada (mayúsculas, sin puntos/guiones/espacios). Para CI uruguaya se acepta también que el usuario haya cargado la cédula sin dígito verificador.

| Situación | Acción |
|-----------|--------|
| `User.documentNumber` vacío | Se completa con la CI de ID Digital (fuente verificada). `idDigital.documentMismatch = false` |
| Coincide | Sin cambios en el perfil. `documentMismatch = false` |
| No coincide | **No se pisa** el documento del perfil y **no se bloquea** la verificación. `documentMismatch = true` + auditoría `ID_DIGITAL_FAILED` con `reason: document_mismatch`, `severity: warning`, `blocking: false` y los documentos **enmascarados** (últimos 3 caracteres) para revisión admin |

## 7. Diseño técnico

### Backend

- Env: `ID_DIGITAL_CLIENT_ID`, `ID_DIGITAL_CLIENT_SECRET`, `ID_DIGITAL_AUTH_URL`, `ID_DIGITAL_TOKEN_URL`, `ID_DIGITAL_REDIRECT_URI`, `ID_DIGITAL_ACR_VALUES=pin`, `ID_DIGITAL_SCOPE=openid profile`, `ID_DIGITAL_ISSUER`, `ID_DIGITAL_JWKS_URL` (opcional), `ID_DIGITAL_USERINFO_URL` (opcional).
- `GET /auth/id-digital/start` — `purpose`: `agent_onboarding` | `accept_job`; genera `state` (+ `nonce`); exige sesión.
- `GET /auth/id-digital/callback` — valida `state`, intercambia `code`, verifica firma RS256 (JWKS) y claims del `id_token`, lee userinfo (CI), audita.
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

## 8. Checklist

- [x] Definir y registrar `redirect_uri` con Abitab — registrada: `https://confiappapi-production.up.railway.app/auth/id-digital/callback` (única)
- [x] Obtener `client_id` / `client_secret` — credenciales STG/testing recibidas (2026-11)
- [x] Confirmar URL exacta de authorize, token, JWKS y userinfo (§5) — vía discovery + prueba real
- [x] Cerrar si el documento/CI viene en userinfo o solo `sub`+nombre — **viene en userinfo** (`document.document_number`), no en el `id_token`
- [x] Confirmar claims reales del `id_token` (§6) — sin `nonce`, `amr: null`, `acr: pin`
- [x] Verificar firma RS256 del `id_token` contra JWKS
- [x] Env + cliente HTTP en API
- [x] `start` + `callback` + `state` persistido (TTL corto)
- [x] Quitar gate fotos en `BecomeAgentPage` (no borrar módulo KYC)
- [x] Gate en aceptar trabajo
- [x] UI errores (`error` / `error_description` del redirect)
- [x] Tests unitarios: nonce ausente/distinto, firma/alg, JWKS, userinfo OK/falla, matching de documento
- [ ] Prueba E2E completa en un entorno desplegado (staging/prod) con la app STG
- [ ] Credenciales y `redirect_uri` de **producción** (las actuales son de testing)
- [ ] Solo web; mobile documented as later

## 9. Referencias internas

| Doc / código | Relación |
|--------------|----------|
| [`README.md`](../README.md) | Roadmap PIN → liveness; URLs primarias/alternativas |
| [`WEB_APP.md`](./WEB_APP.md) | Rutas agente |
| KYC fotos | `KycDocumentsSection`, admin review |
| Gate actual onboarding | `BecomeAgentPage.tsx` (alerta identidad verificada) |
| Aceptar trabajo | `AgentAssignmentService.acceptOffer`, UI agent-ops |
