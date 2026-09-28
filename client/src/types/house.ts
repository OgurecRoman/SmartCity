export type HouseEntrance = {
  number: string | number;
  from: number;
  to: number;
};

export type House = {
  id: number;
  address: string;
  lat: number | null;
  lng: number | null;
  apartmentsCount: number | null;
  entrances: HouseEntrance[];
  votePercent: number;
  dataSource?: string;
  residentsCount?: number;
  chatBound: boolean;
};

export type Building = {
  externalId: string;
  source: string;
  address: string;
  lat: number;
  lng: number;
  apartmentsCount: number | null;
  entrances: HouseEntrance[];
};

export type HouseLookup = {
  building: Building;
  house: House | null;
};

export type GeoHit = {
  label: string;
  lat: number;
  lng: number;
};
