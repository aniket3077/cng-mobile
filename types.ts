export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  createdAt: string;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string | null;
  lat: number;
  lng: number;
  fuelTypes: string[];
  isPartner: boolean;
  rating: number;
}

export interface StationSuggestion {
  station: Station;
  distance: number;
  score: number;
  reason: string;
}

