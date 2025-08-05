import { NestFactory } from '@nestjs/core';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import type { Environment } from '@config/environment';
import { patchNestJsSwagger } from 'nestjs-zod';

// ValidationPipe removed - using ZodValidationPipe from app.module.ts instead

function setupCors(app: import('@nestjs/common').INestApplication): void {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  app.enableCors({
    origin:
      nodeEnv === 'production'
        ? configService.get<string>('CORS_ORIGIN', '').split(',')
        : (
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
          ) => {
            // En développement, autoriser tous les ports localhost
            if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
              callback(null, true);
            } else {
              callback(new Error('Not allowed by CORS'));
            }
          },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

function setupSecurity(app: import('@nestjs/common').INestApplication): void {
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for API
      crossOriginEmbedderPolicy: false, // Allow embedding
    }),
  );

  // Response compression
  app.use(compression());
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

function setupApiVersioning(
  app: import('@nestjs/common').INestApplication,
): void {
  // Enable URI versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
}

function logApplicationInfo(
  logger: Logger,
  port: number,
  env: Environment,
): void {
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🔗 API v1 endpoints: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/docs`);
  logger.log(`📋 OpenAPI JSON: http://localhost:${port}/api/openapi`);
  logger.log('🔍 HTTP request/response logging is active');

  const debugHttpFull = env.DEBUG_HTTP_FULL === 'true';
  if (debugHttpFull) {
    logger.warn(
      '⚠️  DEBUG_HTTP_FULL is enabled - sensitive data will be logged!',
    );
  } else {
    logger.log('🛡️ Security: Request data redaction enabled');
  }

  logger.log(`⚡ Environment: ${env.NODE_ENV}`);
}

async function bootstrap() {
  patchNestJsSwagger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  // Environment is now validated automatically by ConfigModule
  const env: Environment = {
    NODE_ENV: configService.get('NODE_ENV')!,
    PORT: configService.get('PORT')!,
    FRONTEND_URL: configService.get('FRONTEND_URL')!,
    SUPABASE_URL: configService.get('SUPABASE_URL')!,
    SUPABASE_ANON_KEY: configService.get('SUPABASE_ANON_KEY')!,
    SUPABASE_SERVICE_ROLE_KEY: configService.get('SUPABASE_SERVICE_ROLE_KEY'),
    DEBUG_HTTP_FULL: configService.get('DEBUG_HTTP_FULL'),
  };

  app.useLogger(app.get(Logger));

  // Setup security middleware
  setupSecurity(app);

  // Setup CORS after security middleware
  setupCors(app);

  // Setup API versioning
  setupApiVersioning(app);

  const document = setupSwagger(app);
  setupHealthEndpoints(app, document);

  const logger = app.get(Logger);

  await app.listen(env.PORT);

  logApplicationInfo(logger, env.PORT, env);
}

bootstrap();
