import { Controller, Get, Logger, Req, Res } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { MetricsService } from './observability/metrics.service';
import { Request, Response } from 'express';
import { Socket } from 'node:net';
import { appEnv } from './config/env';
import type { DependenciesReadinessResponse, HealthResponse, ReadinessResponse } from 'shared-contracts';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  private parseHostPort(rawUrl: string, fallbackHost: string, fallbackPort: number) {
    try {
      const parsed = new URL(rawUrl);
      return {
        host: parsed.hostname || fallbackHost,
        port: Number(parsed.port) || fallbackPort,
      };
    } catch {
      return { host: fallbackHost, port: fallbackPort };
    }
  }

  private async checkTcp(host: string, port: number, timeoutMs = 1500): Promise<'up' | 'down'> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let settled = false;
      const finish = (status: 'up' | 'down') => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(status);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish('up'));
      socket.once('timeout', () => finish('down'));
      socket.once('error', () => finish('down'));
      socket.connect(port, host);
    });
  }

  @Get()
  @ApiOperation({ summary: 'Basic liveness probe for backend service' })
  check(@Req() request: Request): HealthResponse {
    const requestId = (request as Request & { requestId?: string }).requestId;
    return {
      status: 'ok',
      service: 'swimsync-backend',
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe with database check' })
  async ready(@Req() request: Request): Promise<ReadinessResponse> {
    const requestId = (request as Request & { requestId?: string }).requestId;
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error: unknown) {
      database = 'down';
      this.logger.warn(`Readiness check failed for database: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'swimsync-backend',
      timestamp: new Date().toISOString(),
      requestId,
      checks: { database },
    };
  }

  @Get('dependencies')
  @ApiOperation({ summary: 'Dependency health probe for DB/DOCX/Redis/Postgres' })
  async dependencies(@Req() request: Request): Promise<DependenciesReadinessResponse> {
    const requestId = (request as Request & { requestId?: string }).requestId;

    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error: unknown) {
      database = 'down';
      this.logger.warn(`Dependency check failed for database: ${error instanceof Error ? error.message : String(error)}`);
    }

    let docx: 'up' | 'down' = 'down';
    try {
      const docxResponse = await fetch(`${appEnv.docxServiceUrl}/docs`, {
        signal: AbortSignal.timeout(1500),
      });
      docx = docxResponse.ok ? 'up' : 'down';
    } catch (error: unknown) {
      this.logger.warn(`Dependency check failed for DOCX service: ${error instanceof Error ? error.message : String(error)}`);
    }

    const redisTarget = this.parseHostPort(appEnv.redisUrl || 'redis://localhost:6379', 'localhost', 6379);
    const redis = await this.checkTcp(redisTarget.host, redisTarget.port);

    const databaseUrl = process.env.DATABASE_URL || '';
    const postgresTarget = this.parseHostPort(
      databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')
        ? databaseUrl
        : 'postgres://localhost:5432/swimsync',
      'localhost',
      5432,
    );
    const postgres = await this.checkTcp(postgresTarget.host, postgresTarget.port);

    const checks = { database, docx, redis, postgres };
    const status = Object.values(checks).every((value) => value === 'up') ? 'ok' : 'degraded';

    return {
      status,
      service: 'swimsync-backend',
      timestamp: new Date().toISOString(),
      requestId,
      checks,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get internal metrics snapshot in JSON' })
  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  @Get('prometheus')
  @ApiOperation({ summary: 'Get Prometheus metrics output' })
  async prometheus(@Res() response: Response) {
    response.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    response.send(await this.metrics.renderPrometheus());
  }
}
