export interface OpenJobPlace {
  lng?: number;
  lat?: number;
  label?: string;
  hasPoint: boolean;
}

export interface OpenJob {
  id: string;
  code: string;
  title: string;
  description?: string;
  status: string;
  amountCents: number;
  currency: string;
  distanceKm: number;
  /** Punto de referencia (mapa / distancia). Preferir pickup / delivery. */
  meeting: {
    lng: number;
    lat: number;
    label?: string;
  };
  /** Retiro del producto (vendedor). */
  pickup: OpenJobPlace;
  /** Entrega al comprador. */
  delivery: OpenJobPlace;
  /** Distancia aproximada entre retiro y entrega. */
  routeKm?: number;
  buyer: {
    id: string;
    name: string;
    ratingAverage: number;
    ratingCount: number;
  };
  seller: {
    id: string;
    name: string;
    ratingAverage: number;
    ratingCount: number;
  };
  initiatedBy: 'BUYER' | 'SELLER';
  createdAt: string;
}

export interface OpenJobsFilters {
  lng: number;
  lat: number;
  radiusKm: number;
  minCommissionUyu?: number;
  minBuyerRating?: number;
  maxBuyerRating?: number;
  minSellerRating?: number;
  maxSellerRating?: number;
}

export function openJobPlaceLabel(place: OpenJobPlace | undefined, empty = 'A coordinar'): string {
  if (!place) return empty;
  if (place.label?.trim()) return place.label.trim();
  if (place.hasPoint) return 'Ubicación en mapa';
  return empty;
}
