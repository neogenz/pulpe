import { Injectable } from '@nestjs/common';
import type { WhatsNewQuery, WhatsNewResponse } from 'pulpe-shared';
import { buildWhatsNewResponse } from '../whats-new-payload';

@Injectable()
export class GetIosWhatsNewUseCase {
  execute(query: WhatsNewQuery): WhatsNewResponse {
    return buildWhatsNewResponse(query);
  }
}
