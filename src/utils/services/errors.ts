export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super(
      `${resource} not found with id: ${id}`,
      'NOT_FOUND',
      404,
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      details
    );
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(
      message,
      'UNAUTHORIZED',
      401,
      details
    );
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: any) {
    super(
      message,
      'CONFLICT',
      409,
      details
    );
    this.name = 'ConflictError';
  }
}
