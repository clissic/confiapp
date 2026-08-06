import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  CircleDollarSign,
  Handshake,
  Home,
  MapPinned,
  MessageSquare,
  Plus,
  ScrollText,
  Settings,
  ShoppingBag,
  UserRound,
  Wallet,
  Package,
} from 'lucide-react';

export type NavTone = 'mint' | 'sky' | 'lilac' | 'peach' | 'slate' | 'navy' | 'teal';

export interface HomeAction {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  tone: NavTone;
  /** Cards principales (grandes) vs herramientas (secundarias). */
  size: 'lg' | 'md' | 'sm';
}

/**
 * Acciones del inicio. No incluir acá lo que vive solo en el menú de usuario
 * (perfil, wallet, reputación) para evitar duplicados.
 */
export const HOME_PRIMARY_ACTIONS: HomeAction[] = [
  {
    id: 'comprar',
    title: 'Comprar',
    description: 'Encontrá un agente de confianza para recibir tu producto.',
    to: '/operaciones/nueva/comprador',
    icon: ShoppingBag,
    tone: 'mint',
    size: 'lg',
  },
  {
    id: 'vender',
    title: 'Vender',
    description: 'Vendé de forma segura y protegida con un agente de confianza.',
    to: '/operaciones/nueva/vendedor',
    icon: Package,
    tone: 'sky',
    size: 'lg',
  },
  {
    id: 'agente',
    title: 'Ser Agente',
    description: 'Generá ingresos ayudando a asegurar operaciones.',
    to: '/agente',
    icon: BadgeCheck,
    tone: 'lilac',
    size: 'md',
  },
  {
    id: 'operaciones',
    title: 'Mis transacciones',
    description: 'Seguí el estado de todas tus operaciones en tiempo real.',
    to: '/operaciones',
    icon: Handshake,
    tone: 'peach',
    size: 'md',
  },
  {
    id: 'mensajes',
    title: 'Mensajes',
    description: 'Conversaciones activas sobre tus operaciones.',
    to: '/mensajes',
    icon: MessageSquare,
    tone: 'slate',
    size: 'md',
  },
];

/** Reemplaza el bloque de marketing: atajos útiles que antes estaban en la sidebar. */
export const HOME_TOOL_ACTIONS: HomeAction[] = [
  {
    id: 'buscar-agentes',
    title: 'Buscar agentes',
    description: 'Encontrá Agentes cerca para tu entrega.',
    to: '/agente/buscar',
    icon: MapPinned,
    tone: 'teal',
    size: 'sm',
  },
  {
    id: 'trabajos',
    title: 'Trabajos abiertos',
    description: 'Operaciones disponibles para mediar.',
    to: '/agente/trabajos',
    icon: BriefcaseBusiness,
    tone: 'navy',
    size: 'sm',
  },
  {
    id: 'ofertas',
    title: 'Ofertas',
    description: 'Propuestas pendientes como Agente.',
    to: '/agente/ofertas',
    icon: BellRing,
    tone: 'peach',
    size: 'sm',
  },
  {
    id: 'pagos',
    title: 'Pagos',
    description: 'Historial y estado de los pagos.',
    to: '/pagos',
    icon: Wallet,
    tone: 'mint',
    size: 'sm',
  },
  {
    id: 'auditoria',
    title: 'Auditoría',
    description: 'Trazabilidad de tus operaciones.',
    to: '/auditoria',
    icon: ScrollText,
    tone: 'slate',
    size: 'sm',
  },
];

export interface BottomNavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Botón central destacado (+) */
  primary?: boolean;
  end?: boolean;
}

/** Bottom nav solo tablet/móvil. Destinos no se listan otra vez en el menú de usuario. */
export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { id: 'inicio', label: 'Inicio', to: '/inicio', icon: Home, end: true },
  { id: 'operaciones', label: 'Mis transacciones', to: '/operaciones', icon: Handshake },
  {
    id: 'nueva',
    label: 'Nueva operación',
    to: '/operaciones/nueva',
    icon: Plus,
    primary: true,
  },
  { id: 'agente', label: 'Agente', to: '/agente', icon: BadgeCheck },
  { id: 'cuenta', label: 'Mi cuenta', to: '/perfil', icon: UserRound },
];

export interface UserMenuLink {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

/**
 * Opciones anidadas bajo el nombre de usuario (cuenta / dinero / reputación).
 * No repite Comprar/Vender/Mensajes/Operaciones del home.
 */
export const USER_MENU_LINKS: UserMenuLink[] = [
  { id: 'perfil', label: 'Mi perfil', to: '/perfil', icon: UserRound },
  { id: 'configuracion', label: 'Configuración', to: '/perfil?tab=settings', icon: Settings },
  { id: 'wallet', label: 'Wallet', to: '/wallet', icon: CircleDollarSign },
  { id: 'reputacion', label: 'Reputación', to: '/reputacion', icon: Award },
];
