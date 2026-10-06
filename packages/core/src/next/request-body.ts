import { statusError } from "./http";

/** Parses a JSON object body. Malformed JSON and non-object bodies are 422, not 500. */
export async function readObjectBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw statusError("VALIDATION_ERROR", "Request body must be valid JSON.", 422);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw statusError("VALIDATION_ERROR", "Request body must be a JSON object.", 422);
  }
  return parsed as Record<string, unknown>;
}
