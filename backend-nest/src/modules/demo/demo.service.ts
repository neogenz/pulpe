import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import type { DemoSessionResponse } from './dto/demo-session-response.dto';
import { v4 as uuidv4 } from 'uuid';

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
    @InjectPinoLogger(DemoService.name)
    private readonly logger: PinoLogger,
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

      // Generate unique demo user email
      const demoEmail = `demo-${uuidv4()}@pulpe.app`;
      const demoPassword = uuidv4(); // Random password (user won't know it)

      this.logger.info(
        {
          operation: 'create_demo_session',
          step: 'creating_user',
          email: demoEmail,
        },
        'Creating demo user',
      );

      // Create the demo user via Admin API
      const { data: authData, error: createError } =
        await adminClient.auth.admin.createUser({
          email: demoEmail,
          password: demoPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            is_demo: true,
            created_at: new Date().toISOString(),
            name: 'Marie Démo',
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

      const userId = authData.user.id;

      this.logger.info(
        {
          operation: 'create_demo_session',
          step: 'user_created',
          userId,
        },
        'Demo user created successfully',
      );

      // Sign in with the password to get a proper session
      const { data: signInData, error: signInError } =
        await adminClient.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });

      if (signInError || !signInData.session) {
        // Clean up the user if sign in fails
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

      const session = signInData.session;

      this.logger.info(
        {
          operation: 'create_demo_session',
          step: 'session_created',
          userId,
        },
        'Demo session created successfully',
      );

      // Seed demo data for this user
      try {
        await this.dataGenerator.seedDemoData(
          userId,
          this.supabaseService.createAuthenticatedClient(session.access_token),
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
        // Log error but don't fail - user can still use the account
        this.logger.error(
          {
            operation: 'create_demo_session',
            step: 'seed_data_failed',
            userId,
            error: seedError,
          },
          'Failed to seed demo data, but session is valid',
        );
      }

      // Return the session
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
              id: authData.user.id,
              email: authData.user.email!,
              created_at: authData.user.created_at,
            },
          },
        },
        message: 'Demo session created successfully',
      };
    } catch (error) {
      this.logger.error(
        {
          operation: 'create_demo_session',
          error,
          duration: Date.now() - startTime,
        },
        'Failed to create demo session',
      );

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
}
