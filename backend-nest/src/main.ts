import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateEnvironment } from '@config/environment';
import { patchNestJsSwagger } from 'nestjs-zod';
import { SecurityConfig } from './shared/infrastructure/security';

// ValidationPipe removed - using ZodValidationPipe from app.module.ts instead

function setupCors(
  app: import('@nestjs/common').INestApplication,
  securityConfig: SecurityConfig,
): void {
  app.enableCors(securityConfig.getCorsOptions());
}

function setupSwagger(
  app: import('@nestjs/common').INestApplication,
): import('@nestjs/swagger').OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Pulpe Budget API')
    .setDescription('API pour la gestion des budgets personnels Pulpe')
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
    .addTag('Transactions', 'Gestion des transactions')
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
  const securityConfig = app.get(SecurityConfig);

  app.useLogger(app.get(Logger));

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Apply security middleware
  app.use(helmet(securityConfig.getHelmetOptions()));

  setupCors(app, securityConfig);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'health/metrics', method: RequestMethod.GET },
      { path: 'health/metrics/operations', method: RequestMethod.GET },
      { path: 'health/metrics/overview', method: RequestMethod.GET },
    ],
  });

  const document = setupSwagger(app);
  setupHealthEndpoints(app, document);

  const logger = app.get(Logger);

  logger.log('Starting Pulpe Budget API server...');
  logger.log(
    'Security features enabled: Helmet, CORS, Rate Limiting, Enhanced Auth',
  );
  logger.log('Graceful shutdown enabled');

  await app.listen(env.PORT);

  logger.log(`🚀 Application is running on: http://localhost:${env.PORT}`);
  logger.log(`📚 Swagger documentation: http://localhost:${env.PORT}/docs`);
  logger.log(`📋 OpenAPI JSON: http://localhost:${env.PORT}/api/openapi`);
  logger.log('HTTP request logging is active with Pino');
}

bootstrap();
