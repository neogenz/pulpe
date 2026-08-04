/**
 * PUL-329 — retirer d'un objectif d'épargne, sur le vrai Postgres local.
 *
 * La règle de solde vit dans `SavingsGoalWithdrawalPolicyService` et ses tests
 * unitaires ; ce que seule une vraie base prouve, c'est que la révision fait
 * son travail : les montants sont des chiffrés, donc PostgreSQL ne peut pas
 * recalculer un solde pour se défendre — il ne garantit que la contemporanéité
 * de celui que le backend a déchiffré. Deux créations vraiment simultanées ne
 * peuvent donc pas réussir toutes les deux, et c'est un fait de concurrence,
 * pas de mock.
 *
 * Y sont aussi vérifiés les allers-retours que les RPC atomiques rendent
 * indivisibles : créer → éditer → supprimer restitue exactement le stock, le
 * pointage n'y touche jamais, et la suppression de l'objectif laisse un lien
 * cassé toujours éditable.
 *
 * Le chiffrement est stubbé (`enc:N` → N) comme dans les suites voisines : le
 * round-trip crypto vit dans encryption.integration.spec.ts.
 *
 * Se saute proprement si Supabase local est injoignable (et lève seulement sur
 * le run d'intégration dédié, pour qu'il ne passe jamais à vide).
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
  type SupabaseEnv,
} from '@/test/local-supabase';
import type { Database } from '@/types/database.types';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';
import type { InfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetRecalculationPort } from '@modules/budget/domain/ports/budget-recalculation.port';
import type { CacheService } from '@modules/cache/cache.service';
import type { CurrencyService } from '@modules/currency/currency.service';
import type { UserRepositoryPort } from '@modules/user/domain/ports/user-repository.port';
import { SupabaseBudgetTemplateRepository } from '@modules/budget-template/infrastructure/persistence/supabase-budget-template.repository';
import { SupabaseTransactionRepository } from '@modules/transaction/infrastructure/persistence/supabase-transaction.repository';
import { CreateTransactionUseCase } from '@modules/transaction/application/create-transaction.use-case';
import { UpdateTransactionUseCase } from '@modules/transaction/application/update-transaction.use-case';
import { RemoveTransactionUseCase } from '@modules/transaction/application/remove-transaction.use-case';
import { ToggleTransactionCheckUseCase } from '@modules/transaction/application/toggle-transaction-check.use-case';
import { SupabaseSavingsGoalRepository } from './infrastructure/persistence/supabase-savings-goal.repository';
import { SavingsGoalWithdrawalPolicyService } from './application/savings-goal-withdrawal-policy.service';
import { GetSavingsGoalProgressUseCase } from './application/get-savings-goal-progress.use-case';
import { GetSavingsGoalWithdrawalsUseCase } from './application/get-savings-goal-withdrawals.use-case';
import { GetSavingsGoalWithdrawalOptionsUseCase } from './application/get-savings-goal-withdrawal-options.use-case';

const PASSWORD = 'test-password-123';
const CIPHER_PREFIX = 'enc:';

const encrypt = (amount: number): string => `${CIPHER_PREFIX}${amount}`;
const decrypt = (cipher: string | null, fallback: number): number =>
  typeof cipher === 'string' && cipher.startsWith(CIPHER_PREFIX)
    ? Number(cipher.slice(CIPHER_PREFIX.length))
    : fallback;

const encryptionStub = {
  ensureUserDEK: async () => Buffer.alloc(32),
  getDekFor: async () => Buffer.alloc(32),
  getUserDEK: async () => Buffer.alloc(32),
  encryptAmount: (amount: number) => encrypt(amount),
  prepareAmountData: async (amount: number) => ({ amount: encrypt(amount) }),
  encryptOptionalAmount: async (amount: number | null | undefined) =>
    amount == null ? null : encrypt(amount),
  decryptAmount: (cipher: string) => {
    if (!cipher.startsWith(CIPHER_PREFIX)) throw new Error('bad ciphertext');
    return Number(cipher.slice(CIPHER_PREFIX.length));
  },
  tryDecryptAmount: (cipher: string | null, _dek: Buffer, fallback: number) =>
    decrypt(cipher, fallback),
  decryptRowAmountFields: (row: {
    amount: string | null;
    original_amount: string | null;
  }) => ({
    ...row,
    amount: decrypt(row.amount, 0),
    original_amount:
      row.original_amount === null ? null : decrypt(row.original_amount, 0),
  }),
} as unknown as EncryptionPort;

const noopLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  trace: () => {},
} as unknown as InfoLogger;

const cacheStub = {
  invalidateForUser: async () => {},
} as unknown as CacheService;
const recalcStub = { recalculate: async () => {} } as BudgetRecalculationPort;
const currencyStub = {
  overrideExchangeRate: async <T>(dto: T) => dto,
} as unknown as CurrencyService;
const userRepoStub = {
  findSettings: async () => ({
    payDayOfMonth: null,
    currency: 'CHF' as const,
    showCurrencySelector: false,
  }),
} as unknown as UserRepositoryPort;

const period = (() => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
})();

let env: SupabaseEnv | null = null;
let admin: SupabaseClient<Database>;
let userId = '';
let budgetId = '';
let suite: ReturnType<typeof buildSuite>;

function buildSuite(client: SupabaseClient<Database>, id: string) {
  const authUser = {
    id,
    email: 'x@test.local',
    accessToken: 'token',
    clientKey: Buffer.alloc(32),
  } as unknown as AuthenticatedUser;
  const provider = {
    get client() {
      return client as unknown as AuthenticatedSupabaseClient;
    },
    get user() {
      return authUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;

  const goalRepo = new SupabaseSavingsGoalRepository(provider, encryptionStub);
  const txRepo = new SupabaseTransactionRepository(
    provider,
    encryptionStub,
    noopLogger,
  );
  const policy = new SavingsGoalWithdrawalPolicyService(goalRepo);

  return {
    authUser,
    goalRepo,
    create: new CreateTransactionUseCase(
      txRepo,
      cacheStub,
      currencyStub,
      recalcStub,
      policy,
      noopLogger,
    ),
    update: new UpdateTransactionUseCase(
      txRepo,
      cacheStub,
      currencyStub,
      recalcStub,
      policy,
      noopLogger,
    ),
    remove: new RemoveTransactionUseCase(
      txRepo,
      cacheStub,
      recalcStub,
      policy,
      noopLogger,
    ),
    toggle: new ToggleTransactionCheckUseCase(txRepo, cacheStub, noopLogger),
    progress: new GetSavingsGoalProgressUseCase(
      goalRepo,
      new SupabaseBudgetTemplateRepository(
        provider,
        encryptionStub,
        noopLogger,
      ),
      noopLogger,
    ),
    history: new GetSavingsGoalWithdrawalsUseCase(goalRepo),
    options: new GetSavingsGoalWithdrawalOptionsUseCase(goalRepo, userRepoStub),
  };
}

/** Un pot dont le stock initial est le seul apport : `confirmé = initial − retraits`. */
async function seedGoal(name: string, initialAmount: number): Promise<string> {
  const goalId = randomUUID();
  const { error } = await admin.from('savings_goal').insert({
    id: goalId,
    user_id: userId,
    name,
    target_amount: encrypt(50_000),
    target_date: '2099-12-01',
    status: 'ACTIVE',
    initial_amount: encrypt(initialAmount),
  });
  if (error) throw new Error(`seedGoal: ${error.message}`);
  return goalId;
}

function withdraw(goalId: string, amount: number, name = 'Apport travaux') {
  return suite.create.execute(
    {
      budgetId,
      name,
      amount,
      kind: 'income',
      transactionDate: new Date().toISOString(),
      sourceSavingsGoalId: goalId,
    },
    suite.authUser,
  );
}

const confirmedOf = async (goalId: string): Promise<number> =>
  (await suite.progress.execute(goalId, suite.authUser)).computed.confirmed;

beforeAll(async () => {
  const resolved = await ensureSupabaseAvailable().catch((error) => {
    if (IS_DEDICATED_INTEGRATION_RUN) throw error;
    return null;
  });
  if (!resolved) return;
  env = resolved;
  admin = createClient<Database>(env.apiUrl, env.serviceRoleKey);

  const email = `sg-withdrawal-${randomUUID()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  userId = data.user.id;

  const client = createClient<Database>(env.apiUrl, env.anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  const templateId = randomUUID();
  budgetId = randomUUID();
  await admin
    .from('template')
    .insert({ id: templateId, user_id: userId, name: 'T', is_default: true });
  await admin.from('monthly_budget').insert({
    id: budgetId,
    user_id: userId,
    template_id: templateId,
    month: period.month,
    year: period.year,
    description: '',
  });

  suite = buildSuite(client, userId);
});

afterAll(async () => {
  if (!env || !userId) return;
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
});

describe('PUL-329 — savings-goal withdrawals (local Supabase)', () => {
  it('takes the withdrawal out of the stock, and lists it in the history', async () => {
    if (!env) return;
    const goalId = await seedGoal('Maison', 10_000);

    const income = await withdraw(goalId, 4_500);

    expect(income.sourceSavingsGoalId).toBe(goalId);
    // Le nom est un instantané serveur : le client ne l'envoie jamais.
    expect(income.sourceSavingsGoalName).toBe('Maison');
    const { computed } = await suite.progress.execute(goalId, suite.authUser);
    expect(computed.confirmed).toBe(5_500);
    // Une sortie de stock ne dit rien de la capacité mensuelle à remplir le pot.
    expect(computed.confirmedPace).toBe(0);

    const history = await suite.history.execute(goalId);
    expect(history).toEqual([
      {
        transactionId: income.id,
        budgetId,
        name: 'Apport travaux',
        transactionDate: income.transactionDate,
        amount: 4_500,
      },
    ]);
  });

  it('refuses one cent over the balance, and writes nothing', async () => {
    if (!env) return;
    const goalId = await seedGoal('Limite', 1_000);

    const caught = await withdraw(goalId, 1_000.01).catch(
      (error: unknown) => error,
    );

    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE.code,
    );
    expect(await suite.history.execute(goalId)).toEqual([]);
    expect(await confirmedOf(goalId)).toBe(1_000);
  });

  it('lets the whole pot out, then stops offering it as a source', async () => {
    if (!env) return;
    const goalId = await seedGoal('Vidé', 1_000);

    await withdraw(goalId, 1_000);

    expect(await confirmedOf(goalId)).toBe(0);
    const options = await suite.options.execute(suite.authUser);
    expect(options.map((option) => option.goalId)).not.toContain(goalId);
  });

  it('never lets two concurrent withdrawals both take the same money', async () => {
    if (!env) return;
    const goalId = await seedGoal('Concurrence', 1_000);

    const results = await Promise.allSettled([
      withdraw(goalId, 600, 'Retrait A'),
      withdraw(goalId, 600, 'Retrait B'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    // Le perdant repart avec une erreur métier, jamais un 500 de collision.
    const rejected = results.find((result) => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(
      BusinessException,
    );
    expect(await confirmedOf(goalId)).toBe(400);
    expect(await suite.history.execute(goalId)).toHaveLength(1);
  });

  it('gives back exactly what an edit lowers, then the rest on delete', async () => {
    if (!env) return;
    const goalId = await seedGoal('Aller-retour', 10_000);
    const income = await withdraw(goalId, 4_500);

    await suite.update.execute(income.id, { amount: 3_500 }, suite.authUser);
    expect(await confirmedOf(goalId)).toBe(6_500);

    await suite.update.execute(income.id, { amount: 4_000 }, suite.authUser);
    expect(await confirmedOf(goalId)).toBe(6_000);

    await suite.remove.execute(income.id, suite.authUser);
    expect(await confirmedOf(goalId)).toBe(10_000);
    expect(await suite.history.execute(goalId)).toEqual([]);
  });

  it('leaves the stock alone when the income is checked or unchecked', async () => {
    if (!env) return;
    const goalId = await seedGoal('Pointage', 1_000);
    const income = await withdraw(goalId, 400);

    const checked = await suite.toggle.execute(income.id, suite.authUser);
    expect(checked.checkedAt).not.toBeNull();
    expect(await confirmedOf(goalId)).toBe(600);

    await suite.toggle.execute(income.id, suite.authUser);
    expect(await confirmedOf(goalId)).toBe(600);
  });

  it('keeps the income readable and editable once the goal is gone', async () => {
    if (!env) return;
    const goalId = await seedGoal('Supprimé', 1_000);
    const income = await withdraw(goalId, 400, 'Apport vacances');

    // `ON DELETE SET NULL` : la provenance survit à l'objectif sous forme de nom.
    await admin.from('savings_goal').delete().eq('id', goalId);

    const edited = await suite.update.execute(
      income.id,
      { amount: 450 },
      suite.authUser,
    );
    expect(edited.sourceSavingsGoalId).toBeNull();
    expect(edited.sourceSavingsGoalName).toBe('Supprimé');
    expect(edited.amount).toBe(450);
    expect(edited.kind).toBe('income');

    const caught = await suite.update
      .execute(income.id, { kind: 'expense' }, suite.authUser)
      .catch((error: unknown) => error);
    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_TRANSACTION_INVALID.code,
    );

    await suite.remove.execute(income.id, suite.authUser);
  });
});
