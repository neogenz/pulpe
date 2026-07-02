import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { createInfoLoggerProvider } from '@common/logger';
import { TagController } from './infrastructure/http/tag.controller';
import { SupabaseTagRepository } from './infrastructure/persistence/supabase-tag.repository';
import { TagMapper } from './infrastructure/mappers/tag.mapper';
import { TAG_REPOSITORY } from './domain/ports/tag-repository.port';
import { FindAllTagsUseCase } from './application/find-all-tags.use-case';
import { FindTagUseCase } from './application/find-tag.use-case';
import { CreateTagUseCase } from './application/create-tag.use-case';
import { UpdateTagUseCase } from './application/update-tag.use-case';
import { RemoveTagUseCase } from './application/remove-tag.use-case';

@Module({
  imports: [SupabaseModule],
  controllers: [TagController],
  providers: [
    FindAllTagsUseCase,
    FindTagUseCase,
    CreateTagUseCase,
    UpdateTagUseCase,
    RemoveTagUseCase,
    {
      provide: TAG_REPOSITORY,
      useClass: SupabaseTagRepository,
    },
    TagMapper,
    createInfoLoggerProvider(TagController.name),
    createInfoLoggerProvider(FindAllTagsUseCase.name),
    createInfoLoggerProvider(FindTagUseCase.name),
    createInfoLoggerProvider(CreateTagUseCase.name),
    createInfoLoggerProvider(UpdateTagUseCase.name),
    createInfoLoggerProvider(RemoveTagUseCase.name),
  ],
  exports: [],
})
export class TagModule {}
