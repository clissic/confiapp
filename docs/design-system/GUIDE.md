# ConfiApp Design System — Guía de uso

**Versión:** 1.0.0  
**Posicionamiento:** plataforma de confianza (escrow físico), no marketplace.  
**Audiencia:** compradores, vendedores y agentes intermediarios.

Archivos del sistema:

| Entregable | Ruta |
|------------|------|
| Tokens | [`tokens.json`](./tokens.json) |
| Variables CSS | [`tokens.css`](./tokens.css) |
| Tailwind | [`tailwind.confiapp.js`](./tailwind.confiapp.js) |
| Esta guía | [`GUIDE.md`](./GUIDE.md) |

---

## 1. Principios de producto

1. **Seguridad** — La UI debe sentirse controlada, estable y predecible. Evitar ruido visual, urgencia artificial o patrones de marketplace (grids de ofertas, descuentos flash, pill clusters).
2. **Confianza** — Claridad de estados, trazabilidad y confirmaciones explícitas. El color secundario (`#55C5B5`) señala “todo en orden”.
3. **Profesionalismo** — Tipografía Inter en app shell (landing usa **Plus Jakarta Sans**), jerarquía estricta, densidad calmada, navy dominante en chrome.
4. **Simplicidad** — Una acción primaria por vista. Copy corto. Sin decoración gratuita.
5. **Elegancia** — Elevación sutil (sombras teñidas de navy), radio moderado, motion ≤ 250 ms.

**Test de marca:** si quitás el nombre “ConfiApp” y la pantalla podría ser un e‑commerce genérico, el diseño falló.

---

## 2. Identidad de color

### 2.1 Primario — `#01285D` (Primary 700)

Uso exclusivo / dominante en:

- Navbar y Sidebar
- Botones principales (Primary)
- Headers de sección / títulos de página en contexto app shell
- Iconografía estructural importante
- Links activos y navegación seleccionada
- Focus ring *secundario* solo cuando el foco está sobre CTA; en chrome navy usar secondary ring

**No usar** como fondo de página completa en contenido (fatiga visual). El canvas es Gray 50.

### 2.2 Secundario — `#55C5B5` (Secondary 400)

Uso en:

- CTA de confirmación / “Continuar con seguridad”
- Estados activos positivos
- Switches, checkboxes y radios checked
- Badges positivos (“Verificado”, “Fondos retenidos”, “Completado”)
- Elementos destacados de progreso exitoso
- Indicador de loading

**No usar** para errores, destrucciones ni chrome estructural.

### 2.3 Escala de grises

| Token | Hex | Uso |
|-------|-----|-----|
| Gray 50 | `#F7F9FC` | Canvas / fondo de app |
| Gray 100 | `#EEF2F7` | Sunken, zebra suave, skeleton shine |
| Gray 200 | `#E2E8F0` | Bordes default, divisores |
| Gray 300 | `#CBD5E1` | Bordes strong, inputs disabled border |
| Gray 400 | `#94A3B8` | Placeholder, iconos muted, disabled text |
| Gray 500 | `#64748B` | Texto muted / meta |
| Gray 600 | `#475569` | Texto secundario fuerte |
| Gray 700 | `#334155` | Texto secondary |
| Gray 800 | `#1E293B` | Énfasis casi primary text |
| Gray 900 | `#0F172A` | Texto primary |

### 2.4 Estados del sistema

Cada estado tiene **bg / border / fg / solid**:

| Estado | Solid | Uso |
|--------|-------|-----|
| Success | `#1B9E78` | Operación exitosa, fondos liberados |
| Warning | `#D97706` | Riesgo, plazo, requiere atención |
| Danger | `#DC2626` | Error, disputa crítica, destructivo |
| Info | `#245F96` | Información neutra (derivado del primary) |
| Disabled | Gray 300/400 | Controles no interactivos |
| Loading | Secondary track | Spinners / progress indeterminado |
| Skeleton | Gray 200 → 100 | Placeholders de carga |

---

## 3. Tipografía — Inter

Cargar Inter (400/500/600/700). Fallback: system-ui.

| Estilo | Size / Line | Weight | Uso |
|--------|-------------|--------|-----|
| Display | 48/56 | 700 | Marketing / empty states heroicos (escaso) |
| H1 | 36/44 | 700 | Título de página |
| H2 | 30/38 | 700 | Bloques mayores |
| H3 | 24/32 | 600 | Subsecciones |
| H4 | 20/28 | 600 | Cards / grupos |
| Body Large | 18/28 | 400 | Intro / lead |
| Body | 16/24 | 400 | Default |
| Small | 14/20 | 400 | Tablas, helpers |
| Caption | 12/16 | 500 | Labels meta, timestamps |
| Button | 14/20 | 600 | Todos los botones |

Reglas:

- Máximo un Display/H1 por vista.
- En tablas y listas densas preferir Small + Caption.
- No usar tipografías display serif ni stacks genéricas de “AI cream”.

---

## 4. Espaciado (base 8 px)

| Token | px |
|-------|----|
| 0 | 0 |
| 0.5 | 4 |
| 1 | 8 |
| 1.5 | 12 |
| 2 | 16 |
| 2.5 | 20 |
| 3 | 24 |
| 4 | 32 |
| 5 | 40 |
| 6 | 48 |
| 7 | 56 |
| 8 | 64 |
| 9 | 72 |
| 10 | 80 |
| 12 | 96 |
| 16 | 128 |
| 20 | 160 |
| 24 | 192 |

**Patrones:**

- Padding de card: `space-3` (24) o `space-4` (32)
- Gap entre campos de form: `space-2` (16) / labels `space-1` (8)
- Separación de secciones de página: `space-6`–`space-8`
- Navbar height: 64 (`space-8`)
- Sidebar width: 264 / colapsado 72

---

## 5. Radius

| Token | px | Uso |
|-------|----|-----|
| xs | 4 | Badges compactos, tags |
| sm | 6 | Inputs densos, chips |
| md | 8 | Botones, inputs default |
| lg | 12 | Cards, dropdowns |
| xl | 16 | Dialogs, paneles |
| 2xl | 24 | Hero panels / drawers anchos |
| full | 9999 | Avatares, pills, switches |

Evitar “pill everything”. Los botones primary usan `md` o `lg`, no `full`.

---

## 6. Elevación (6 niveles)

Sombras teñidas con navy (`rgba(1,40,93,…)`) en light; negras suaves en dark.

| Nivel | Uso |
|-------|-----|
| 0 | Flat / tablas / sunken |
| 1 | Inputs focus suave, list rows |
| 2 | Cards en reposo |
| 3 | Cards hover / dropdown |
| 4 | Dialog / popover |
| 5 | Drawer |
| 6 | Toast / capas críticas |

No apilar multi-shadow decorativo. Un nivel por superficie.

---

## 7. Componentes — especificación visual

### 7.1 Botones

| Variante | Fondo | Texto | Cuándo |
|----------|-------|-------|--------|
| Primary | Primary 700 | White | Acción principal de la vista |
| CTA / Confirm | Secondary 400 | Primary 700 | Confirmar escrow, liberar fondos, aceptar |
| Secondary | White + border Gray 200 | Primary 700 | Alternativa |
| Ghost | Transparent | Primary 700 | Terciario en toolbars |
| Danger | Danger solid | White | Acciones irreversibles |
| Disabled | Disabled bg | Disabled fg | Sin pointer |

Alturas: sm 32 · md 40 · lg 48. Radius `md`. Label estilo Button. Icono Lucide sm (16) a `space-1` del texto.

Estados: hover (−1 step de escala) · active (pressed) · focus ring secondary · loading (spinner secondary, label “…” o aria-busy).

**Regla:** 1 Primary o CTA visible dominante por viewport de trabajo.

### 7.2 Inputs / Select / Combobox / Date Picker / Search

- Alto 40 (md), radius `md`
- Fondo `surface-base`, borde Gray 200
- Placeholder Gray 400
- Label Small/Caption arriba, gap 8
- Helper Gray 500; error Danger fg + borde Danger
- Focus: borde Secondary + ring Secondary 2px offset 2px
- Search Bar: mismo input + ícono `Search` outline a la izquierda (Gray 500)

Select / Combobox: chevron Lucide; menú sombra 3, radius `lg`.  
Date Picker: popover sombra 4; día seleccionado Secondary; hoy ring Primary.

### 7.3 Checkbox / Radio / Switch

- Unchecked: borde Gray 300, fondo white
- Checked: fondo Secondary, check/dot Primary 700 (alto contraste)
- Indeterminate checkbox: Secondary con guión Primary
- Switch track off Gray 300 · on Secondary · thumb white
- Tamaño touch mínimo 24×24 (área hit 40×40)

### 7.4 Cards

- Fondo raised, borde Gray 200, radius `lg`, sombra 2
- Padding 24
- Header H4 + Caption meta
- Sin “card soup”: cards solo para unidades de interacción/contenido delimitado
- En escrow: preferir paneles con borde y poco relieve (confianza > glamour)

### 7.5 Dialog / Drawer

- Dialog: max-width 480–640, radius `xl`, sombra 4, backdrop `primary-900` @ 40% opacity
- Drawer: desde derecha (detalle) o abajo (mobile), sombra 5, radius `2xl` solo en mobile sheet
- Siempre foco atrapado, Escape cierra, título H3, acciones Primary/CTA alineadas a la derecha

### 7.6 Sidebar / Topbar

- Ambos en Primary 700 (light) / Primary 900 (dark)
- Texto navbar white; ítems muted Primary 100; activo Secondary o fondo Primary 800 + indicador Secondary 4px
- Logo / wordmark blanco o monócromo claro — hero de marca en shell
- Topbar 64px; acciones a la derecha (avatar, notificaciones)
- No competir con marketplace banners

### 7.7 Dropdown / Tooltip / Tabs / Accordion

- Dropdown: raised, sombra 3, radius `lg`, item hover Gray 100 / dark overlay
- Tooltip: Gray 800 / texto white (light), delay 200 ms, max 240px
- Tabs: underline Secondary en activo; label Small semibold; no pills redondeadas excesivas
- Accordion: divisores Gray 200; chevron rota 180° en 180 ms

### 7.8 Avatar / Badge

- Avatar: radius full; sizes 24/32/40/48; fallback iniciales Primary 700 sobre Primary 100
- Badge: radius xs/sm; positivos Secondary 100/700; warning/danger/info semánticos; neutro Gray 100/700

### 7.9 Table

- Header Caption/Small semibold Gray 600, fondo sunken
- Filas Body/Small; hover Gray 50; bordes Gray 200
- Densidad comfortable (row 48) / compact (36)
- Acciones al final; estados con Badge
- Sensación “operación financiera”, no catálogo

### 7.10 Toast / Alert / Progress / Skeleton / Pagination / Breadcrumb

- Toast: sombra 6, radius `lg`, ícono semántico, auto-dismiss 4–6s (errores persistentes)
- **Web actual:** `useAppToast` / `ToastProvider` (Bootstrap). Éxito/copy → toast; errores de form y banners permanentes → `Alert`. Regla: `.cursor/rules/web-toasts.mdc`.
- Alert: inline, bg/border/fg semánticos, no dismissible si es bloqueante
- Progress: track Gray 200, fill Secondary (éxito) o Primary (proceso neutro)
- Skeleton: shimmer Gray 200→100, radius según contenido, duration ≤ 250ms loop suave o CSS gradient
- Pagination: botones ghost + número activo Primary
- Breadcrumb: Small, separador `/` o chevron, último texto primary semibold

---

## 8. Iconografía — Lucide React

| Aspecto | Estándar |
|---------|----------|
| Default | **Outline** |
| Filled | Solo confirmación / estado activo / badge crítico |
| Stroke | 1.75 default · 2 énfasis · 1.5 soft en tablas densas |
| Tamaños | 14 / 16 / 20 / 24 / 32 |
| Color | Hereda texto; estructurales en Primary; éxito en Secondary/Success |

Íconos sugeridos de dominio: `ShieldCheck`, `Lock`, `Handshake`, `FileCheck`, `Scale`, `BadgeCheck`, `UserRound`, `MessagesSquare`.

Evitar emojis en UI de producto.

---

## 9. Motion — Framer Motion (máx. 250 ms)

| Preset | Duration | Notas |
|--------|----------|-------|
| Hover | 120 ms | color, border, shadow; scale ≤ 1.02 solo en CTA |
| Tap | 80 ms | scale 0.98 |
| Open | 180 ms | ease enter |
| Close | 120 ms | ease exit |
| Fade | 180 ms | opacity |
| Slide | 180 ms | 8 px |
| Scale | 180 ms | 0.96 → 1 |

Respetar `prefers-reduced-motion` (tokens ya lo fuerzan a 0).  
No parallax, no bounce elástico, no confetti.

---

## 10. Modo oscuro

No es inversión. Objetivos:

- Superficies navy profundas (`#070F1C` → `#1A2B42`)
- Primary de acción se aclara a Primary 500/400 para contraste AA
- Secondary se mantiene (`#55C5B5`) como ancla de confianza
- Texto Gray 50/300; bordes Gray 800/700
- Navbar/Sidebar más oscuros que el canvas (jerarquía invertida vs. light: el chrome sigue siendo “caja fuerte”)

Activación: `data-theme="dark"` o clase `.theme-dark`.

---

## 11. Accesibilidad (WCAG AA)

- Texto normal ≥ 4.5:1; grande ≥ 3:1; UI no textual ≥ 3:1
- Pares validados: Primary 700 + white; Secondary 400 + Primary 700; Gray 900 + white/Gray 50
- Focus visible siempre (`--focus-ring-color` Secondary)
- Orden de tab lógico; dialogs con focus trap
- Labels asociados; errores anunciables (`aria-invalid`, `aria-describedby`)
- No transmitir estado solo con color (ícono + texto)
- Hit targets ≥ 40×40 en mobile

---

## 12. Responsive — Mobile first

| Breakpoint | px | Comportamiento |
|------------|----|----------------|
| xs | 0 | Base mobile |
| sm | 576 | Forms 2 cols suaves |
| md | 768 | Sidebar off-canvas → docked opcional |
| lg | 992 | Shell completo sidebar + content |
| xl | 1200 | Content max width |
| xxl | 1400 | Dashboards amplios |

Mobile:

- Topbar compacta; sidebar → drawer
- Tablas → cards apiladas o scroll horizontal con sombra de borde
- CTAs sticky bottom cuando la acción es crítica de escrow
- Una columna por defecto

---

## 13. Roles de interfaz (tono)

| Rol | Énfasis UI |
|-----|------------|
| Comprador / Vendedor | Claridad de estado de la operación, CTAs Secondary para confirmar |
| Agente | Disponibilidad, asignación, tono más “consola profesional” |
| Admin | Densidad mayor, tablas, Primary dominante |

Copy: preciso, sin jerga de tienda (“¡Ofertón!”). Preferir “Fondos retenidos”, “Condiciones cumplidas”, “En disputa”.

---

## 14. Do / Don’t

**Do**

- Navy en shell, teal en confirmación
- Una CTA dominante
- Estados de escrow siempre visibles
- Inter + escala 8

**Don’t**

- Gradientes púrpura / glow neon
- Grid tipo marketplace en home autenticada
- Pills decorativas / stat strips en hero
- Sombras negras duras en light
- Animaciones > 250 ms
- Usar Danger para cancelaciones suaves (usar Secondary outline o Warning)

---

## 15. Cómo consumir los tokens

1. Incluir `tokens.css` como fuente de verdad en runtime.
2. Extender Tailwind con `tailwind.confiapp.js` (o mapear a Bootstrap SCSS usando las mismas variables).
3. Componentes Shadcn: mapear CSS variables `--tw-*` internas a estos tokens de marca.
4. Bootstrap (stack del frontend): sobrescribir `$primary`, `$success`, etc. desde las mismas variables para una sola identidad.

---

## 16. Patrones web ConfiApp (actual)

Detalle de rutas y producto: [`../WEB_APP.md`](../WEB_APP.md).

| Patrón | Convención |
|--------|------------|
| UI kit | Bootstrap 5 + react-bootstrap; Tailwind solo `tw-*` |
| Acciones de formulario | Contenedor `.ca-form-actions`; en mobile (≤767.98px) botones `width: 100%` (`global.css`) |
| Composer chat | `.ca-chat-composer` excluido de full-width forzado |
| Ícono dentro de input | Wrapper relative + botón absolute (ej. verificar teléfono, ojo password) |
| Formularios nueva op. | `.ca-tx-edit` + `row g-3` (como perfil); vendedor con `.ca-tx-fieldset` |
| Footer app | Solo desktop (`d-none d-lg-block`); placeholders legales |
| Copy de usuario | Sin códigos de estado internos (`WAITING_PARTICIPANT`, etc.) — van en docs |

---

## 17. Checklist de revisión de diseño

- [ ] ¿Se siente “caja fuerte digital” y no tienda?
- [ ] ¿Primary y Secondary se usan en sus roles correctos?
- [ ] ¿Contraste AA en light y dark?
- [ ] ¿Focus visible y teclado completos?
- [ ] ¿Motion ≤ 250 ms y reduced-motion ok?
- [ ] ¿Mobile first sin pérdida de estados críticos de escrow?
- [ ] ¿Toasts vs Alerts según regla web-toasts?
- [ ] ¿Formularios usable en mobile (acciones full-width)?

---

*ConfiApp Design System · Seguridad · Confianza · Profesionalismo · Simplicidad · Elegancia*
