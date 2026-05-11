import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { randomUUID } from 'crypto';
import { appEnv } from './config/env';
import { MetricsService } from './observability/metrics.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { runWithRequestContext } from './common/request-context';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const metricsService = app.get(MetricsService);
  const adminCookieName = appEnv.adminCookieName;

  if (appEnv.trustedProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', appEnv.trustedProxyHops);
  }
  
  app.enableCors({
    origin: appEnv.frontendOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.header('x-request-id') || randomUUID();
    const startedAt = Date.now();
    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId?: string }).requestId = requestId;
    res.locals.requestId = requestId;
    res.on('finish', () => {
      metricsService.recordRequest(Date.now() - startedAt, res.statusCode >= 400);
    });
    runWithRequestContext({ requestId }, () => next());
  });

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(
    helmet({
      referrerPolicy: { policy: 'no-referrer' },
      hsts: {
        maxAge: 63_072_000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    }),
  );

  const authLoginLimiter = rateLimit({
    windowMs: appEnv.globalRateLimitWindowMs,
    max: appEnv.authLoginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', authLoginLimiter);

  const exportLimiter = rateLimit({
    windowMs: appEnv.globalRateLimitWindowMs,
    max: appEnv.exportRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/export', exportLimiter);

  app.use(
    rateLimit({
      windowMs: appEnv.globalRateLimitWindowMs,
      max: appEnv.globalRateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SwimSync API')
    .setDescription('REST API for SwimSync services')
    .setVersion('1.0.0')
    .addTag('Health', 'Liveness, readiness and metrics endpoints')
    .addTag('Auth', 'Authentication and admin session management')
    .addTag('Competitions', 'Competition and age group management')
    .addTag('Events', 'Competition event management')
    .addTag('Entries', 'Competition entries management')
    .addTag('Athletes', 'Athletes catalog and import endpoints')
    .addTag('Results', 'Heat and event results operations')
    .addTag('Seeding', 'Heat/lane seeding operations')
    .addTag('Standings', 'Competition standings and points')
    .addTag('Export', 'DOCX/XLSX exports and previews')
    .addTag('Audit', 'System audit log access')
    .addTag('Support', 'User support ticket intake')
    .addTag('Feature Flags', 'Runtime feature flag administration')
    .addTag('WA Base Times', 'WA base time references')
    .addTag('UA Sport Ranks', 'UA sport ranks references')
    .addCookieAuth(adminCookieName, {
      type: 'apiKey',
      in: 'cookie',
      name: adminCookieName,
    })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs-json',
  });
  
  await app.listen(appEnv.backendPort, '0.0.0.0');
  logger.log(`SwimSync Backend running on http://localhost:${appEnv.backendPort}`);
}
bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Fatal bootstrap error: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
