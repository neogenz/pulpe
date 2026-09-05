import {
  Controller,
  Get,
  VERSION_NEUTRAL,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * RFC 9728 protected resource metadata. Lets a client discover the
 * isolated authorization server from a bare 401. Public and static.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller({
  path: '.well-known/oauth-protected-resource',
  version: VERSION_NEUTRAL,
})
export class ProtectedResourceMetadataController {
  readonly #metadata: Record<string, unknown>;
  readonly #enabled: boolean;

  constructor(config: ConfigService) {
    this.#enabled = !!config.get<string>('MCP_UPSTREAM_CLIENT_ID');
    this.#metadata = {
      resource: config.getOrThrow<string>('MCP_RESOURCE_URL'),
      authorization_servers: [
        `${new URL(config.getOrThrow<string>('MCP_RESOURCE_URL')).origin}/`,
      ],
      bearer_methods_supported: ['header'],
      resource_name: 'Pulpe',
      scopes_supported: ['mcp'],
    };
  }

  @Get()
  root() {
    if (!this.#enabled) throw new NotFoundException();
    return this.#metadata;
  }

  @Get('mcp')
  forMcp() {
    return this.root();
  }
}
