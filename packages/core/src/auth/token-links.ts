import { sendOryCMSEmail } from "@/email";
import type { OryCMSTokenType } from "@/tokens";

// Framework-agnostic: uses the Web platform Request (no next/server dependency).
// NextRequest extends Request, so this works unchanged inside Next route handlers.

// Frontend page paths that consume each token type.
const TOKEN_PATHS: Record<OryCMSTokenType, string> = {
  invite: "/accept-invite",
  activation: "/activate",
  reset: "/reset-password",
};

/** Base URL for building token links: ORYCMS_APP_URL env wins, else request origin. */
export function oryAppOrigin(request: Request): string {
  return process.env.ORYCMS_APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
}

/** Build the absolute link a user clicks to complete a token flow. */
export function buildOryCMSTokenLink(
  request: Request,
  type: OryCMSTokenType,
  rawToken: string,
): string {
  return `${oryAppOrigin(request)}${TOKEN_PATHS[type]}?token=${rawToken}`;
}

const SUBJECTS: Record<OryCMSTokenType, string> = {
  invite: "You've been invited to OryCMS",
  activation: "Activate your OryCMS account",
  reset: "Reset your OryCMS password",
};

const BODY: Record<OryCMSTokenType, (link: string) => string> = {
  invite: (link) => `You've been invited to OryCMS. Set your password to get started:\n\n${link}`,
  activation: (link) => `Activate your OryCMS account by opening this link:\n\n${link}`,
  reset: (link) => `Reset your OryCMS password using this link (expires in 1 hour):\n\n${link}`,
};

export interface OryCMSTokenDispatchResult {
  /** True when the email was sent by a configured provider. */
  emailed: boolean;
}

/**
 * Deliver a token link by email. The link itself is NEVER returned to the
 * caller — it either gets emailed by a configured provider, or (outside
 * production, with no provider configured) printed to the server console so
 * local development works without an email provider. In production, when no
 * provider is configured, or when the configured provider's send() throws,
 * nothing is printed or returned — only a server-side log line, with no link
 * or token in it.
 */
export async function dispatchOryCMSTokenLink(
  request: Request,
  type: OryCMSTokenType,
  email: string,
  rawToken: string,
): Promise<OryCMSTokenDispatchResult> {
  const link = buildOryCMSTokenLink(request, type, rawToken);

  let result: Awaited<ReturnType<typeof sendOryCMSEmail>>;
  try {
    result = await sendOryCMSEmail({
      to: email,
      subject: SUBJECTS[type],
      text: BODY[type](link),
    });
  } catch (err) {
    console.error(
      `[orycms] Failed to send ${type} email:`,
      err instanceof Error ? err.message : "unknown error",
    );
    return { emailed: false };
  }

  if (result.sent) return { emailed: true };

  // No email provider configured.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[orycms] [development only] ${type} link for ${email}: ${link}`);
  } else {
    console.warn(`[orycms] No email provider configured — ${type} email was not sent.`);
  }
  return { emailed: false };
}
