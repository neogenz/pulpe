import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { SupabaseClient } from '../../types/supabase-helpers';

// Server-side clients hold no session; auto-refresh would start a 30 s interval
// that is never cleared and keeps every per-request client in memory.
const SERVER_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

export type AuthenticatedSupabaseClient = SupabaseClient;

@Injectable()
export class SupabaseService {
  #supabaseUrl: string;
  #supabaseAnonKey: string;
  #supabaseServiceKey?: string;
  #baseClient: SupabaseClient;
  #global: { fetch?: typeof fetch };

  constructor(private readonly configService: ConfigService) {
    this.#global = this.#simulatedLatencyFetch();
    this.#supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    this.#supabaseAnonKey =
      this.configService.get<string>('SUPABASE_ANON_KEY')!;
    this.#supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!this.#supabaseUrl || !this.#supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
    }

    this.#baseClient = createClient<Database>(
      this.#supabaseUrl,
      this.#supabaseAnonKey,
      { auth: SERVER_AUTH_OPTIONS, global: this.#global },
    );
  }

  /**
   * Dev-only: delays every Supabase call (PostgREST, RPC, Auth) by
   * SUPABASE_SIMULATED_LATENCY_MS so a local run pays the production network
   * round trip. Used by scripts/bench-slow-endpoints.ts; ignored in production.
   */
  #simulatedLatencyFetch(): { fetch?: typeof fetch } {
    const latencyMs =
      process.env.NODE_ENV === 'production'
        ? 0
        : Number(
            this.configService.get<string>('SUPABASE_SIMULATED_LATENCY_MS') ??
              0,
          );
    if (!(latencyMs > 0)) return {};
    return {
      fetch: Object.assign(
        async (...args: Parameters<typeof fetch>) => {
          await sleep(latencyMs);
          return fetch(...args);
        },
        { preconnect: fetch.preconnect },
      ),
    };
  }

  /**
   * Create an authenticated Supabase client with a user's access token
   */
  createAuthenticatedClient(accessToken: string): AuthenticatedSupabaseClient {
    return createClient<Database>(this.#supabaseUrl, this.#supabaseAnonKey, {
      auth: SERVER_AUTH_OPTIONS,
      global: {
        ...this.#global,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  /**
   * Get the base Supabase client (unauthenticated)
   */
  getClient(): SupabaseClient {
    return this.#baseClient;
  }

  /**
   * Get a service role client for admin operations
   */
  getServiceRoleClient(): SupabaseClient {
    if (!this.#supabaseServiceKey) {
      throw new Error('Service role key not configured');
    }

    return createClient<Database>(this.#supabaseUrl, this.#supabaseServiceKey, {
      auth: SERVER_AUTH_OPTIONS,
      global: this.#global,
    });
  }
}
