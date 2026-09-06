import { createZodDto } from 'nestjs-zod';
import {
  mcpActivityListResponseSchema,
  mcpActivityQuerySchema,
  mcpConnectionListResponseSchema,
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
export class McpConnectionListResponseDto extends createZodDto(
  mcpConnectionListResponseSchema,
) {}
export class McpActivityQueryDto extends createZodDto(mcpActivityQuerySchema) {}
export class McpActivityListResponseDto extends createZodDto(
  mcpActivityListResponseSchema,
) {}
