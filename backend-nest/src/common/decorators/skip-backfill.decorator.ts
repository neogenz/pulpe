import { SetMetadata } from '@nestjs/common';

export const SKIP_BACKFILL = 'skipBackfill';
export const SkipBackfill = () => SetMetadata(SKIP_BACKFILL, true);
