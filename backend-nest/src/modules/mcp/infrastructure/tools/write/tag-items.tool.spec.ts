import { describe, expect, it, mock } from 'bun:test';
import { NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetLine } from '@modules/budget-line/domain/budget-line.entity';
import type { SpreadFanOutResult } from '@modules/budget-line/domain/ports/budget-line-spread.port';
import type { BudgetLineWritePort } from '@modules/budget-line/domain/ports/budget-line-write.port';
import type { TagReadPort } from '@modules/tag/domain/ports/tag-read.port';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TransactionWritePort } from '@modules/transaction/domain/ports/transaction-write.port';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';
import { TagItemsTool } from './tag-items.tool';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C] = [uuid(1), uuid(2), uuid(3)];
const MOVEMENT = uuid(101);
const MOVEMENT_2 = uuid(102);
const FORECAST = uuid(201);
const UNKNOWN_TAG = uuid(999);
const TAGS = Array.from({ length: 12 }, (_, i) => ({
  id: uuid(i + 1),
  name: `Tag${i + 1}`,
})) as Tag[];

type Entity = { id: string; name: string; tagIds: string[] };

/** In-memory ports: find reads the store, update writes the new tag set. */
function setup(items: Entity[]) {
  const store = new Map(items.map((e) => [e.id, { ...e }]));
  const find = async (id: string) => {
    const found = store.get(id);
    if (!found) throw new NotFoundException();
    return found;
  };
  const movements = {
    find: mock(find as unknown as TransactionWritePort['find']),
    update: mock((async (id: string, patch: { tagIds: string[] }) => {
      const entity = await find(id);
      entity.tagIds = patch.tagIds;
      return entity;
    }) as unknown as TransactionWritePort['update']),
    remove: mock(async () => {}),
    toggleCheck: mock(async () => ({}) as Transaction),
  } satisfies TransactionWritePort;
  const forecasts = {
    find: mock(find as unknown as BudgetLineWritePort['find']),
    create: mock(async () => ({}) as BudgetLine),
    update: mock((async (id: string, patch: { tagIds: string[] }) => {
      const entity = await find(id);
      entity.tagIds = patch.tagIds;
      return entity;
    }) as unknown as BudgetLineWritePort['update']),
    toggleCheck: mock(async () => ({}) as BudgetLine),
    spread: mock(async () => ({}) as SpreadFanOutResult),
  } satisfies BudgetLineWritePort;
  const tags = { list: mock(async () => TAGS) } satisfies TagReadPort;
  const tool = new TagItemsTool(tags, movements, forecasts);
  return { tool, store, tags, movements, forecasts };
}

describe('TagItemsTool', () => {
  it('should add a tag to a movement and a forecast, dispatching on the target', async () => {
    const { tool, movements, forecasts } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [B] },
      { id: FORECAST, name: 'Loyer', tagIds: [] },
    ]);

    const { text } = await tool.execute({
      items: [
        { target: 'movement', id: MOVEMENT },
        { target: 'forecast', id: FORECAST },
      ],
      addTagIds: [A],
    });

    expect(movements.update).toHaveBeenCalledWith(MOVEMENT, { tagIds: [B, A] });
    // A tags-only patch: the forecast is not flagged as manually adjusted.
    expect(forecasts.update).toHaveBeenCalledWith(FORECAST, {
      id: FORECAST,
      tagIds: [A],
    });
    expect(text).toContain('Tags posés : Tag1');
    expect(text).toContain('Appliqués (2)');
    expect(text).toContain(
      `- [${MOVEMENT}] Mouvement « Migros » · Tags : Tag2, Tag1`,
    );
    expect(text).toContain(`- [${FORECAST}] Prévision « Loyer » · Tags : Tag1`);
  });

  it('should leave the tags it does not mention in place', async () => {
    const { tool, movements } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [A, B] },
    ]);

    await tool.execute({
      items: [{ target: 'movement', id: MOVEMENT }],
      addTagIds: [C],
      removeTagIds: [B],
    });

    expect(movements.update).toHaveBeenCalledWith(MOVEMENT, { tagIds: [A, C] });
  });

  it('should end a tag that is in both lists removed', async () => {
    const { tool, movements } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [A, C] },
    ]);

    await tool.execute({
      items: [{ target: 'movement', id: MOVEMENT }],
      addTagIds: [C],
      removeTagIds: [C],
    });

    expect(movements.update).toHaveBeenCalledWith(MOVEMENT, { tagIds: [A] });
  });

  it('should not write an item that already carries the requested tags', async () => {
    const { tool, movements } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [A, B] },
    ]);

    const { text } = await tool.execute({
      items: [{ target: 'movement', id: MOVEMENT }],
      addTagIds: [A],
      removeTagIds: [C],
    });

    expect(movements.update).not.toHaveBeenCalled();
    expect(text).toContain('Inchangés (1)');
    expect(text).not.toContain('Appliqués');
  });

  it('should report every item unchanged when the same call runs twice', async () => {
    const { tool } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [] },
      { id: FORECAST, name: 'Loyer', tagIds: [B] },
    ]);
    const call = {
      items: [
        { target: 'movement' as const, id: MOVEMENT },
        { target: 'forecast' as const, id: FORECAST },
      ],
      addTagIds: [A],
      removeTagIds: [B],
    };

    await tool.execute(call);
    const { text } = await tool.execute(call);

    expect(text).toContain('Inchangés (2)');
    expect(text).not.toContain('Appliqués');
  });

  it('should list an item that would exceed 10 tags as failed and still apply the next one', async () => {
    const full = TAGS.slice(0, 10).map((t) => t.id);
    const { tool, movements } = setup([
      { id: MOVEMENT, name: 'Chargé', tagIds: full },
      { id: MOVEMENT_2, name: 'Libre', tagIds: [] },
    ]);

    const { text } = await tool.execute({
      items: [
        { target: 'movement', id: MOVEMENT },
        { target: 'movement', id: MOVEMENT_2 },
      ],
      addTagIds: [uuid(11)],
    });

    expect(movements.update).toHaveBeenCalledTimes(1);
    expect(movements.update).toHaveBeenCalledWith(MOVEMENT_2, {
      tagIds: [uuid(11)],
    });
    expect(text).toContain(`- [${MOVEMENT}] Mouvement : dépasserait 10 tags`);
    expect(text).toContain('Appliqués (1)');
  });

  it('should list an unknown item as failed introuvable and apply the others', async () => {
    const { tool } = setup([{ id: MOVEMENT, name: 'Migros', tagIds: [] }]);

    const { text } = await tool.execute({
      items: [
        { target: 'forecast', id: FORECAST },
        { target: 'movement', id: MOVEMENT },
      ],
      addTagIds: [A],
    });

    expect(text).toContain(
      `En échec (1)\n- [${FORECAST}] Prévision : introuvable`,
    );
    expect(text).toContain('Appliqués (1)');
  });

  it('should refuse an unknown tag id before reading or writing anything', async () => {
    const { tool, movements, forecasts } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [] },
    ]);

    const failure = await tool
      .execute({
        items: [{ target: 'movement', id: MOVEMENT }],
        addTagIds: [A, UNKNOWN_TAG],
      })
      .catch((e) => e);

    expect(failure.getStatus()).toBe(400);
    expect(failure.message).toContain(UNKNOWN_TAG);
    expect(movements.find).not.toHaveBeenCalled();
    expect(forecasts.find).not.toHaveBeenCalled();
    expect(movements.update).not.toHaveBeenCalled();
  });

  it('should ask what to do, touching no port, when no tag is given', async () => {
    const { tool, tags, movements } = setup([]);

    const result = await tool.execute({
      items: [{ target: 'movement', id: MOVEMENT }],
      addTagIds: [],
    });

    expect(result.text.startsWith('Information manquante')).toBe(true);
    expect(result.wrote).toBe(false);
    expect(tags.list).not.toHaveBeenCalled();
    expect(movements.find).not.toHaveBeenCalled();
  });

  it('should abort the call on a server failure', async () => {
    const { tool, movements } = setup([
      { id: MOVEMENT, name: 'Migros', tagIds: [] },
    ]);
    const failure = new BusinessException(
      ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
    );
    movements.update.mockRejectedValue(failure);

    await expect(
      tool.execute({
        items: [{ target: 'movement', id: MOVEMENT }],
        addTagIds: [A],
      }),
    ).rejects.toBe(failure);
  });

  it('should be a destructive idempotent read_write tool taking at most 50 items', () => {
    const { tool } = setup([]);
    const input = z.object(tool.inputSchema);
    const items = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        target: 'movement',
        id: uuid(i + 1),
      }));

    expect(tool.name).toBe('tag_items');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(input.safeParse({ items: items(50), addTagIds: [A] }).success).toBe(
      true,
    );
    expect(input.safeParse({ items: items(51), addTagIds: [A] }).success).toBe(
      false,
    );
  });
});
