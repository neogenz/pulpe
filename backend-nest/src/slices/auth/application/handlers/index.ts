export * from './sign-up.handler';
export * from './sign-in.handler';
export * from './sign-out.handler';
export * from './refresh-token.handler';
export * from './get-session.handler';
export * from './validate-token.handler';

import { SignUpHandler } from './sign-up.handler';
import { SignInHandler } from './sign-in.handler';
import { SignOutHandler } from './sign-out.handler';
import { RefreshTokenHandler } from './refresh-token.handler';
import { GetSessionHandler } from './get-session.handler';
import { ValidateTokenHandler } from './validate-token.handler';

export const AuthCommandHandlers = [
  SignUpHandler,
  SignInHandler,
  SignOutHandler,
  RefreshTokenHandler,
];

export const AuthQueryHandlers = [GetSessionHandler, ValidateTokenHandler];

export const AuthHandlers = [...AuthCommandHandlers, ...AuthQueryHandlers];
