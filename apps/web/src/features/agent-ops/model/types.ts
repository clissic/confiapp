export interface AgentSearchHit {
  id: string;
  fullName: string;
  displayName?: string;
  distanceKm: number;
  ratingAverage: number;
  ratingCount: number;
  activeJobs: number;
  maxActiveTransactions: number;
  coverageRadiusKm: number;
  isAcceptingAssignments: boolean;
  hourlyRateCents?: number;
  currency?: string;
  timezone: string;
  score: number;
  locationLabel?: string;
}
