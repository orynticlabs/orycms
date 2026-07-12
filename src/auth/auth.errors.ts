export type OryCMSAuthErrorCode =
  | "SETUP_ALREADY_DONE"
  | "SETUP_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_INACTIVE"
  | "UNAUTHORIZED"
  | "SESSION_EXPIRED"
  | "WEAK_PASSWORD"
  | "FORBIDDEN";

export class OryCMSAuthError extends Error {
  readonly code: OryCMSAuthErrorCode;
  readonly statusCode: number;

  constructor(code: OryCMSAuthErrorCode, message: string, statusCode = 401) {
    super(message);
    this.name = "OryCMSAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
