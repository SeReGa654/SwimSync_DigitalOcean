export interface Competition {
  id: number;
  name: string;
  categoriesStr: string;
  location: string;
  venue: string;
  poolLength: number;
  lanes: number;
  dateFrom: string | null;
  dateTo: string | null;
  status: string;
  circularSeeding: boolean;
  resultProtocolFormat?: 'SEPARATE' | 'COMBINED' | 'MIXED';
  mixedFormatPrimaryAgeGroupId?: number | null;
  mixedFormatSecondaryAgeGroupIds?: string | null;
  createdAt: string;
  ageGroups?: AgeGroup[];
}

export interface AgeGroup {
  id: number;
  competitionId: number;
  name: string;
  birthYearFrom: number;
  birthYearTo: number;
}

export interface Event {
  id: number;
  competitionId: number;
  distance: number;
  style: string;
  gender: 'M' | 'F' | string;
  name: string;
  sortOrder: number;
  isRelay?: boolean;
  status?: string;
  _count?: {
    entries: number;
  };
}

export interface Athlete {
  id: number;
  lastName: string;
  firstName: string;
  birthYear: number;
  gender: string;
  currentRank: string;
  coach: string | null;
  club: string;
  region: string | null;
}

export interface Result {
  id: number;
  entryId: number;
  finishTimeMs: number | null;
  pointsWa: number | null;
  achievedRank: string | null;
  place: number | null;
  placeDisplay: string | null;
  status: string; // OK, DQ, DNS, DNF, PK
  dqReason?: string | null;
  version: number;
}

export interface Entry {
  id: number;
  athleteId: number | null;
  eventId: number;
  entryTimeMs: number | null;
  heatNumber: number | null;
  laneNumber: number | null;
  ageGroupId: number | null;
  doctorApproved: boolean;
  isOutOfCompetition: boolean;
  status: string; // IN, PK, DQ, DNS, DNF
  teamName?: string | null;
  athlete?: Athlete;
  event?: Event;
  ageGroup?: AgeGroup;
  result?: Result;
}
