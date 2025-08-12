export interface ApplicationConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  backend: {
    apiUrl: string;
  };
  environment: 'development' | 'production' | 'local';
}

export type ConfigFile = Record<string, unknown>;
