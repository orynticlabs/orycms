// Neutral helper with no imports, so any module (routes, auth, email) can use it
// without creating an import cycle.

/**
 * Removes anything that looks like a connection URL or a password assignment,
 * before a message is written to the server log.
 */
export function redactDetail(text: string): string {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[redacted-url]")
    .replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]");
}
