// Core domain building blocks
export { BaseEntity } from './base-entity';
export { ValueObject } from './value-object';
export { Result } from './result';

// Domain exceptions
export {
  DomainException,
  EntityNotFoundException,
  ValidationException,
  BusinessRuleViolationException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from './exceptions/domain.exception';
