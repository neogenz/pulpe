import { randomUUID } from 'crypto';

/**
 * Base class for all domain entities following DDD principles
 * Provides identity, equality comparison, and timestamp tracking
 */
export abstract class BaseEntity<T> {
  protected readonly _id: string;
  protected readonly _createdAt: Date;
  protected _updatedAt: Date;
  protected readonly props: T;

  protected constructor(props: T, id?: string) {
    this._id = id || randomUUID();
    this._createdAt = new Date();
    this._updatedAt = new Date();
    this.props = props;
  }

  get id(): string {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Marks the entity as updated, changing the updatedAt timestamp
   */
  public markAsUpdated(): void {
    this._updatedAt = new Date();
  }

  /**
   * Checks equality based on entity identity (id)
   * Two entities are equal if they have the same id and are of the same type
   */
  public equals(entity?: BaseEntity<T>): boolean {
    if (!entity) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    if (this.constructor !== entity.constructor) {
      return false;
    }

    return this._id === entity._id;
  }
}
