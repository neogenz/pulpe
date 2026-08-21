import { Injectable } from '@nestjs/common';
import type { WhatsNewQuery, WhatsNewResponse } from 'pulpe-shared';
import {
  buildWhatsNewResponse,
  type WhatsNewPlatform,
} from '../domain/whats-new-payload';

@Injectable()
export class GetWhatsNewUseCase {
  execute(query: WhatsNewQuery, platform: WhatsNewPlatform): WhatsNewResponse {
    return buildWhatsNewResponse(query, platform);
  }
}
