export interface OpenJob {
  id: string;
  code: string;
  title: string;
  description?: string;
  status: string;
  amountCents: number;
  currency: string;
  distanceKm: number;
  meeting: {
    lng: number;
    lat: number;
    label?: string;
  };
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
  minPay?: number;
  minBuyerRating?: number;
  minSellerRating?: number;
  maxDistanceKm?: number;
}
