import { NestFactory } from '@nestjs/core';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateEnvironment } from '@config/environment';
import { patchNestJsSwagger } from 'nestjs-zod';

// ValidationPipe removed - using ZodValidationPipe from app.module.ts instead

function setupCors(app: import('@nestjs/common').INestApplication): void {
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

function setupSwagger(
  app: import('@nestjs/common').INestApplication,
): import('@nestjs/swagger').OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Pulpe Budget API v1')
    .setDescription(
      'API pour la gestion des budgets personnels Pulpe - Version 1',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token',
      },
      'bearer',
    )
    .addServer('http://localhost:3000', 'Serveur de développement')
    .addTag('Auth', 'Authentification et validation des tokens')
    .addTag('User', 'Gestion des profils utilisateurs')
    .addTag('Budgets', 'Gestion des budgets')
    .addTag('Budget Templates', 'Gestion des modèles de budget')
    .addTag('Budget Lines', 'Gestion des lignes de budget')
    .addTag('Transactions', 'Gestion des transactions')
    .addTag('Debug', 'Outils de développement et débogage')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  return document;
}

function setupHealthEndpoints(
  app: import('@nestjs/common').INestApplication,
  document: import('@nestjs/swagger').OpenAPIObject,
): void {
  app.getHttpAdapter().get('/', (req, res) => {
    res.json({
      message: 'Pulpe Budget API',
      status: 'running',
    });
  });

  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  app.getHttpAdapter().get('/api/openapi', (req, res) => {
    res.json(document);
  });
}

async function bootstrap() {
  patchNestJsSwagger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const env = validateEnvironment(configService);

  app.useLogger(app.get(Logger));

  setupCors(app);

  // Enable URI versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const document = setupSwagger(app);
  setupHealthEndpoints(app, document);

  const logger = app.get(Logger);

  logger.log('Starting Pulpe Budget API server...');

  await app.listen(env.PORT);

  logger.log(`🚀 Application is running on: http://localhost:${env.PORT}`);
  logger.log(`🔗 API v1 endpoints: http://localhost:${env.PORT}/api/v1`);
  logger.log(`📚 Swagger documentation: http://localhost:${env.PORT}/docs`);
  logger.log(`📋 OpenAPI JSON: http://localhost:${env.PORT}/api/openapi`);
  logger.log('HTTP request logging is active with Pino');
}

bootstrap();
