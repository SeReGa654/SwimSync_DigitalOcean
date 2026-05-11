export interface ApiErrorPayload {
    statusCode: number;
    code: string;
    message: string;
    timestamp: string;
    path: string;
    requestId?: string;
}
export interface AuthLoginRequest {
    username: string;
    password: string;
}
export type AuthRole = 'admin' | 'secretary';
export interface AuthStatusResponse {
    authenticated: boolean;
    role?: AuthRole;
    username?: string;
}
export interface AuthLoginResponse extends AuthStatusResponse {
    expiresInMs: number;
}
export interface AuthSessionInfo {
    id: number;
    username: string;
    role: AuthRole;
    createdAt: string;
    expiresAt: string;
    ip?: string;
    userAgent?: string;
    current: boolean;
}
export interface AuthSessionsResponse {
    sessions: AuthSessionInfo[];
}
export interface AuthRegisterRequest {
    username: string;
    password: string;
    role: AuthRole;
}
export interface AuthRegisterResponse {
    requested: boolean;
    approved: boolean;
    username: string;
    role: AuthRole;
}
export interface AuthManagedUser {
    id: number;
    username: string;
    role: AuthRole;
    isActive: boolean;
    isApproved: boolean;
    approvedAt?: string;
    approvedBy?: string;
    createdAt: string;
    lastLoginAt?: string;
    activeSessions: number;
}
export interface AuthUsersResponse {
    users: AuthManagedUser[];
}
export interface AuthResetPasswordRequest {
    password: string;
}
export interface HealthResponse {
    status: 'ok' | 'degraded';
    service: string;
    timestamp: string;
    requestId?: string;
}
export interface ReadinessResponse extends HealthResponse {
    checks: {
        database: 'up' | 'down';
    };
}
export interface MetricsResponse {
    processUptimeSec: number;
    memoryRssMb: number;
    totalRequests: number;
    totalErrors: number;
    averageLatencyMs: number;
}
export interface FeatureFlagDto {
    key: string;
    name: string;
    description: string;
    defaultEnabled: boolean;
    enabled: boolean;
    overridden: boolean;
    updatedBy: string | null;
    updatedAt: string | null;
}
export interface FeatureFlagsResponse {
    flags: FeatureFlagDto[];
}
export interface UpdateFeatureFlagRequest {
    enabled: boolean;
}
export * from './generated/openapi';
