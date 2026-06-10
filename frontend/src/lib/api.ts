import { Competition, Event, Entry, Athlete, Result, AgeGroup } from '@/types';
import type {
  ApiErrorPayload,
  AuthLoginResponse,
  AuthRegisterResponse,
  AuthUsersResponse,
  AuthManagedUser,
  AuthChangePasswordRequest,
  AuthChangePasswordResponse,
  AuthRole,
  AuthResetPasswordRequest,
  AuthSessionsResponse,
  AuthStatusResponse,
  DependenciesReadinessResponse,
  FeatureFlagDto,
  FeatureFlagsResponse,
  HealthResponse,
  MetricsResponse,
  ReadinessResponse,
  UpdateFeatureFlagRequest,
  SupportTicketCreateRequest,
  SupportTicketCreateResponse,
  components,
  operations,
} from 'shared-contracts';

const API = '/api';
const CSRF_COOKIE_NAME = 'csrf_token';
const LAST_REQUEST_ID_STORAGE_KEY = 'swimsync:last-request-id';

function readCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pairs = document.cookie ? document.cookie.split(';') : [];
  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return undefined;
}

export class ApiClientError extends Error {
  statusCode: number;
  code: string;
  requestId?: string;

  constructor(payload: { message: string; statusCode: number; code: string; requestId?: string }) {
    super(payload.message);
    this.name = 'ApiClientError';
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.requestId = payload.requestId;
  }
}

async function parseErrorPayload(res: Response): Promise<{
  message: string;
  statusCode: number;
  code: string;
  requestId?: string;
}> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (isJson) {
    const payload = await res.json().catch(() => ({ message: res.statusText })) as Partial<ApiErrorPayload> & { error?: string };
    return {
      message: payload.message || payload.error || res.statusText,
      statusCode: payload.statusCode || res.status,
      code: payload.code || `HTTP_${res.status}`,
      requestId: payload.requestId,
    };
  }
  const text = await res.text().catch(() => '');
  return {
    message: text || res.statusText,
    statusCode: res.status,
    code: `HTTP_${res.status}`,
    requestId: undefined,
  };
}

function emitAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('swimsync:auth-changed'));
  }
}

function storeLastRequestId(requestId?: string) {
  if (typeof window === 'undefined' || !requestId) return;
  sessionStorage.setItem(LAST_REQUEST_ID_STORAGE_KEY, requestId);
}

export function readLastRequestId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(LAST_REQUEST_ID_STORAGE_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const isMutatingMethod = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  const baseHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const csrfToken = isMutatingMethod ? readCookieValue(CSRF_COOKIE_NAME) : undefined;
  if (csrfToken) {
    (baseHeaders as Record<string, string>)['X-CSRF-Token'] = csrfToken;
  }
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { ...baseHeaders, ...options?.headers },
    ...options,
  });
  storeLastRequestId(res.headers.get('x-request-id') || undefined);
  if (!res.ok) {
    if (
      typeof window !== 'undefined'
      && res.status === 401
      && path !== '/auth/status'
      && path !== '/auth/login'
    ) {
      window.dispatchEvent(new CustomEvent('swimsync:auth-unauthorized'));
    }
    const errorPayload = await parseErrorPayload(res);
    storeLastRequestId(errorPayload.requestId);
    throw new ApiClientError(errorPayload);
  }
  return res.json();
}

export interface ImportPreview {
  athletes: ParsedAthlete[];
  entries: ParsedEntry[];
  warnings: { row: number; field?: string; message: string }[];
  errors: { row: number; message: string }[];
  extractedEvents?: ExtractedEvent[];
}

export interface ParsedAthlete {
  lastName?: string;
  firstName?: string;
  last_name?: string;
  first_name?: string;
  birthYear?: number;
  birth_year?: number;
  gender?: 'M' | 'F';
  currentRank?: string;
  rank?: string;
  coach?: string;
  club?: string;
  region?: string;
  doctorApproved?: boolean;
  doctor_approved?: boolean;
}

export interface ParsedEntry {
  athlete_index: number;
  distance_m: number;
  style: string;
  gender?: 'M' | 'F';
  entry_time_ms?: number | null;
  is_out_of_competition?: boolean;
  distance_raw?: string;
  time_raw?: string;
}

export interface ConfirmImportRequest {
  athletes: ParsedAthlete[];
  entries: ParsedEntry[];
  bulkEditApplied?: boolean;
}

export interface ExtractedEvent {
  distance: number;
  style: string;
  gender: 'M' | 'F';
}

export type ProtocolRuleField = components['schemas']['ResultProtocolConditionDto']['field'];
export type ProtocolRuleOperator = components['schemas']['ResultProtocolConditionDto']['operator'];
export type ProtocolLogicalOperator = components['schemas']['ResultProtocolConditionBlockDto']['operator'];
export type ProtocolCondition = components['schemas']['ResultProtocolConditionDto'];
export type ProtocolConditionBlock = components['schemas']['ResultProtocolConditionBlockDto'];
export type ProtocolRuleGroup = components['schemas']['ResultProtocolRuleGroupDto'];
export type AdvancedGroupingConfig = components['schemas']['ResultProtocolAdvancedGroupingDto'];
export type ResultProtocolConfig = components['schemas']['ResultProtocolConfigDto'];
export type CreateResultProtocolPresetRequest = components['schemas']['CreateResultProtocolPresetDto'];
export type UpdateResultProtocolPresetRequest = components['schemas']['UpdateResultProtocolPresetDto'];
export type ResultProtocolPreset = components['schemas']['ResultProtocolPresetResponseDto'];
type ResultProtocolPresetListResponse =
  operations['CompetitionsController_listResultProtocolPresets']['responses'][200]['content']['application/json'];
type ResultProtocolPresetCreateResponse =
  operations['CompetitionsController_createResultProtocolPreset']['responses'][201]['content']['application/json'];
type ResultProtocolPresetUpdateResponse =
  operations['CompetitionsController_updateResultProtocolPreset']['responses'][200]['content']['application/json'];
type ResultProtocolPresetDeleteResponse =
  operations['CompetitionsController_deleteResultProtocolPreset']['responses'][200]['content']['application/json'];
type ResultProtocolPresetApplyResponse =
  operations['CompetitionsController_applyResultProtocolPreset']['responses'][201]['content']['application/json'];

export interface AthleteDatabaseTreeAthlete {
  id: number;
  lastName: string;
  firstName: string;
  birthYear: number;
  gender: string;
  currentRank: string;
  coach: string | null;
  club: string;
  region: string | null;
  applicationCount: number;
  latestApplicationAt: string | null;
}

export interface AthleteDatabaseTreeSchool {
  school: string;
  athletes: AthleteDatabaseTreeAthlete[];
}

export interface AthleteDatabaseTreeRegion {
  region: string;
  schools: AthleteDatabaseTreeSchool[];
}

export interface AthleteDatabaseTreeResponse {
  regions: AthleteDatabaseTreeRegion[];
  totalAthletes: number;
}

export interface AthleteApplicationHistoryItem {
  id: number;
  createdAt: string;
  currentRank: string;
  coach: string | null;
  club: string;
  region: string | null;
  doctorApproved: boolean;
  competition: {
    id: number;
    name: string;
    dateFrom: string | null;
    dateTo: string | null;
    status: string;
  } | null;
  items: Array<{
    id: number;
    distanceM: number;
    style: string;
    gender: string;
    entryTimeMs: number | null;
    createdAt: string;
  }>;
}

export interface NamedApplicationAthletePayload {
  fullName: string;
  birthYear: number;
  gender: string;
  rank?: string;
  coach?: string;
  club?: string;
  region?: string;
  events: Array<{
    distanceM: number;
    style: string;
    entryTimeMs?: number | null;
  }>;
}

export interface NamedApplicationDocxPayload {
  title?: string;
  organization?: string;
  region?: string;
  generatedAt?: string;
  athletes: NamedApplicationAthletePayload[];
}

export interface ProtocolCompetitionPreview {
  name: string;
  categories_str: string;
  location: string;
  venue: string;
  pool_length: number;
  date_from: string;
  date_to: string;
}

export interface StartProtocolHeatEntry {
  lane: number;
  full_name: string;
  age_group: string;
  birth_year: number;
  entry_time_ms: number | null;
  coach: string;
  is_out_of_competition?: boolean;
}

export interface StartProtocolHeat {
  number: number;
  entries: StartProtocolHeatEntry[];
}

export interface StartProtocolEvent {
  distance_m: number;
  style: string;
  gender: string;
  heats: StartProtocolHeat[];
}

export interface StartProtocolPreview {
  competition: ProtocolCompetitionPreview;
  events: StartProtocolEvent[];
}

export interface ResultProtocolEntry {
  place: number | null;
  place_display: string;
  lane: number;
  full_name: string;
  birth_year: number | '';
  rank: string;
  club: string;
  region: string;
  finish_time_ms: number | null;
  achieved_rank: string | null;
  points_wa: number | null;
  coach: string;
  status: string;
  dq_reason: string | null;
}

export interface ResultProtocolAgeGroup {
  name: string;
  results: ResultProtocolEntry[];
}

export interface ResultProtocolEvent {
  distance_m: number;
  style: string;
  gender: string;
  age_groups: ResultProtocolAgeGroup[];
}

export interface ResultProtocolPreview {
  competition: ProtocolCompetitionPreview;
  events: ResultProtocolEvent[];
}

export interface WaBaseTimeRow {
  id: number;
  year: number;
  gender: string;
  distance: number;
  style: string;
  poolLength: number;
  baseTimeMs: number;
}

export interface UaSportRankRow {
  id: number;
  poolLength: number;
  gender: string;
  distance: number;
  style: string;
  rank: string;
  normTimeMs: number;
}

export interface WaBaseTimeUpsertInput {
  year: number;
  gender: string;
  distance: number;
  style: string;
  poolLength: number;
  baseTimeMs: number;
}

export interface UaSportRankCreateInput {
  poolLength: number;
  gender: string;
  distance: number;
  style: string;
  rank: string;
  normTimeMs: number;
}

export interface UaSportRankUpdateInput extends Partial<UaSportRankCreateInput> {}

export interface AuditLogItem {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  requestId: string | null;
  details: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  entity?: string;
  action?: string;
  requestId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StandingsRow {
  club: string;
  gold: number;
  silver: number;
  bronze: number;
  points: number;
}

export interface HeatResultInput {
  entryId: number;
  finishTimeMs?: number | null;
  status: string;
  version?: number;
}

export type DocxExportKind = 'start-protocol' | 'result-protocol';
export type DocxExportJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface DocxExportJobStartResponse {
  jobId: string;
  status: DocxExportJobStatus;
}

export interface DocxExportJobStatusResponse {
  jobId: string;
  status: DocxExportJobStatus;
  reason?: string | null;
}

export const api = {
  // Auth
  loginWithCredentials: async (username: string, password: string) => {
    const response = await request<AuthLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    emitAuthChanged();
    return response;
  },
  logoutAdmin: async () => {
    const response = await request<AuthStatusResponse>('/auth/logout', { method: 'POST' });
    emitAuthChanged();
    return response;
  },
  logoutAllSessions: async () => {
    const response = await request<AuthStatusResponse>('/auth/logout-all', { method: 'POST' });
    emitAuthChanged();
    return response;
  },
  getAuthStatus: () => request<AuthStatusResponse>('/auth/status'),
  registerAccount: (username: string, password: string, role: AuthRole) =>
    request<AuthRegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    }),
  getAuthSessions: () => request<AuthSessionsResponse>('/auth/sessions').then((res) => res.sessions),
  revokeAuthSession: (sessionId: number) => request<{ revoked: boolean }>(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  getAuthUsers: () => request<AuthUsersResponse>('/auth/users').then((res) => res.users),
  approveAuthUser: (userId: number) => request<AuthManagedUser>(`/auth/users/${userId}/approve`, { method: 'PATCH' }),
  activateAuthUser: (userId: number) => request<AuthManagedUser>(`/auth/users/${userId}/activate`, { method: 'PATCH' }),
  deactivateAuthUser: (userId: number) => request<AuthManagedUser>(`/auth/users/${userId}/deactivate`, { method: 'PATCH' }),
  resetAuthUserPassword: (userId: number, data: AuthResetPasswordRequest) =>
    request<{ updated: boolean }>(`/auth/users/${userId}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getAuthUserSessions: (userId: number) =>
    request<AuthSessionsResponse>(`/auth/users/${userId}/sessions`).then((res) => res.sessions),
  revokeAuthUserSession: (userId: number, sessionId: number) =>
    request<{ revoked: boolean }>(`/auth/users/${userId}/sessions/${sessionId}`, { method: 'DELETE' }),
  getMyAuthSessions: () => request<AuthSessionsResponse>('/auth/me/sessions').then((res) => res.sessions),
  revokeMyAuthSession: (sessionId: number) => request<{ revoked: boolean }>(`/auth/me/sessions/${sessionId}`, { method: 'DELETE' }),
  changeMyPassword: (data: AuthChangePasswordRequest) =>
    request<AuthChangePasswordResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Competitions
  getCompetitions: () => request<Competition[]>('/competitions'),
  getCompetition: (id: number, options?: RequestInit) => request<Competition>(`/competitions/${id}`, options),
  createCompetition: (data: Partial<Competition>) => request<Competition>('/competitions', { method: 'POST', body: JSON.stringify(data) }),
  updateCompetition: (id: number, data: Partial<Competition>) => request<Competition>(`/competitions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCompetition: (id: number) => request<{ deleted: boolean }>(`/competitions/${id}`, { method: 'DELETE' }),

  // Age Groups
  getAgeGroups: (compId: number) => request<AgeGroup[]>(`/competitions/${compId}/age-groups`),
  createAgeGroup: (compId: number, data: Omit<AgeGroup, 'id' | 'competitionId'>) => request<AgeGroup>(`/competitions/${compId}/age-groups`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAgeGroup: (compId: number, id: number) => request<{ deleted: boolean }>(`/competitions/${compId}/age-groups/${id}`, { method: 'DELETE' }),
  getResultProtocolConfig: (compId: number) => request<ResultProtocolConfig>(`/competitions/${compId}/result-protocol-config`),
  setResultProtocolConfig: (compId: number, data: ResultProtocolConfig) =>
    request<Competition>(`/competitions/${compId}/result-protocol-config`, { method: 'PATCH', body: JSON.stringify(data) }),
  getMyResultProtocolDefaults: () => request<ResultProtocolConfig | null>('/competitions/protocol-defaults/me'),
  setMyResultProtocolDefaults: (config: ResultProtocolConfig) =>
    request<{ id: number; userId: number; configJson: ResultProtocolConfig }>('/competitions/protocol-defaults/me', {
      method: 'PATCH',
      body: JSON.stringify({ config }),
    }),
  listResultProtocolPresets: (compId: number) =>
    request<ResultProtocolPresetListResponse>(`/competitions/${compId}/result-protocol-presets`),
  createResultProtocolPreset: (compId: number, data: CreateResultProtocolPresetRequest) =>
    request<ResultProtocolPresetCreateResponse>(`/competitions/${compId}/result-protocol-presets`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateResultProtocolPreset: (
    compId: number,
    presetId: number,
    data: UpdateResultProtocolPresetRequest,
  ) =>
    request<ResultProtocolPresetUpdateResponse>(`/competitions/${compId}/result-protocol-presets/${presetId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteResultProtocolPreset: (compId: number, presetId: number) =>
    request<ResultProtocolPresetDeleteResponse>(`/competitions/${compId}/result-protocol-presets/${presetId}`, { method: 'DELETE' }),
  applyResultProtocolPreset: (compId: number, presetId: number) =>
    request<ResultProtocolPresetApplyResponse>(`/competitions/${compId}/result-protocol-presets/${presetId}/apply`, { method: 'POST' }),

  // Events
  getEvents: (compId: number, options?: RequestInit) => request<Event[]>(`/events?competitionId=${compId}`, options),
  getEvent: (id: number) => request<Event>(`/events/${id}`),
  createEvent: (data: Partial<Event>) => request<Event>('/events', { method: 'POST', body: JSON.stringify(data) }),
  deleteEvent: (id: number) => request<{ deleted: boolean }>(`/events/${id}`, { method: 'DELETE' }),
  reorderEvents: (eventIds: number[]) => request<{ reordered: number }>('/events/reorder', { method: 'PATCH', body: JSON.stringify({ eventIds }) }),

  // Entries
  getEntries: (eventId: number, options?: RequestInit) => request<Entry[]>(`/entries?eventId=${eventId}`, options),
  getEntriesByCompetition: (compId: number) => request<Entry[]>(`/entries?competitionId=${compId}`),
  createEntry: (data: Partial<Entry>) => request<Entry>('/entries', { method: 'POST', body: JSON.stringify(data) }),
  updateEntry: (id: number, data: Partial<Entry>) => request<Entry>(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEntry: (id: number) => request<{ deleted: boolean }>(`/entries/${id}`, { method: 'DELETE' }),

  // Athletes
  getAthletes: (query?: { search?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.limit) params.set('limit', query.limit.toString());
    const queryStr = params.toString();
    return request<Athlete[]>(queryStr ? `/athletes?${queryStr}` : '/athletes');
  },
  getAthlete: (id: number) => request<Athlete>(`/athletes/${id}`),
  getAthleteDatabaseTree: (query?: {
    search?: string;
    region?: string;
    club?: string;
    sort?: 'lastName' | 'firstName' | 'birthYear' | 'createdAt';
    direction?: 'asc' | 'desc';
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.region) params.set('region', query.region);
    if (query?.club) params.set('club', query.club);
    if (query?.sort) params.set('sort', query.sort);
    if (query?.direction) params.set('direction', query.direction);
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return request<AthleteDatabaseTreeResponse>(qs ? `/athletes/database/tree?${qs}` : '/athletes/database/tree');
  },
  getAthleteApplicationHistory: (athleteId: number) =>
    request<AthleteApplicationHistoryItem[]>(`/athletes/database/athletes/${athleteId}/applications`),
  downloadNamedApplicationDocx: async (payload: NamedApplicationDocxPayload, filename: string) => {
    const csrfToken = readCookieValue(CSRF_COOKIE_NAME);
    const res = await fetch(`${API}/athletes/database/named-application-docx`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiClientError(await parseErrorPayload(res));
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  /** Parse file for preview WITHOUT saving. Returns {athletes, entries, warnings, errors} */
  parsePreview: async (file: File): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.append('file', file);
    const csrfToken = readCookieValue(CSRF_COOKIE_NAME);
    const res = await fetch(`${API}/athletes/parse-preview`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      body: formData,
    });
    if (!res.ok) {
      throw new ApiClientError(await parseErrorPayload(res));
    }
    return res.json();
  },

  /** Confirm and save previously parsed data */
  confirmImport: (competitionId: number, data: ConfirmImportRequest) => {
    return request<{ imported: number; entries: number }>(`/athletes/confirm-import?competitionId=${competitionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Direct import (legacy, parse+save in one step) */
  importAthletes: (file: File, competitionId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    const csrfToken = readCookieValue(CSRF_COOKIE_NAME);
    return fetch(`${API}/athletes/import?competitionId=${competitionId}`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      body: formData,
    }).then(async (r) => {
      if (!r.ok) {
        throw new ApiClientError(await parseErrorPayload(r));
      }
      return r.json();
    });
  },

  // Seeding
  generateSeeding: (eventId: number) => request<{ heats: number; entries: number }>(`/seeding/generate/${eventId}`, { method: 'POST' }),
  generateAllSeeding: (compId: number) => request<{ seeded: number; totalEntries: number }>(`/seeding/generate-all/${compId}`, { method: 'POST' }),
  clearSeeding: (eventId: number) => request<{ cleared: boolean }>(`/seeding/${eventId}`, { method: 'DELETE' }),

  // Results
  saveHeatResults: (results: HeatResultInput[]) => request<Result[]>('/results/save-heat', { method: 'POST', body: JSON.stringify({ results }) }),
  finalizeEvent: (eventId: number) => request<{ finalized: boolean; eventId: number }>(`/results/finalize/${eventId}`, { method: 'POST' }),
  unfinalizeEvent: (eventId: number) => request<{ unfinalized: boolean; eventId: number }>(`/results/unfinalize/${eventId}`, { method: 'POST' }),
  getResults: (eventId: number) => request<Entry[]>(`/results?eventId=${eventId}`),
  getPublicCompetition: (compId: number) => request<Competition>(`/public/competitions/${compId}`),
  getPublicEvents: (compId: number) => request<Event[]>(`/public/events?competitionId=${compId}`),

  // Protocol Previews (JSON for browser rendering)
  getStartProtocolPreview: (compId: number) => request<StartProtocolPreview>(`/export/start-protocol-preview/${compId}`),
  getResultProtocolPreview: (compId: number) => request<ResultProtocolPreview>(`/export/result-protocol-preview/${compId}`),
  submitDocxExportJob: (kind: DocxExportKind, compId: number) =>
    request<DocxExportJobStartResponse>(`/export/docx-jobs/${kind}/${compId}`, { method: 'POST' }),
  getDocxExportJobStatus: (jobId: string) =>
    request<DocxExportJobStatusResponse>(`/export/docx-jobs/${encodeURIComponent(jobId)}`),
  downloadDocxExportJob: async (jobId: string, filename: string) => {
    const res = await fetch(`${API}/export/docx-jobs/${encodeURIComponent(jobId)}/download`, { credentials: 'include' });
    if (!res.ok) {
      throw new ApiClientError(await parseErrorPayload(res));
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
  getHealthStatus: () => request<HealthResponse>('/health'),
  getReadinessStatus: () => request<ReadinessResponse>('/health/ready'),
  getDependenciesStatus: () => request<DependenciesReadinessResponse>('/health/dependencies'),
  getMetricsSnapshot: () => request<MetricsResponse>('/health/metrics'),
  getPrometheusMetrics: async () => {
    const res = await fetch(`${API}/health/prometheus`, { credentials: 'include' });
    if (!res.ok) {
      throw new ApiClientError(await parseErrorPayload(res));
    }
    return res.text();
  },

  // Admin
  getRuntimeFeatureFlags: () => request<FeatureFlagsResponse>('/feature-flags/effective').then((res) => res.flags),
  getFeatureFlags: () => request<FeatureFlagsResponse>('/feature-flags').then((res) => res.flags),
  updateFeatureFlag: (key: string, data: UpdateFeatureFlagRequest) =>
    request<FeatureFlagDto>(`/feature-flags/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getWaBaseTimes: (year?: number, poolLength?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year.toString());
    if (poolLength) params.set('poolLength', poolLength.toString());
    return request<WaBaseTimeRow[]>(`/wa-base-times?${params}`);
  },
  getUaSportRanks: (poolLength?: number) => {
    const params = poolLength ? `?poolLength=${poolLength}` : '';
    return request<UaSportRankRow[]>(`/ua-sport-ranks${params}`);
  },
  upsertWaBaseTime: (data: WaBaseTimeUpsertInput) =>
    request<WaBaseTimeRow>('/wa-base-times', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateWaBaseTime: (id: number, data: WaBaseTimeUpsertInput) =>
    request<WaBaseTimeRow>(`/wa-base-times/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteWaBaseTime: (id: number) => request<{ deleted?: boolean }>(`/wa-base-times/${id}`, { method: 'DELETE' }),
  createUaSportRank: (data: UaSportRankCreateInput) =>
    request<UaSportRankRow>('/ua-sport-ranks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUaSportRank: (id: number, data: UaSportRankUpdateInput) =>
    request<UaSportRankRow>(`/ua-sport-ranks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteUaSportRank: (id: number) => request<{ deleted?: boolean }>(`/ua-sport-ranks/${id}`, { method: 'DELETE' }),

  // File downloads (bypass proxy header stripping)
  downloadFile: async (path: string, filename: string) => {
    const res = await fetch(`${API}${path}`, { credentials: 'include' });
    if (!res.ok) {
      throw new ApiClientError(await parseErrorPayload(res));
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Audit Logs
  getAuditLogs: (filters?: AuditLogFilters) => {
    const params = new URLSearchParams();
    if (filters?.entity) params.set('entity', filters.entity);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.requestId) params.set('requestId', filters.requestId);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    const query = params.toString();
    return request<AuditLogItem[]>(query ? `/audit?${query}` : '/audit');
  },

  // Standings
  getStandings: (compId: number) =>
    request<{ medalStandings: StandingsRow[]; pointsStandings: StandingsRow[] }>(`/standings/${compId}`),

  // Support
  createSupportTicket: (data: SupportTicketCreateRequest) =>
    request<SupportTicketCreateResponse>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
