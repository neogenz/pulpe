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
    origin: createOriginValidator(configService, nodeEnv),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

function createOriginValidator(
  configService: ConfigService,
  nodeEnv: string,
): (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void {
  return (origin, callback) => {
    // Pas d'origin (mobile apps, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (nodeEnv === 'production') {
      if (isAllowedOriginProduction(origin, configService)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    } else {
      if (isAllowedOriginDevelopment(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    }
  };
}

function isAllowedOriginProduction(
  origin: string,
  configService: ConfigService,
): boolean {
  const productionOrigins = getProductionOrigins(configService);

  // Vérifier les URLs fixes de production
  if (productionOrigins.includes(origin)) {
    return true;
  }

  // Pattern pour les URLs de preview Vercel de ton projet
  return /^https:\/\/pulpe-frontend-.+-maximes-projects-.+\.vercel\.app$/.test(
    origin,
  );
}

function isAllowedOriginDevelopment(origin: string): boolean {
  // En développement : localhost + toutes les URLs Vercel
  return (
    /^http:\/\/localhost:\d+$/.test(origin) || origin.includes('.vercel.app')
  );
}

function getProductionOrigins(configService: ConfigService): string[] {
  return configService
    .get<string>('CORS_ORIGIN', '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url);
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
  document?: import('@nestjs/swagger').OpenAPIObject,
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

  // Only expose OpenAPI JSON in non-production environments
  if (document) {
    app.getHttpAdapter().get('/api/openapi', (req, res) => {
      res.json(document);
    });
  }
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
  swaggerEnabled: boolean,
): void {
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🔗 API v1 endpoints: http://localhost:${port}/api/v1`);

  if (swaggerEnabled) {
    logger.log(`📚 Swagger documentation: http://localhost:${port}/docs`);
    logger.log(`📋 OpenAPI JSON: http://localhost:${port}/api/openapi`);
  } else {
    logger.log('🔒 Swagger documentation is disabled in production');
  }

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
  logger.log(`🔗 Supabase URL: ${env.SUPABASE_URL}`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  // Environment is now validated automatically by ConfigModule
  const env: Environment = {
    NODE_ENV: configService.get('NODE_ENV')!,
    PORT: configService.get('PORT')!,
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

  // Only setup Swagger in non-production environments
  let document: import('@nestjs/swagger').OpenAPIObject | undefined;
  const isProduction = env.NODE_ENV === 'production';

  if (!isProduction) {
    patchNestJsSwagger();
    document = setupSwagger(app);
  }

  setupHealthEndpoints(app, document);

  const logger = app.get(Logger);

  await app.listen(env.PORT, '0.0.0.0');

  logApplicationInfo(logger, env.PORT, env, !isProduction);
}

bootstrap();
