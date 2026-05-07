import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { DemoSessionResponse } from 'pulpe-shared';
import {
  DEMO_CREDENTIALS_PORT,
  type DemoCredentialsPort,
} from '../domain/ports/demo-credentials.port';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';

@Injectable()
export class CreateDemoSessionUseCase {
  constructor(
    @Inject(DEMO_CREDENTIALS_PORT)
    private readonly creds: DemoCredentialsPort,
    private readonly generateDemoData: GenerateDemoDataUseCase,
    private readonly supabaseService: SupabaseService,
    @InjectInfoLogger(CreateDemoSessionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(): Promise<DemoSessionResponse> {
    const { email, password } = this.creds.generateCredentials();
    const { userId } = await this.creds.createDemoUser(email, password);

    let session: Awaited<
      ReturnType<DemoCredentialsPort['signInDemoUser']>
    >['session'];

    try {
      const result = await this.creds.signInDemoUser(email, password);
      session = result.session;
    } catch (err) {
      await this.creds.deleteUser(userId);
      throw err;
    }

    const supabase = this.supabaseService.createAuthenticatedClient(
      session.access_token,
    );

    try {
      await this.generateDemoData.execute(userId, supabase);
    } catch (err) {
      this.logger.warn(
        {
          userId,
          err: err instanceof Error ? err.message : String(err),
        },
        'Demo seed failed; session still valid',
      );
    }

    return this.buildResponse(session, userId, email);
  }

  private buildResponse(
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
