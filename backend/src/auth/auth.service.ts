import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getAppEnv } from '../config/env';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { AuthRole } from 'shared-contracts';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminCookieConfig {
  name: string;
  roleName: string;
  csrfName: string;
  maxAgeMs: number;
  path: string;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
}

export interface ManagedAuthUser {
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

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma?: PrismaService) {}

  private getPrisma(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaService is not available');
    }
    return this.prisma;
  }

  async onModuleInit(): Promise<void> {
    const bootstrapPassword = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (!bootstrapPassword) return;
    const bootstrapUsername = (process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME || 'admin').trim();
    if (!bootstrapUsername) return;

    const prisma = this.getPrisma();
    const existing = await prisma.user.findUnique({ where: { username: bootstrapUsername } });
    if (existing) {
      if (!existing.isActive || !existing.isApproved || existing.role !== 'admin') {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: 'admin',
            isActive: true,
            isApproved: true,
            approvedAt: existing.approvedAt ?? new Date(),
            approvedBy: existing.approvedBy ?? 'bootstrap',
          },
        });
      }
      return;
    }

    await prisma.user.create({
      data: {
        username: bootstrapUsername,
        passwordHash: this.hashPassword(bootstrapPassword),
        role: 'admin',
        isActive: true,
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: 'bootstrap',
      },
    });
    this.logger.log(`Bootstrap admin created: ${bootstrapUsername}`);
  }

  getCookieConfig(): AdminCookieConfig {
    const env = getAppEnv();
    return {
      name: env.adminCookieName,
      roleName: env.authRoleCookieName,
      csrfName: env.csrfCookieName,
      maxAgeMs: env.adminCookieMaxAgeMs,
      path: env.adminCookiePath,
      secure: env.adminCookieSecure,
      sameSite: env.adminCookieSameSite,
    };
  }

  readCookie(headerValue: string | undefined, name: string): string | undefined {
    if (!headerValue) return undefined;
    const parts = headerValue.split(';');
    for (const part of parts) {
      const [rawKey, ...rawValue] = part.trim().split('=');
      if (rawKey === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return undefined;
  }

  private normalizeRole(role: string | null | undefined): AuthRole | null {
    return role === 'admin' || role === 'secretary' ? role : null;
  }

  isRoleAllowed(role: AuthRole, requiredRole: AuthRole): boolean {
    if (role === 'admin') return true;
    return requiredRole === 'secretary' && role === 'secretary';
  }

  generateCsrfToken(): string {
    return randomBytes(24).toString('hex');
  }

  generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, passwordHash: string): boolean {
    const parts = passwordHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, expectedHashHex] = parts;
    const expectedBuffer = Buffer.from(expectedHashHex, 'hex');
    const candidateBuffer = scryptSync(password, salt, 64);
    if (expectedBuffer.length !== candidateBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, candidateBuffer);
  }

  async resolveRoleBySessionToken(token: string): Promise<AuthRole | null> {
    if (!token) return null;
    const session = await this.getPrisma().session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session || !session.user.isActive || !session.user.isApproved) return null;
    return this.normalizeRole(session.user.role);
  }

  async resolveSessionForRequest(token: string): Promise<{
    sessionId: number;
    userId: number;
    username: string;
    role: AuthRole;
  } | null> {
    if (!token) return null;
    const session = await this.getPrisma().session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session || !session.user.isActive || !session.user.isApproved) return null;
    const role = this.normalizeRole(session.user.role);
    if (!role) return null;
    return {
      sessionId: session.id,
      userId: session.userId,
      username: session.user.username,
      role,
    };
  }

  async resolveRoleForRequest(token: string): Promise<AuthRole | null> {
    const session = await this.resolveSessionForRequest(token);
    return session?.role || null;
  }

  async registerPendingUser(username: string, password: string, role: AuthRole): Promise<ManagedAuthUser | null> {
    const normalizedRole = role === 'secretary' ? 'secretary' : null;
    if (!normalizedRole) return null;
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return null;

    const existing = await this.getPrisma().user.findUnique({
      where: { username: normalizedUsername },
    });
    if (existing) {
      return null;
    }

    const user = await this.getPrisma().user.create({
      data: {
        username: normalizedUsername,
        passwordHash: this.hashPassword(password),
        role: normalizedRole,
        isActive: true,
        isApproved: false,
      },
      include: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } } },
    });
    return this.mapManagedUser(user);
  }

  async loginWithCredentials(
    username: string,
    password: string,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<{ userId: number; username: string; role: AuthRole; sessionToken: string } | null> {
    const user = await this.getPrisma().user.findFirst({
      where: { username, isActive: true, isApproved: true },
    });
    if (!user) return null;
    const role = this.normalizeRole(user.role);
    if (!role) return null;
    if (!this.verifyPassword(password, user.passwordHash)) return null;

    const sessionToken = this.generateSessionToken();
    await this.getPrisma().session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(sessionToken),
        expiresAt: new Date(Date.now() + this.getCookieConfig().maxAgeMs),
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
    await this.getPrisma().user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return { userId: user.id, username: user.username, role, sessionToken };
  }

  async listUsers(): Promise<ManagedAuthUser[]> {
    const users = await this.getPrisma().user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        },
      },
    });
    return users
      .map((user) => this.mapManagedUser(user))
      .filter((user): user is ManagedAuthUser => user !== null);
  }

  async approveUser(userId: number, approvedBy: string): Promise<ManagedAuthUser | null> {
    const user = await this.getPrisma().user.findUnique({
      where: { id: userId },
      include: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } } },
    });
    if (!user) return null;
    const role = this.normalizeRole(user.role);
    if (!role) return null;

    const updated = await this.getPrisma().user.update({
      where: { id: userId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedBy,
      },
      include: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } } },
    });
    return this.mapManagedUser(updated);
  }

  async setUserActive(userId: number, isActive: boolean): Promise<ManagedAuthUser | null> {
    const existing = await this.getPrisma().user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) return null;

    if (!isActive) {
      await this.getPrisma().session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const updated = await this.getPrisma().user.update({
      where: { id: userId },
      data: { isActive },
      include: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } } },
    });
    return this.mapManagedUser(updated);
  }

  async resetUserPassword(userId: number, newPassword: string): Promise<boolean> {
    const result = await this.getPrisma().user.updateMany({
      where: { id: userId },
      data: {
        passwordHash: this.hashPassword(newPassword),
      },
    });
    if (result.count === 0) return false;

    await this.getPrisma().session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return true;
  }

  async verifyUserPassword(userId: number, password: string): Promise<boolean> {
    const user = await this.getPrisma().user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) return false;
    return this.verifyPassword(password, user.passwordHash);
  }

  async changeOwnPassword(userId: number, newPassword: string, currentSessionId: number): Promise<boolean> {
    const result = await this.getPrisma().user.updateMany({
      where: { id: userId },
      data: {
        passwordHash: this.hashPassword(newPassword),
      },
    });
    if (result.count === 0) return false;

    await this.getPrisma().session.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: currentSessionId },
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return true;
  }

  async logoutSessionByToken(token: string): Promise<number> {
    if (!token) return 0;
    const result = await this.getPrisma().session.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return result.count;
  }

  async logoutAllSessionsByToken(token: string): Promise<{ userId: number; revokedCount: number } | null> {
    if (!token) return null;
    const session = await this.getPrisma().session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      select: { userId: true },
    });
    if (!session) return null;

    const result = await this.getPrisma().session.updateMany({
      where: {
        userId: session.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return {
      userId: session.userId,
      revokedCount: result.count,
    };
  }

  async getActiveSessionsForUser(userId: number, currentSessionId: number | null = null) {
    const sessions = await this.getPrisma().session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    return sessions
      .map((session) => {
        const role = this.normalizeRole(session.user.role);
        if (!role) return null;
        return {
          id: session.id,
          username: session.user.username,
          role,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          ip: session.ip || undefined,
          userAgent: session.userAgent || undefined,
          current: currentSessionId !== null && session.id === currentSessionId,
        };
      })
      .filter((session): session is NonNullable<typeof session> => session !== null);
  }

  async revokeSessionForUser(userId: number, sessionId: number): Promise<boolean> {
    const result = await this.getPrisma().session.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return result.count > 0;
  }

  isValidCsrfToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
    if (!cookieToken || !headerToken) return false;
    return cookieToken === headerToken;
  }

  private mapManagedUser(
    user: {
      id: number;
      username: string;
      role: string;
      isActive: boolean;
      isApproved: boolean;
      approvedAt: Date | null;
      approvedBy: string | null;
      createdAt: Date;
      lastLoginAt: Date | null;
      sessions: Array<{ id: number }>;
    },
  ): ManagedAuthUser | null {
    const role = this.normalizeRole(user.role);
    if (!role) return null;
    return {
      id: user.id,
      username: user.username,
      role,
      isActive: user.isActive,
      isApproved: user.isApproved,
      approvedAt: user.approvedAt?.toISOString(),
      approvedBy: user.approvedBy || undefined,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      activeSessions: user.sessions.length,
    };
  }
}
