import { Injectable } from '@nestjs/common';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TagWritePort } from '../domain/ports/tag-write.port';
import type { Tag } from '../domain/tag.entity';
import { CreateTagUseCase } from './create-tag.use-case';
import { FindTagUseCase } from './find-tag.use-case';
import { RemoveTagUseCase } from './remove-tag.use-case';
import { UpdateTagUseCase } from './update-tag.use-case';

/** Tag writes, for in-process consumers that have no HTTP request. */
@Injectable()
export class WriteTagsInProcessUseCase implements TagWritePort {
  constructor(
    private readonly createTag: CreateTagUseCase,
    private readonly updateTag: UpdateTagUseCase,
    private readonly findTag: FindTagUseCase,
    private readonly removeTag: RemoveTagUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  create(name: string): Promise<Tag> {
    return this.createTag.execute({ name }, this.session.user);
  }

  rename(id: string, name: string): Promise<Tag> {
    return this.updateTag.execute(id, { name }, this.session.user);
  }

  async remove(id: string): Promise<void> {
    // The repository delete succeeds silently on an unknown id, and the REST
    // route keeps that behavior; an agent must not report a success for nothing.
    await this.findTag.execute(id, this.session.user);
    await this.removeTag.execute(id, this.session.user);
  }
}
