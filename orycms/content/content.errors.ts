export type OryCMSContentErrorCode =
  | "COLLECTION_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "FIELD_UNKNOWN"
  | "FIELD_REQUIRED"
  | "FIELD_INVALID"
  | "WRITE_FORBIDDEN"
  | "ALREADY_PUBLISHED"
  | "NOT_PUBLISHED";

export class OryCMSContentError extends Error {
  readonly code: OryCMSContentErrorCode;
  readonly statusCode: number;
  readonly field?: string;

  constructor(code: OryCMSContentErrorCode, message: string, statusCode = 400, field?: string) {
    super(message);
    this.name = "OryCMSContentError";
    this.code = code;
    this.statusCode = statusCode;
    this.field = field;
  }
}
