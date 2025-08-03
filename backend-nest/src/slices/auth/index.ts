export { AuthModule } from './auth.module';
// Repository exports are causing issues - import directly from domain/repositories instead
// export { AUTH_REPOSITORY_TOKEN } from './domain/repositories/auth.repository';
// export type { AuthRepository, SignUpData, SignInData } from './domain/repositories/auth.repository';
export { AuthSession } from './domain/entities/auth-session.entity';
export { Session } from './domain/value-objects/session.value-object';
export { AuthToken } from './domain/value-objects/auth-token.value-object';
