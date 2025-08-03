/**
 * Base class for value objects following DDD principles
 * Value objects are immutable and compared by their properties
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    // Freeze the props to ensure immutability
    this.props = Object.freeze(props);
  }

  /**
   * Checks equality by comparing all properties
   * Two value objects are equal if all their properties are equal
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (!vo) {
      return false;
    }

    if (this === vo) {
      return true;
    }

    if (this.constructor !== vo.constructor) {
      return false;
    }

    return this.shallowEqual(this.props, vo.props);
  }

  /**
   * Performs shallow equality check on objects
   */
  private shallowEqual(obj1: T, obj2: T): boolean {
    const keys1 = Object.keys(obj1 as any);
    const keys2 = Object.keys(obj2 as any);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if ((obj1 as any)[key] !== (obj2 as any)[key]) {
        return false;
      }
    }

    return true;
  }
}
