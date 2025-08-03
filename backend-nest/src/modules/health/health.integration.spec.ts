import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from './health.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

describe.skipIf(!process.env.SUPABASE_URL || process.env.CI === 'true')(
  'Health Endpoints (Integration)',
  () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env.test',
          }),
          LoggerModule.forRoot({
            pinoHttp: {
              level: 'silent', // Disable logs during tests
            },
          }),
          SupabaseModule,
          HealthModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    describe('/health (GET)', () => {
      it('should return health status', () => {
        return request(app.getHttpServer())
          .get('/health')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('status');
            expect(res.body).toHaveProperty('info');
            expect(res.body.info).toHaveProperty('database');
            expect(res.body.info).toHaveProperty('memory_heap');
            expect(res.body.info).toHaveProperty('memory_rss');
            expect(res.body.info).toHaveProperty('storage');
          });
      });
    });

    describe('/health/live (GET)', () => {
      it('should return liveness status', () => {
        return request(app.getHttpServer())
          .get('/health/live')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('status');
            expect(res.body).toHaveProperty('info');
            expect(res.body.info).toHaveProperty('memory_heap');
          });
      });
    });

    describe('/health/ready (GET)', () => {
      it('should return readiness status', () => {
        return request(app.getHttpServer())
          .get('/health/ready')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('status');
            expect(res.body).toHaveProperty('info');
            expect(res.body.info).toHaveProperty('database');
            expect(res.body.info).toHaveProperty('supabase_auth');
            expect(res.body.info).toHaveProperty('memory_heap');
          });
      });
    });

    describe('/health/metrics (GET)', () => {
      it('should return application metrics', () => {
        return request(app.getHttpServer())
          .get('/health/metrics')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('uptime');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('memory');
            expect(res.body).toHaveProperty('business');
            expect(res.body).toHaveProperty('errors');

            // Check memory metrics
            expect(res.body.memory).toHaveProperty('heapUsed');
            expect(res.body.memory).toHaveProperty('heapTotal');
            expect(res.body.memory).toHaveProperty('rss');
            expect(res.body.memory).toHaveProperty('external');

            // Check business metrics
            expect(res.body.business).toHaveProperty('totalBudgets');
            expect(res.body.business).toHaveProperty('totalTransactions');
            expect(res.body.business).toHaveProperty('totalUsers');
            expect(res.body.business).toHaveProperty('recentActivity');

            // Check error rates
            expect(res.body.errors).toHaveProperty('rate5min');
            expect(res.body.errors).toHaveProperty('rate1hour');
            expect(res.body.errors).toHaveProperty('rate24hour');
          });
      });
    });

    describe('/health/metrics/operations (GET)', () => {
      it('should return operation statistics', () => {
        return request(app.getHttpServer())
          .get('/health/metrics/operations')
          .expect(200)
          .expect((res) => {
            expect(res.body).toBeTypeOf('object');
          });
      });

      it('should return stats for specific operation', () => {
        return request(app.getHttpServer())
          .get('/health/metrics/operations?operation=test_op')
          .expect(200)
          .expect((res) => {
            expect(res.body).toBeTypeOf('object');
            if (Object.keys(res.body).length > 0) {
              expect(res.body).toHaveProperty('test_op');
            }
          });
      });

      it('should accept custom time range', () => {
        return request(app.getHttpServer())
          .get('/health/metrics/operations?timeRange=300000') // 5 minutes
          .expect(200)
          .expect((res) => {
            expect(res.body).toBeTypeOf('object');
          });
      });
    });

    describe('/health/metrics/overview (GET)', () => {
      it('should return system overview', () => {
        return request(app.getHttpServer())
          .get('/health/metrics/overview')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('recentActivity');
            expect(res.body).toHaveProperty('hourlyActivity');
            expect(res.body).toHaveProperty('topOperations');
            expect(res.body).toHaveProperty('slowestOperations');

            // Check activity structure
            expect(res.body.recentActivity).toHaveProperty('operations');
            expect(res.body.recentActivity).toHaveProperty('errors');
            expect(res.body.recentActivity).toHaveProperty('successRate');

            expect(res.body.hourlyActivity).toHaveProperty('operations');
            expect(res.body.hourlyActivity).toHaveProperty('errors');
            expect(res.body.hourlyActivity).toHaveProperty('successRate');

            // Check arrays
            expect(res.body.topOperations).toBeInstanceOf(Array);
            expect(res.body.slowestOperations).toBeInstanceOf(Array);
          });
      });
    });
  },
);
