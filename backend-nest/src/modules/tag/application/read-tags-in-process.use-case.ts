import { Injectable } from '@nestjs/common';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TagReadPort } from '../domain/ports/tag-read.port';
import type { Tag } from '../domain/tag.entity';
import { FindAllTagsUseCase } from './find-all-tags.use-case';

/** Tags, for in-process consumers that have no HTTP request. */
@Injectable()
export class ReadTagsInProcessUseCase implements TagReadPort {
  constructor(
    private readonly findAll: FindAllTagsUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  list(): Promise<Tag[]> {
    return this.findAll.execute(this.session.user);
  }
}
