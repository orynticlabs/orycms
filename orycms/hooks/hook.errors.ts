export type OryCMSHookErrorCode =
  | "HOOK_FAILED"
  | "HOOK_TIMEOUT"
  | "HOOK_ABORTED"
  | "HOOK_NOT_FOUND"
  | "INVALID_HOOK"
  | "DUPLICATE_HOOK";

export class OryCMSHookError extends Error {
  readonly code: OryCMSHookErrorCode;
  readonly statusCode: number;

  constructor(code: OryCMSHookErrorCode, message: string, statusCode = 500) {
    super(message);
    this.name = "OryCMSHookError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
