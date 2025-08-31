export class HttpError extends Error {
  statusCode: number;
  response?: { statusCode: number; headers?: Record<string, string> };
  constructor(statusCode: number, message?: string, headers?: Record<string, string>) {
    super(message ?? `HTTP ${statusCode}`);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.response = { statusCode, headers };
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
