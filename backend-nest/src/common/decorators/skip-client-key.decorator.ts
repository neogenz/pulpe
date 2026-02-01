import { SetMetadata } from '@nestjs/common';

export const SKIP_CLIENT_KEY = 'skipClientKey';
export const SkipClientKey = () => SetMetadata(SKIP_CLIENT_KEY, true);
