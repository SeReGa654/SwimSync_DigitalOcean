import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const authService = app.get(AuthService);
  const adminCookieName = authService.getCookieConfig().name;

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SwimSync API')
    .setDescription('REST API for SwimSync services')
    .setVersion('1.0.0')
    .addCookieAuth(adminCookieName, {
      type: 'apiKey',
      in: 'cookie',
      name: adminCookieName,
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputPath = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  await app.close();
}

generateOpenApi();
