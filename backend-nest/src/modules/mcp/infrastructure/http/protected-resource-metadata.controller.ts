import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * RFC 9728 protected resource metadata. Lets a client discover the
 * authorization server (Supabase) from a bare 401. Public and static.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller({
  path: '.well-known/oauth-protected-resource',
  version: VERSION_NEUTRAL,
})
export class ProtectedResourceMetadataController {
  readonly #metadata: Record<string, unknown>;

  constructor(config: ConfigService) {
    this.#metadata = {
      resource: config.getOrThrow<string>('MCP_RESOURCE_URL'),
      authorization_servers: [
        `${config.getOrThrow<string>('SUPABASE_URL')}/auth/v1`,
      ],
      bearer_methods_supported: ['header'],
      resource_name: 'Pulpe',
    };
  }

  @Get()
  root() {
    return this.#metadata;
  }

  @Get('mcp')
  forMcp() {
    return this.#metadata;
  }
}
