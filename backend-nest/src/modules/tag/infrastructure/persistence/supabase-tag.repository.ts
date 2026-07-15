import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TagRepositoryPort } from '../../domain/ports/tag-repository.port';
import type {
  Tag,
  TagCreateInput,
  TagInsert,
  TagRow,
  TagUpdatePatch,
} from '../../domain/tag.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGREST_NO_ROWS = 'PGRST116';

@Injectable()
export class SupabaseTagRepository implements TagRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
  ) {}

  async findAll(): Promise<Tag[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('tag')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_FETCH_FAILED,
        undefined,
        {
          operation: 'listTags',
          entityType: 'tag',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []).map((row) => this.toEntity(row));
  }

  async findById(id: string): Promise<Tag> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('tag')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_NOT_FOUND,
        { id },
        {
          operation: 'getTag',
          entityId: id,
          entityType: 'tag',
          supabaseError: error,
        },
      );
    }

    return this.toEntity(data);
  }

  async insert(input: TagCreateInput): Promise<Tag> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const row: TagInsert = { user_id: user.id, name: input.name };

    const { data, error } = await supabase
      .from('tag')
      .insert(row)
      .select('*')
      .single();

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_ALREADY_EXISTS,
        { name: input.name },
        {
          operation: 'createTag',
          entityType: 'tag',
          userId: user.id,
        },
        { cause: error },
      );
    }

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_CREATE_FAILED,
        undefined,
        {
          operation: 'createTag',
          entityType: 'tag',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    return this.toEntity(data);
  }

  async update(id: string, patch: TagUpdatePatch): Promise<Tag> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const updateRow: Partial<TagInsert> = {};
    if (patch.name !== undefined) updateRow.name = patch.name;

    const { data, error } = await supabase
      .from('tag')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_ALREADY_EXISTS,
        { name: patch.name },
        {
          operation: 'updateTag',
          entityId: id,
          entityType: 'tag',
          userId: user.id,
        },
        { cause: error },
      );
    }

    if (error?.code === POSTGREST_NO_ROWS || (!error && !data)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_NOT_FOUND,
        { id },
        {
          operation: 'updateTag',
          entityId: id,
          entityType: 'tag',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_UPDATE_FAILED,
        { id },
        {
          operation: 'updateTag',
          entityId: id,
          entityType: 'tag',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return this.toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('tag').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_DELETE_FAILED,
        { id },
        {
          operation: 'deleteTag',
          entityId: id,
          entityType: 'tag',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  private toEntity(row: TagRow): Tag {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
