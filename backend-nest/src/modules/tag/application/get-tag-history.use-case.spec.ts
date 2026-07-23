import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TagRepositoryPort } from '../domain/ports/tag-repository.port';
import { GetTagHistoryUseCase } from './get-tag-history.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

describe('GetTagHistoryUseCase', () => {
  let repo: TagRepositoryPort;
  let useCase: GetTagHistoryUseCase;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue({ id: 'tag-1' }),
      findHistoryContributions: jest.fn().mockResolvedValue({
        planned: [],
        actual: [],
      }),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as TagRepositoryPort;
    useCase = new GetTagHistoryUseCase(repo, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
    });
  });

  it('builds a chronological multi-year window with zero-filled periods', async () => {
    const result = await useCase.execute(
      'tag-1',
      { months: 3, endMonth: 1, endYear: 2027 },
      user,
    );

    expect(result.periods).toEqual([
      { month: 11, year: 2026, plannedAmount: 0, actualAmount: 0 },
      { month: 12, year: 2026, plannedAmount: 0, actualAmount: 0 },
      { month: 1, year: 2027, plannedAmount: 0, actualAmount: 0 },
    ]);
    expect(repo.findHistoryContributions).toHaveBeenCalledWith(
      'tag-1',
      { month: 11, year: 2026 },
      { month: 1, year: 2027 },
    );
  });

  it('aggregates direct planned and actual contributions with zeros in the average', async () => {
    (
      repo.findHistoryContributions as ReturnType<typeof jest.fn>
    ).mockResolvedValue({
      planned: [
        { month: 5, year: 2026, amount: 100 },
        { month: 5, year: 2026, amount: 50 },
      ],
      actual: [
        { month: 5, year: 2026, amount: 200 },
        { month: 7, year: 2026, amount: 100 },
      ],
    });

    const result = await useCase.execute(
      'tag-1',
      { months: 3, endMonth: 7, endYear: 2026 },
      user,
    );

    expect(result.periods).toEqual([
      { month: 5, year: 2026, plannedAmount: 150, actualAmount: 200 },
      { month: 6, year: 2026, plannedAmount: 0, actualAmount: 0 },
      { month: 7, year: 2026, plannedAmount: 0, actualAmount: 100 },
    ]);
    expect(result.totalPlanned).toBe(150);
    expect(result.totalActual).toBe(300);
    expect(result.monthlyAverageActual).toBe(100);
    expect(result.actualToPlannedPercent).toBe(200);
  });

  it('returns a null ratio when total planned is zero', async () => {
    (
      repo.findHistoryContributions as ReturnType<typeof jest.fn>
    ).mockResolvedValue({
      planned: [],
      actual: [{ month: 7, year: 2026, amount: 50 }],
    });

    const result = await useCase.execute(
      'tag-1',
      { months: 3, endMonth: 7, endYear: 2026 },
      user,
    );

    expect(result.actualToPlannedPercent).toBeNull();
  });

  it('does not read contributions when the tag is missing or foreign', async () => {
    const notFound = new Error('TAG_NOT_FOUND');
    (repo.findById as ReturnType<typeof jest.fn>).mockRejectedValue(notFound);

    await expect(
      useCase.execute(
        'foreign-tag',
        { months: 3, endMonth: 7, endYear: 2026 },
        user,
      ),
    ).rejects.toThrow(notFound);
    expect(repo.findHistoryContributions).not.toHaveBeenCalled();
  });
});
