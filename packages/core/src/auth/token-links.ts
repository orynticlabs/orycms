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
  /**
   * The raw link — returned ONLY in dev/no-provider mode so setup works without
   * email. Null when a provider sent the email (never leak the link then).
   */
  link: string | null;
}

/**
 * Deliver a token link: email it when a provider is configured, otherwise
 * return the link for the caller to surface in the API response (dev mode).
 * Email send failures degrade gracefully to returning the link.
 */
export async function dispatchOryCMSTokenLink(
  request: Request,
  type: OryCMSTokenType,
  email: string,
  rawToken: string,
): Promise<OryCMSTokenDispatchResult> {
  const link = buildOryCMSTokenLink(request, type, rawToken);
  try {
    const result = await sendOryCMSEmail({
      to: email,
      subject: SUBJECTS[type],
      text: BODY[type](link),
    });
    if (result.sent) return { emailed: true, link: null };
  } catch {
    // Provider misconfigured / down — fall back to returning the link.
  }
  return { emailed: false, link };
}
