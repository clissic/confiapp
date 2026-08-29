# Identidad Digital Abitab — confirmación de identidad de Agentes

> **Estado:** documentado / **no implementado** (decisión de producto 2026-08-29).  
> Este documento fija el diseño acordado para cuando se implemente. No hay código de integración aún.

## 1. Objetivo

Confirmar la identidad de los **Agentes** de ConfiApp mediante el servicio oficial **Identidad Digital Abitab (ID Digital 2.0)**, además de las credenciales propias de la app (email + contraseña).

- **Quién:** solo usuarios con rol/perfil de Agente.
- **Cuándo:** en **cada ingreso** a la aplicación (cada login nuevo).
- **Quién no:** compradores, vendedores y admin (siguen solo con email/password).

No reemplaza el alta KYC por review admin ni el onboarding de agencia; es un **step-up de autenticación** en el login.

## 2. Documentación externa (fuente de verdad del proveedor)

| Recurso | URL |
|---------|-----|
| Primeros pasos | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/first-steps |
| Flujos de autorización | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/authorization-flows |
| Definiciones (OAuth/OIDC) | https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/definitions |
| Soporte proveedor | ayuda@id.com.uy |

Resumen del proveedor ([primeros pasos](https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/first-steps)):

1. Credenciales: `client_id` + `client_secret` (almacenar solo en backend).
2. Registrar `redirect_uri` (HTTPS) en ID Digital.
3. Implementar un flujo de autorización (recomiendan **authorization code**).
4. Tras autorizar, obtener datos del usuario vía su API (`openid` / `profile`).

Parámetros relevantes ([definiciones](https://integracion-id-digital-2-0.identidaddigital.com.uy/docs/definitions)):

- `scope`: p. ej. `openid profile`
- `state` (anti-CSRF), `nonce` (obligatorio en flujo implícito)
- `response_type`: `code` (authorization code) o `token` (implícito)
- `acr_values`: métodos (`pin`, `liveness`, `face-match`, `email-otp`, `phone-otp`, `signature`, …)
- Respuesta de nivel: `loa2` / `loa3`; métodos usados en `amr`

Advertencia del proveedor: no depender de cookies ajenas al servicio; autenticar solo con lo documentado en su flujo.

## 3. Decisiones de producto (2026-08-29)

| # | Decisión | Detalle |
|---|----------|---------|
| D1 | Alcance | **Solo Agentes** deben pasar por ID Digital. |
| D2 | Momento | En **cada login** a la app (no en cada navegación interna). |
| D3 | Modelo | **Step-up**: primero credenciales ConfiApp, después ID Digital. |
| D4 | No-agentes | Comprador / vendedor / admin: solo email + contraseña. |
| D5 | Misma sesión | Refresh de access token / navegación dentro de la app: **no** volver a pedir ID Digital. |
| D6 | Nuevo login | Cerrar sesión y volver a ingresar: **sí** pedir ID Digital otra vez. |
| D7 | Flujo OAuth | Usar **authorization code** (recomendado por Abitab; `client_secret` solo en API). |
| D8 | Matching | Además de un token válido de Abitab, **matchear documento/cédula** con la cuenta ConfiApp. Si no coincide → rechazar. |
| D9 | Relación con KYC | ID Digital es step-up de login; **no sustituye** el flujo KYC/admin ni el onboarding `/agente`. Pueden coexistir (`User.kyc.provider`, etc.). |
| D10 | Implementación | **Documentar ahora; implementar después.** No hay endpoints ni UI aún. |

### Qué es “step-up” en este contexto

1. El agente ingresa con **email + contraseña** (login actual).
2. El backend detecta que es agente.
3. La sesión queda **pendiente** de verificación ID Digital (no entra operativo a la app).
4. Redirección a Identidad Digital Abitab.
5. Callback en ConfiApp: exchange del `code`, userinfo, matching de documento.
6. Recién ahí sesión completa → acceso a la app como agente.

## 4. Flujo acordado (a implementar)

```text
Agente → POST /auth/login (email + password)
       → Backend: credenciales OK + es agente
       → Respuesta: requiresIdDigital = true (sesión limitada o flag)
       → Front redirige a GET /auth/id-digital/start
       → Usuario autentica en ID Digital Abitab
       → Redirect a /auth/id-digital/callback?code=…&state=…
       → API: valida state, intercambia code, userinfo, match documento
       → Sesión completa (claim/flag agentStepUp / idDigitalVerifiedAt)
       → Front → /inicio (u another next)
```

Comprador/vendedor/admin: login normal sin `requiresIdDigital`.

## 5. Diseño técnico previsto (sin código aún)

### 5.1 Backend (`apps/api`)

- Variables de entorno (ejemplo):  
  `ID_DIGITAL_CLIENT_ID`, `ID_DIGITAL_CLIENT_SECRET`,  
  `ID_DIGITAL_AUTH_URL`, `ID_DIGITAL_TOKEN_URL`, `ID_DIGITAL_USERINFO_URL`,  
  `ID_DIGITAL_REDIRECT_URI`, `ID_DIGITAL_ACR_VALUES`, `ID_DIGITAL_SCOPE`
- Endpoints tentativos:
  - `GET /auth/id-digital/start` — arma URL de autorización (`state`/`nonce`); exige sesión y rol/perfil agente.
  - `GET /auth/id-digital/callback` — exchange + userinfo + matching.
- Extender login: si es agente → `requiresIdDigital: true` hasta completar step-up.
- Guardas: rutas de agente / sesión “completa” requieren flag de step-up en la sesión actual.
- Auditoría: eventos de inicio de step-up, éxito, fallo y mismatch de documento.

### 5.2 Frontend (`apps/web`)

- Tras login, si `requiresIdDigital` → redirect a start (o pantalla intermedia “Verificá tu identidad”).
- Ruta/página de callback que complete el flujo y redirija al `next` seguro.
- Guard (p. ej. junto a `RequireAgent`): sin step-up → forzar verificación; no dejar usar `/agente/trabajos` etc.

### 5.3 Matching de identidad

- Fuente ConfiApp: `documentNumber` / `documentNumberHash` del usuario.
- Fuente ID Digital: claims/userinfo del proveedor (documento/CI según API).
- Comparación normalizada; nunca loguear el documento en claro en auditoría de detalle.

### 5.4 Criterio “es agente”

Alineado con el guard actual `RequireAgent`: perfil de onboarding `ACTIVE` o `INACTIVE`, o flag/rol de agente equivalente. Definir en implementación si `INACTIVE` también exige step-up (**recomendación: sí**, misma política que acceso a área agente).

## 6. Decisiones abiertas (para cuando se implemente)

Pendientes de cerrar con producto / comercial Abitab:

1. Valores exactos de `acr_values` (p. ej. `pin`, `liveness`, `face-match`) y nivel `loa2` vs `loa3`.
2. ¿El rol **ADMIN** queda fuera del gate? (**recomendación documentada: sí, fuera**).
3. Comportamiento si el agente aún no tiene documento cargado en ConfiApp.
4. Entornos sandbox vs producción y lista de `redirect_uri`.
5. Flujo móvil / WebView (la doc del proveedor tiene sección específica).

## 7. Referencias internas

| Doc | Relación |
|-----|----------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Módulos auth / agents |
| [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | AuthN/AuthZ y KYC a escala |
| [`WEB_APP.md`](./WEB_APP.md) | Rutas de agente y guards |
| Código actual login | `apps/api/src/modules/auth`, `apps/web/src/features/auth` |
| Guard agente | `apps/web/src/features/auth/ui/RequireAgent.tsx` |
| Modelo KYC usuario | `packages/database` → `User.kyc` / `verification.identity` |

## 8. Checklist de implementación futura

- [ ] Credenciales y redirect registrados en ID Digital (sandbox)
- [ ] Env + cliente HTTP en API (sin secretos en web)
- [ ] `start` + `callback` + persistencia de `state`/`nonce`
- [ ] Flag/claim de sesión post-login solo agentes
- [ ] Matching de documento + auditoría
- [ ] UI login → redirect → callback → errores amigables
- [ ] Tests (unit + e2e del happy path y mismatch)
- [ ] Cerrar `acr_values` y política ADMIN / documento faltante
