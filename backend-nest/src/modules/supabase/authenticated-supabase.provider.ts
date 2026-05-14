import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from './supabase.service';

@Injectable()
export class AuthenticatedSupabaseProvider {
  constructor(private readonly cls: ClsService) {}

  get client(): AuthenticatedSupabaseClient {
    const supabase = this.cls.get('supabase') as
      | AuthenticatedSupabaseClient
      | undefined;
    if (!supabase) {
      throw new BusinessException(
        ERROR_DEFINITIONS.AUTH_UNAUTHORIZED,
        undefined,
        {
          operation: 'cls.getSupabase',
        },
      );
    }
    return supabase;
  }

  get user(): AuthenticatedUser {
    const user = this.cls.get('user') as AuthenticatedUser | undefined;
    if (!user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.AUTH_UNAUTHORIZED,
        undefined,
        {
          operation: 'cls.getUser',
        },
      );
    }
    return user;
  }
}
