/**
 * Encrypt seed data for local development.
 *
 * After `supabase db reset`, seed.sql inserts plaintext numeric amounts.
 * This script encrypts them so the app works with PIN "1234".
 *
 * Usage: bun --env-file=.env.local scripts/encrypt-seed-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { createCipheriv, hkdfSync, pbkdf2Sync, randomBytes } from 'node:crypto';

// ── Constants (must match EncryptionService) ──────────────────────────
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const KDF_ITERATIONS = 600_000;

const TEST_USER_ID = '11111111-1111-1111-8111-111111111111';
const TEST_PIN = '1234';
// Fixed salt — deterministic so re-runs produce the same DEK
const SEED_SALT_HEX = 'deadbeefcafebabe1234567890abcdef';

// ── Env ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_MASTER_KEY_HEX = process.env.ENCRYPTION_MASTER_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENCRYPTION_MASTER_KEY_HEX) {
  console.error(
    'Missing env vars. Run with: bun --env-file=.env.local scripts/encrypt-seed-data.ts',
  );
  process.exit(1);
}

// ── Key derivation ────────────────────────────────────────────────────
const salt = Buffer.from(SEED_SALT_HEX, 'hex');
const masterKey = Buffer.from(ENCRYPTION_MASTER_KEY_HEX, 'hex');

// Frontend: clientKey = PBKDF2(PIN, salt, iterations, keyLen, sha256)
const clientKey = pbkdf2Sync(
  TEST_PIN,
  salt,
  KDF_ITERATIONS,
  KEY_LENGTH,
  'sha256',
);

// Backend: DEK = HKDF(clientKey + masterKey, salt, info, keyLen)
const ikm = Buffer.concat([clientKey, masterKey]);
const dek = Buffer.from(
  hkdfSync('sha256', ikm, salt, `pulpe-dek-${TEST_USER_ID}`, KEY_LENGTH),
);
ikm.fill(0);

function encryptAmount(amount: number): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dek, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(amount.toString(), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function isPlaintext(value: string | null): boolean {
  if (!value) return false;
  return /^-?\d+(\.\d+)?$/.test(value);
}

// ── Main ──────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function upsertEncryptionKey(): Promise<void> {
  const keyCheck = encryptAmount(0);
  const { error } = await supabase.from('user_encryption_key').upsert(
    {
      user_id: TEST_USER_ID,
      salt: SEED_SALT_HEX,
      kdf_iterations: KDF_ITERATIONS,
      key_check: keyCheck,
    },
    { onConflict: 'user_id' },
  );
  if (error)
    throw new Error(`Failed to upsert encryption key: ${error.message}`);
  console.log('✓ user_encryption_key upserted');
}

async function encryptTable(
  table: string,
  amountColumn: string,
  filterColumn: string,
  filterValues: string[],
): Promise<number> {
  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${amountColumn}`)
    .in(filterColumn, filterValues);

  if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
  if (!rows?.length) return 0;

  let count = 0;
  for (const row of rows) {
    const rawAmount = row[amountColumn];
    if (!isPlaintext(rawAmount)) continue;

    const encrypted = encryptAmount(parseFloat(rawAmount));
    const { error: updateError } = await supabase
      .from(table)
      .update({ [amountColumn]: encrypted })
      .eq('id', row.id);

    if (updateError) {
      throw new Error(
        `Failed to update ${table} row ${row.id}: ${updateError.message}`,
      );
    }
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  console.log(
    `Encrypting seed data for user ${TEST_USER_ID} with PIN "${TEST_PIN}"...\n`,
  );

  await upsertEncryptionKey();

  // Fetch user's budget IDs and template IDs
  const { data: budgets } = await supabase
    .from('monthly_budget')
    .select('id')
    .eq('user_id', TEST_USER_ID);
  const budgetIds = budgets?.map((b) => b.id) ?? [];

  const { data: templates } = await supabase
    .from('template')
    .select('id')
    .eq('user_id', TEST_USER_ID);
  const templateIds = templates?.map((t) => t.id) ?? [];

  // Encrypt each table sequentially so failure stops immediately
  const budgetLines = await encryptTable(
    'budget_line',
    'amount',
    'budget_id',
    budgetIds,
  );
  const transactions = await encryptTable(
    'transaction',
    'amount',
    'budget_id',
    budgetIds,
  );
  const templateLines = await encryptTable(
    'template_line',
    'amount',
    'template_id',
    templateIds,
  );
  const savingsGoals = await encryptTable(
    'savings_goal',
    'target_amount',
    'user_id',
    [TEST_USER_ID],
  );
  const monthlyBudgets = await encryptTable(
    'monthly_budget',
    'ending_balance',
    'user_id',
    [TEST_USER_ID],
  );

  const totalRows =
    budgetLines + transactions + templateLines + savingsGoals + monthlyBudgets;

  console.log(`\n✓ Encryption complete:`);
  console.log(`  budget_line:     ${budgetLines} rows`);
  console.log(`  transaction:     ${transactions} rows`);
  console.log(`  template_line:   ${templateLines} rows`);
  console.log(`  savings_goal:    ${savingsGoals} rows`);
  console.log(`  monthly_budget:  ${monthlyBudgets} rows`);
  console.log(`\nTotal: ${totalRows} rows encrypted`);
  console.log(`\nLogin with PIN: ${TEST_PIN}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
