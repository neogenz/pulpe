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
    const resource = new URL(config.getOrThrow<string>('MCP_RESOURCE_URL'));
    this.#metadata = {
      resource: resource.href,
      authorization_servers: [`${resource.origin}/`],
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
