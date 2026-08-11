import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BadgeCheck,
  CircleDollarSign,
  Handshake,
  Home,
  Plus,
  ScrollText,
  Settings,
  UserRound,
} from 'lucide-react';

export type NavTone = 'primary' | 'secondary';

export interface HomeAction {
  id: string;
  title: string;
  description: string;
  to: string;
  /** Imagen dominante de la card (public/). */
  image: string;
  /** Acento de marca: primary (navy) o secondary (teal). */
  tone: NavTone;
}

/**
 * Acciones del inicio (grilla 2×2).
 * Transacciones y Auditoría viven en el menú de usuario; herramientas de agente
 * (trabajos abiertos, etc.) no se listan acá.
 */
export const HOME_PRIMARY_ACTIONS: HomeAction[] = [
  {
    id: 'comprar',
    title: 'Comprar',
    description: 'Encontrá un agente de confianza para recibir tu producto.',
    to: '/operaciones/nueva/comprador',
    image: '/landing/Shopping.png',
    tone: 'primary',
  },
  {
    id: 'vender',
    title: 'Vender',
    description: 'Vendé de forma segura y protegida con un agente.',
    to: '/operaciones/nueva/vendedor',
    image: '/landing/Sale.png',
    tone: 'secondary',
  },
  {
    id: 'agente',
    title: 'Mi Agencia',
    description: 'Generá ingresos ayudando a asegurar operaciones.',
    to: '/agente',
    image: '/landing/Delivery.png',
    tone: 'secondary',
  },
  {
    id: 'mensajes',
    title: 'Mensajes',
    description: 'Conversaciones activas sobre tus operaciones.',
    to: '/mensajes',
    image: '/landing/Chat.png',
    tone: 'primary',
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
  { id: 'agente', label: 'Agencia', to: '/agente', icon: BadgeCheck },
  { id: 'cuenta', label: 'Mi cuenta', to: '/perfil', icon: UserRound },
];

export interface UserMenuLink {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Solo visible si `user.role === 'ADMIN'`. */
  adminOnly?: boolean;
}

/**
 * Opciones anidadas bajo el nombre de usuario.
 * Incluye Mis transacciones y Auditoría (esta última solo ADMIN).
 * No repite Comprar/Vender/Mensajes/Agencia del home.
 */
export const USER_MENU_LINKS: UserMenuLink[] = [
  { id: 'perfil', label: 'Mi perfil', to: '/perfil', icon: UserRound },
  { id: 'configuracion', label: 'Configuración', to: '/perfil?tab=settings', icon: Settings },
  { id: 'operaciones', label: 'Mis transacciones', to: '/operaciones', icon: Handshake },
  { id: 'wallet', label: 'Wallet', to: '/wallet', icon: CircleDollarSign },
  { id: 'reputacion', label: 'Reputación', to: '/reputacion', icon: Award },
  {
    id: 'auditoria',
    label: 'Auditoría',
    to: '/auditoria',
    icon: ScrollText,
    adminOnly: true,
  },
];
