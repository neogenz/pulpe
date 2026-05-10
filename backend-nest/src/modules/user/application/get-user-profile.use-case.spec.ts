import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import { GetUserProfileUseCase } from './get-user-profile.use-case';

describe('GetUserProfileUseCase', () => {
  let useCase: GetUserProfileUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetUserProfileUseCase],
    }).compile();

    useCase = module.get(GetUserProfileUseCase);
  });

  it('returns profile mapped from JWT user without DB call', () => {
    const user = createMockAuthenticatedUser({
      firstName: 'Jane',
      lastName: 'Doe',
    });

    const result = useCase.execute(user);

    expect(result).toEqual({
      id: user.id,
      email: user.email,
      firstName: 'Jane',
      lastName: 'Doe',
    });
  });

  it('omits firstName when missing on the JWT user', () => {
    const user = createMockAuthenticatedUser({
      firstName: undefined,
      lastName: 'Doe',
    });

    const result = useCase.execute(user);

    expect(result.firstName).toBeUndefined();
    expect(result.lastName).toBe('Doe');
  });
});
