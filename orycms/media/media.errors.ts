export type OryCMSMediaErrorCode =
  | "MEDIA_NOT_FOUND"
  | "MEDIA_TOO_LARGE"
  | "MEDIA_TYPE_NOT_ALLOWED"
  | "MEDIA_UPLOAD_FAILED"
  | "FOLDER_NOT_FOUND"
  | "FOLDER_NAME_REQUIRED";

export class OryCMSMediaError extends Error {
  readonly code: OryCMSMediaErrorCode;
  readonly statusCode: number;

  constructor(code: OryCMSMediaErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "OryCMSMediaError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
