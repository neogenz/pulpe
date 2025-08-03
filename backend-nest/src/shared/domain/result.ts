/**
 * Result class for handling operation outcomes
 * Implements the Result pattern for explicit error handling
 */
export class Result<T = void> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _error?: string;
  private readonly _value?: T;

  private constructor(isSuccess: boolean, error?: string, value?: T) {
    if (isSuccess && error) {
      throw new Error(
        'InvalidOperation: A result cannot be successful and contain an error',
      );
    }
    if (!isSuccess && !error) {
      throw new Error(
        'InvalidOperation: A failing result needs to contain an error message',
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

  public get error(): string {
    if (this.isSuccess) {
      throw new Error('Cannot get error from success result');
    }

    return this._error as string;
  }

  /**
   * Creates a success result
   */
  public static ok<U = void>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  /**
   * Creates a failure result from string
   */
  public static fail<U = void>(error: string): Result<U>;
  /**
   * Creates a failure result from Error object
   */
  public static fail<U = void>(error: Error): Result<U>;
  public static fail<U = void>(error: string | Error): Result<U> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    return new Result<U>(false, errorMessage);
  }

  /**
   * Combines multiple results into one
   * Returns first failure if any, otherwise success
   */
  public static combine(results: Result<any>[]): Result<void> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.error);
      }
    }
    return Result.ok();
  }

  /**
   * Alias for isSuccess for backward compatibility
   */
  public isOk(): boolean {
    return this.isSuccess;
  }

  /**
   * Alias for isFailure for backward compatibility
   */
  public isFail(): boolean {
    return this.isFailure;
  }

  /**
   * Get the error as an Error object
   */
  public getError(): Error {
    if (this.isSuccess) {
      throw new Error('Cannot get error from success result');
    }
    return new Error(this._error);
  }
}
