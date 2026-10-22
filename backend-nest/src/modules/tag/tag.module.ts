import { Module } from '@nestjs/common';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { createInfoLoggerProvider } from '@common/logger';
import { TagController } from './infrastructure/http/tag.controller';
import { SupabaseTagRepository } from './infrastructure/persistence/supabase-tag.repository';
import { TagMapper } from './infrastructure/mappers/tag.mapper';
import { TAG_REPOSITORY } from './domain/ports/tag-repository.port';
import { TAG_READ_PORT } from './domain/ports/tag-read.port';
import { TAG_WRITE_PORT } from './domain/ports/tag-write.port';
import { FindAllTagsUseCase } from './application/find-all-tags.use-case';
import { FindTagUseCase } from './application/find-tag.use-case';
import { CreateTagUseCase } from './application/create-tag.use-case';
import { UpdateTagUseCase } from './application/update-tag.use-case';
import { RemoveTagUseCase } from './application/remove-tag.use-case';
import { GetTagHistoryUseCase } from './application/get-tag-history.use-case';
import { ReadTagsInProcessUseCase } from './application/read-tags-in-process.use-case';
import { WriteTagsInProcessUseCase } from './application/write-tags-in-process.use-case';

@Module({
  imports: [SupabaseModule],
  controllers: [TagController],
  providers: [
    FindAllTagsUseCase,
    FindTagUseCase,
    CreateTagUseCase,
    UpdateTagUseCase,
    RemoveTagUseCase,
    GetTagHistoryUseCase,
    ReadTagsInProcessUseCase,
    WriteTagsInProcessUseCase,
    { provide: TAG_READ_PORT, useExisting: ReadTagsInProcessUseCase },
    { provide: TAG_WRITE_PORT, useExisting: WriteTagsInProcessUseCase },
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
    createInfoLoggerProvider(GetTagHistoryUseCase.name),
  ],
  exports: [TAG_READ_PORT, TAG_WRITE_PORT],
})
export class TagModule {}
