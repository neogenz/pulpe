import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { SupabaseService } from '../supabase/supabase.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import type { DemoSessionResponse } from 'pulpe-shared';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service responsible for creating and managing demo user sessions
 *
 * Creates ephemeral users with the Supabase Admin API that:
 * - Have real authentication (JWT tokens)
 * - Get pre-seeded with demo data
 * - Are automatically cleaned up after 24 hours
 * - Use the same RLS policies as regular users
 */
@Injectable()
export class DemoService {
  constructor(
    @InjectInfoLogger(DemoService.name)
    private readonly logger: InfoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly dataGenerator: DemoDataGeneratorService,
  ) {}

  /**
   * Creates a new demo session with an ephemeral user
   *
   * Process:
   * 1. Create a new user via Supabase Admin API
   * 2. Mark user as demo with metadata
   * 3. Generate auth session for the user
   * 4. Seed demo data (templates, budgets, transactions)
   * 5. Return session tokens
   *
   * @returns Demo session with JWT tokens and user info
   */
  async createDemoSession(): Promise<DemoSessionResponse> {
    const startTime = Date.now();

    try {
      const adminClient = this.supabaseService.getServiceRoleClient();
      const { demoEmail, demoPassword } = this.generateDemoCredentials();

      const userId = await this.createDemoUser(
        adminClient,
        demoEmail,
        demoPassword,
      );
      const session = await this.signInDemoUser(
        adminClient,
        demoEmail,
        demoPassword,
        userId,
      );

      await this.seedDemoData(userId, session.access_token, startTime);

      return this.buildDemoSessionResponse(session, userId, demoEmail);
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'create_demo_session',
        },
      );
    }
  }

  private generateDemoCredentials() {
    return {
      demoEmail: `demo-${uuidv4()}@pulpe.app`,
      demoPassword: uuidv4(),
    };
  }

  private async createDemoUser(
    adminClient: SupabaseClient,
    email: string,
    password: string,
  ): Promise<string> {
    this.logger.info(
      { operation: 'create_demo_session', step: 'creating_user', email },
      'Creating demo user',
    );

    const { data: authData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          is_demo: true,
          created_at: new Date().toISOString(),
          name: 'Utilisateur de test',
        },
      });

    if (createError || !authData.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'create_demo_session',
          step: 'create_user',
          supabaseError: createError,
        },
        { cause: createError },
      );
    }

    this.logger.info(
      {
        operation: 'create_demo_session',
        step: 'user_created',
        userId: authData.user.id,
      },
      'Demo user created successfully',
    );

    return authData.user.id;
  }

  private async signInDemoUser(
    adminClient: SupabaseClient,
    email: string,
    password: string,
    userId: string,
  ) {
    const { data: signInData, error: signInError } =
      await adminClient.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.session) {
      await adminClient.auth.admin.deleteUser(userId);
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'create_demo_session',
          step: 'sign_in',
          userId,
          supabaseError: signInError,
        },
        { cause: signInError },
      );
    }

    this.logger.info(
      { operation: 'create_demo_session', step: 'session_created', userId },
      'Demo session created successfully',
    );

    return signInData.session;
  }

  private async seedDemoData(
    userId: string,
    accessToken: string,
    startTime: number,
  ) {
    try {
      await this.dataGenerator.seedDemoData(
        userId,
        this.supabaseService.createAuthenticatedClient(accessToken),
      );

      this.logger.info(
        {
          operation: 'create_demo_session',
          step: 'data_seeded',
          userId,
          duration: Date.now() - startTime,
        },
        'Demo data seeded successfully',
      );
    } catch (seedError) {
      this.logger.warn(
        {
          operation: 'create_demo_session',
          step: 'seed_data_failed',
          userId,
          err: seedError,
        },
        'Failed to seed demo data, but session is valid',
      );
    }
  }

  private buildDemoSessionResponse(
    session: {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
      expires_at?: number;
      user: { created_at: string };
    },
    userId: string,
    email: string,
  ): DemoSessionResponse {
    return {
      success: true,
      data: {
        session: {
          access_token: session.access_token,
          token_type: 'bearer',
          expires_in: session.expires_in ?? 3600,
          expires_at: session.expires_at ?? 0,
          refresh_token: session.refresh_token,
          user: {
            id: userId,
            email,
            created_at: session.user.created_at,
          },
        },
      },
      message: 'Demo session created successfully',
    };
  }
}
