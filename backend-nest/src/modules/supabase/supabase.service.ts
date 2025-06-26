import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type AuthenticatedSupabaseClient = SupabaseClient;

@Injectable()
export class SupabaseService {
  #supabaseUrl: string;
  #supabaseAnonKey: string;
  #supabaseServiceKey?: string;
  #baseClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.#supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    this.#supabaseAnonKey =
      this.configService.get<string>('SUPABASE_ANON_KEY')!;
    this.#supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!this.#supabaseUrl || !this.#supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
    }

    this.#baseClient = createClient(this.#supabaseUrl, this.#supabaseAnonKey);
  }

  /**
   * Create an authenticated Supabase client with a user's access token
   */
  createAuthenticatedClient(accessToken: string): AuthenticatedSupabaseClient {
    return createClient(this.#supabaseUrl, this.#supabaseAnonKey, {
      global: {
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

    return createClient(this.#supabaseUrl, this.#supabaseServiceKey);
  }
}
