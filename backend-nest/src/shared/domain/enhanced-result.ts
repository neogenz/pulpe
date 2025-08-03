/**
 * Enhanced Result class for handling operation outcomes with Error objects
 * Extends the basic Result pattern with better error handling and convenience methods
 */
export class Result<T = void, E = Error> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _error?: E;
  private readonly _value?: T;

  private constructor(isSuccess: boolean, error?: E, value?: T) {
    if (isSuccess && error) {
      throw new Error(
        'InvalidOperation: A result cannot be successful and contain an error',
      );
    }
    if (!isSuccess && !error) {
      throw new Error(
        'InvalidOperation: A failing result needs to contain an error',
      );
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._error = error;
    this._value = value;

    Object.freeze(this);
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get value from failure result');
    }

    return this._value as T;
  }

  public get error(): E {
    if (this.isSuccess) {
      throw new Error('Cannot get error from success result');
    }

    return this._error as E;
  }

  /**
   * Convenience methods for better readability
   */
  public isOk(): boolean {
    return this.isSuccess;
  }

  public isFail(): boolean {
    return this.isFailure;
  }

  /**
   * Get value method for backward compatibility
   */
  public getValue(): T {
    return this.value;
  }

  /**
   * Get error method for backward compatibility
   */
  public getError(): E {
    return this.error;
  }

  /**
   * Creates a success result
   */
  public static ok<U = void>(value?: U): Result<U, Error> {
    return new Result<U, Error>(true, undefined, value);
  }

  /**
   * Creates a failure result from string (for backward compatibility)
   */
  public static fail<U = void>(error: string): Result<U, Error>;
  /**
   * Creates a failure result from Error object
   */
  public static fail<U = void, E = Error>(error: E): Result<U, E>;
  public static fail<U = void, E = Error>(error: string | E): Result<U, E> {
    const errorObj =
      typeof error === 'string' ? (new Error(error) as unknown as E) : error;
    return new Result<U, E>(false, errorObj);
  }

  /**
   * Combines multiple results into one
   * Returns first failure if any, otherwise success
   */
  public static combine<E = Error>(results: Result<any, E>[]): Result<void, E> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.error);
      }
    }
    return Result.ok();
  }

  /**
   * Maps the value of a successful result
   */
  public map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure) {
      return Result.fail(this.error);
    }
    return Result.ok(fn(this.value));
  }

  /**
   * Maps the error of a failed result
   */
  public mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isSuccess) {
      return Result.ok(this.value) as Result<T, F>;
    }
    return Result.fail(fn(this.error));
  }

  /**
   * Chains another operation that returns a Result
   */
  public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isFailure) {
      return Result.fail(this.error);
    }
    return fn(this.value);
  }

  /**
   * Executes a side effect if the result is successful
   */
  public tap(fn: (value: T) => void): Result<T, E> {
    if (this.isSuccess) {
      fn(this.value);
    }
    return this;
  }

  /**
   * Executes a side effect if the result is a failure
   */
  public tapError(fn: (error: E) => void): Result<T, E> {
    if (this.isFailure) {
      fn(this.error);
    }
    return this;
  }

  /**
   * Converts the Result to a value or throws an error
   */
  public unwrap(): T {
    if (this.isFailure) {
      throw this.error;
    }
    return this.value;
  }

  /**
   * Converts the Result to a value or returns a default
   */
  public unwrapOr(defaultValue: T): T {
    return this.isSuccess ? this.value : defaultValue;
  }

  /**
   * Converts the Result to a value using a function if failed
   */
  public unwrapOrElse(fn: (error: E) => T): T {
    return this.isSuccess ? this.value : fn(this.error);
  }
}
