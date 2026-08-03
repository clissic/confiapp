/**
 * ConfiApp Design System — Tailwind theme extension
 * Documento de configuración (no cablear aún en la app).
 * Prefijo tw- recomendado si convive con Bootstrap.
 *
 * Uso previsto:
 *   import confiappTheme from './tailwind.confiapp.js'
 *   // merge en theme.extend
 */

/** @type {import('tailwindcss').Config['theme']} */
const confiappTheme = {
  extend: {
    colors: {
      primary: {
        50: 'var(--color-primary-50)',
        100: 'var(--color-primary-100)',
        200: 'var(--color-primary-200)',
        300: 'var(--color-primary-300)',
        400: 'var(--color-primary-400)',
        500: 'var(--color-primary-500)',
        600: 'var(--color-primary-600)',
        700: 'var(--color-primary-700)',
        800: 'var(--color-primary-800)',
        900: 'var(--color-primary-900)',
        DEFAULT: 'var(--color-primary)',
      },
      secondary: {
        50: 'var(--color-secondary-50)',
        100: 'var(--color-secondary-100)',
        200: 'var(--color-secondary-200)',
        300: 'var(--color-secondary-300)',
        400: 'var(--color-secondary-400)',
        500: 'var(--color-secondary-500)',
        600: 'var(--color-secondary-600)',
        700: 'var(--color-secondary-700)',
        800: 'var(--color-secondary-800)',
        900: 'var(--color-secondary-900)',
        DEFAULT: 'var(--color-secondary)',
      },
      gray: {
        50: 'var(--color-gray-50)',
        100: 'var(--color-gray-100)',
        200: 'var(--color-gray-200)',
        300: 'var(--color-gray-300)',
        400: 'var(--color-gray-400)',
        500: 'var(--color-gray-500)',
        600: 'var(--color-gray-600)',
        700: 'var(--color-gray-700)',
        800: 'var(--color-gray-800)',
        900: 'var(--color-gray-900)',
      },
      success: {
        DEFAULT: 'var(--success-solid)',
        bg: 'var(--success-bg)',
        border: 'var(--success-border)',
        fg: 'var(--success-fg)',
      },
      warning: {
        DEFAULT: 'var(--warning-solid)',
        bg: 'var(--warning-bg)',
        border: 'var(--warning-border)',
        fg: 'var(--warning-fg)',
      },
      danger: {
        DEFAULT: 'var(--danger-solid)',
        bg: 'var(--danger-bg)',
        border: 'var(--danger-border)',
        fg: 'var(--danger-fg)',
      },
      info: {
        DEFAULT: 'var(--info-solid)',
        bg: 'var(--info-bg)',
        border: 'var(--info-border)',
        fg: 'var(--info-fg)',
      },
      surface: {
        canvas: 'var(--surface-canvas)',
        base: 'var(--surface-base)',
        raised: 'var(--surface-raised)',
        overlay: 'var(--surface-overlay)',
        sunken: 'var(--surface-sunken)',
        navbar: 'var(--surface-navbar)',
        sidebar: 'var(--surface-sidebar)',
      },
      content: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        inverse: 'var(--text-inverse)',
      },
    },
    fontFamily: {
      sans: ['var(--font-sans)'],
      mono: ['var(--font-mono)'],
    },
    fontSize: {
      display: [
        'var(--text-display-size)',
        {
          lineHeight: 'var(--text-display-line)',
          fontWeight: 'var(--text-display-weight)',
          letterSpacing: 'var(--text-display-tracking)',
        },
      ],
      h1: [
        'var(--text-h1-size)',
        {
          lineHeight: 'var(--text-h1-line)',
          fontWeight: 'var(--text-h1-weight)',
          letterSpacing: 'var(--text-h1-tracking)',
        },
      ],
      h2: [
        'var(--text-h2-size)',
        {
          lineHeight: 'var(--text-h2-line)',
          fontWeight: 'var(--text-h2-weight)',
          letterSpacing: 'var(--text-h2-tracking)',
        },
      ],
      h3: [
        'var(--text-h3-size)',
        {
          lineHeight: 'var(--text-h3-line)',
          fontWeight: 'var(--text-h3-weight)',
          letterSpacing: 'var(--text-h3-tracking)',
        },
      ],
      h4: [
        'var(--text-h4-size)',
        {
          lineHeight: 'var(--text-h4-line)',
          fontWeight: 'var(--text-h4-weight)',
          letterSpacing: 'var(--text-h4-tracking)',
        },
      ],
      'body-lg': ['var(--text-body-lg-size)', { lineHeight: 'var(--text-body-lg-line)' }],
      body: ['var(--text-body-size)', { lineHeight: 'var(--text-body-line)' }],
      small: ['var(--text-small-size)', { lineHeight: 'var(--text-small-line)' }],
      caption: [
        'var(--text-caption-size)',
        {
          lineHeight: 'var(--text-caption-line)',
          letterSpacing: 'var(--text-caption-tracking)',
          fontWeight: '500',
        },
      ],
      button: [
        'var(--text-button-size)',
        {
          lineHeight: 'var(--text-button-line)',
          fontWeight: 'var(--text-button-weight)',
          letterSpacing: 'var(--text-button-tracking)',
        },
      ],
    },
    spacing: {
      0.5: 'var(--space-0-5)',
      1: 'var(--space-1)',
      1.5: 'var(--space-1-5)',
      2: 'var(--space-2)',
      2.5: 'var(--space-2-5)',
      3: 'var(--space-3)',
      4: 'var(--space-4)',
      5: 'var(--space-5)',
      6: 'var(--space-6)',
      7: 'var(--space-7)',
      8: 'var(--space-8)',
      9: 'var(--space-9)',
      10: 'var(--space-10)',
      12: 'var(--space-12)',
      16: 'var(--space-16)',
      20: 'var(--space-20)',
      24: 'var(--space-24)',
      navbar: 'var(--navbar-height)',
      sidebar: 'var(--sidebar-width)',
      'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
    },
    borderRadius: {
      xs: 'var(--radius-xs)',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
      full: 'var(--radius-full)',
    },
    boxShadow: {
      0: 'var(--shadow-0)',
      1: 'var(--shadow-1)',
      2: 'var(--shadow-2)',
      3: 'var(--shadow-3)',
      4: 'var(--shadow-4)',
      5: 'var(--shadow-5)',
      6: 'var(--shadow-6)',
    },
    transitionDuration: {
      instant: 'var(--duration-instant)',
      fast: 'var(--duration-fast)',
      base: 'var(--duration-base)',
      slow: 'var(--duration-slow)',
    },
    transitionTimingFunction: {
      standard: 'var(--ease-standard)',
      enter: 'var(--ease-enter)',
      exit: 'var(--ease-exit)',
    },
    zIndex: {
      dropdown: 'var(--z-dropdown)',
      sticky: 'var(--z-sticky)',
      fixed: 'var(--z-fixed)',
      'modal-backdrop': 'var(--z-modal-backdrop)',
      modal: 'var(--z-modal)',
      popover: 'var(--z-popover)',
      tooltip: 'var(--z-tooltip)',
      toast: 'var(--z-toast)',
    },
    screens: {
      xs: '0px',
      sm: '576px',
      md: '768px',
      lg: '992px',
      xl: '1200px',
      xxl: '1400px',
    },
    maxWidth: {
      content: 'var(--content-max-width)',
    },
    ringColor: {
      focus: 'var(--focus-ring-color)',
    },
    ringWidth: {
      focus: 'var(--focus-ring-width)',
    },
    ringOffsetWidth: {
      focus: 'var(--focus-ring-offset)',
    },
  },
};

/** Ejemplo de config completa del Design System */
/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  prefix: 'tw-',
  theme: confiappTheme,
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};

export { confiappTheme };
export default config;
