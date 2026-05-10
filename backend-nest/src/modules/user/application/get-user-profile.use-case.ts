import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { UserProfile } from '../domain/user.entity';

/**
 * `GET /users/me` — returns the profile derived from the JWT-decoded
 * authenticated user. No DB call: the data already lives on the request
 * thanks to `AuthGuard`.
 */
@Injectable()
export class GetUserProfileUseCase {
  execute(user: AuthenticatedUser): UserProfile {
    return {
      id: user.id,
      email: user.email,
      ...(user.firstName && { firstName: user.firstName }),
      ...(user.lastName && { lastName: user.lastName }),
    };
  }
}
