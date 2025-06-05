import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  createClient,
  type SupabaseClient,
  type User,
  type Session,
} from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);

  private readonly supabaseClient: SupabaseClient;

  private readonly authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  public readonly authState$: Observable<AuthState> =
    this.authStateSubject.asObservable();

  constructor() {
    this.supabaseClient = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
    );

    this.initializeAuthState();
  }

  private async initializeAuthState(): Promise<void> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabaseClient.auth.getSession();

      if (error) {
        console.error('Erreur lors de la récupération de la session:', error);
        this.updateAuthState(null, null);
        return;
      }

      this.updateAuthState(session?.user || null, session);

      // Écouter les changements d'authentification
      this.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event, session);

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            this.updateAuthState(session?.user || null, session);
            break;
          case 'SIGNED_OUT':
            this.updateAuthState(null, null);
            this.router.navigate(['/login']);
            break;
          case 'USER_UPDATED':
            this.updateAuthState(session?.user || null, session);
            break;
        }
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'initialisation de l'authentification:",
        error,
      );
      this.updateAuthState(null, null);
    }
  }

  private updateAuthState(user: User | null, session: Session | null): void {
    this.authStateSubject.next({
      user,
      session,
      isLoading: false,
      isAuthenticated: !!user && !!session,
    });
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword(
        {
          email,
          password,
        },
      );

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Erreur inattendue lors de la connexion',
      };
    }
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: "Erreur inattendue lors de l'inscription",
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabaseClient.auth.signOut();
      if (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    } catch (error) {
      console.error('Erreur inattendue lors de la déconnexion:', error);
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabaseClient.auth.getSession();

      if (error) {
        console.error('Erreur lors de la récupération de la session:', error);
        return null;
      }

      return session;
    } catch (error) {
      console.error(
        'Erreur inattendue lors de la récupération de la session:',
        error,
      );
      return null;
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient.auth.refreshSession();

      if (error) {
        console.error('Erreur lors du rafraîchissement de la session:', error);
        return false;
      }

      return !!data.session;
    } catch (error) {
      console.error(
        'Erreur inattendue lors du rafraîchissement de la session:',
        error,
      );
      return false;
    }
  }

  get currentUser(): User | null {
    return this.authStateSubject.value.user;
  }

  get currentSession(): Session | null {
    return this.authStateSubject.value.session;
  }

  get isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  get isLoading(): boolean {
    return this.authStateSubject.value.isLoading;
  }
}
