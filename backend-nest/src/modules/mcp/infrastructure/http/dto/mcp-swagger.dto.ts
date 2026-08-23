import { createZodDto } from 'nestjs-zod';
import {
  mcpConsentApproveRequestSchema,
  mcpConsentDetailsResponseSchema,
  mcpConsentRedirectResponseSchema,
} from 'pulpe-shared';

export class McpConsentApproveRequestDto extends createZodDto(
  mcpConsentApproveRequestSchema,
) {}
export class McpConsentDetailsResponseDto extends createZodDto(
  mcpConsentDetailsResponseSchema,
) {}
export class McpConsentRedirectResponseDto extends createZodDto(
  mcpConsentRedirectResponseSchema,
) {}
