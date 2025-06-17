import { NestFactory } from "@nestjs/core";
import {
  ValidationPipe,
  BadRequestException,
  RequestMethod,
} from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { validateEnvironment } from "@config/environment";
import { GlobalExceptionFilter } from "@common/filters/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get ConfigService and validate environment after app creation
  const configService = app.get(ConfigService);
  const env = validateEnvironment(configService);

  // Use Pino logger for NestJS logs (JSON in production, pretty in dev)
  app.useLogger(app.get(Logger));

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
        }));
        return new BadRequestException({
          message: "Validation failed",
          errors: result,
        });
      },
    })
  );

  // CORS configuration
  app.enableCors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Global prefix
  app.setGlobalPrefix("api", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  // OpenAPI/Swagger configuration
  const config = new DocumentBuilder()
    .setTitle("Pulpe Budget API")
    .setDescription("API pour la gestion des budgets personnels Pulpe")
    .setVersion("1.0.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Token JWT d'authentification",
    })
    .addServer("http://localhost:3000", "Serveur de développement")
    .addTag("Auth", "Authentification et validation des tokens")
    .addTag("User", "Gestion des profils utilisateurs")
    .addTag("Budgets", "Gestion des budgets")
    .addTag("Transactions", "Gestion des transactions")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // Health check endpoints
  app.getHttpAdapter().get("/", (req, res) => {
    res.json({
      message: "Pulpe Budget API",
      status: "running",
    });
  });

  app.getHttpAdapter().get("/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  // OpenAPI JSON endpoint
  app.getHttpAdapter().get("/api/openapi", (req, res) => {
    res.json(document);
  });

  await app.listen(env.PORT);
  console.log(`🚀 Application is running on: http://localhost:${env.PORT}`);
  console.log(
    `📚 Swagger documentation: http://localhost:${env.PORT}/api/docs`
  );
  console.log(`📋 OpenAPI JSON: http://localhost:${env.PORT}/api/openapi`);
}

bootstrap();
