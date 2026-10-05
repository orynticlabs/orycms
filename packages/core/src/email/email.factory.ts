import type { OryCMSEmailProvider, OryCMSResolvedEmailConfig } from "./email.types";
import type { OryCMSEmailConfig, OryCMSEmailProviderId } from "@/config";
import { createSmtpProvider, createCustomProvider } from "./providers";

// SMTP-only cleanup: Resend/SendGrid/SES/Mailgun/Postmark removed — see
// internal/PROGRESS.md's dated log entry for the removal step and the
// "nothing else depends on them" check it was based on.
const KNOWN_PROVIDERS: OryCMSEmailProviderId[] = ["smtp", "custom"];

function isKnownProvider(v: string | undefined): v is OryCMSEmailProviderId {
  return !!v && (KNOWN_PROVIDERS as string[]).includes(v);
}

/**
 * Resolve the effective email config from (in priority order):
 *   1. ORYCMS_EMAIL_PROVIDER / ORYCMS_EMAIL_FROM env vars
 *   2. the `email` block in orycms.config.ts
 * Returns null when no provider is configured — callers then fall back to a
 * console-only dev mode (outside production) or a loud failure (in production).
 */
export function resolveOryCMSEmailConfig(
  config?: OryCMSEmailConfig,
): OryCMSResolvedEmailConfig | null {
  const envProvider = process.env.ORYCMS_EMAIL_PROVIDER;
  const provider = isKnownProvider(envProvider) ? envProvider : config?.provider;

  if (!provider) return null;

  const from = process.env.ORYCMS_EMAIL_FROM ?? config?.from ?? "OryCMS <no-reply@localhost>";

  return {
    provider,
    from,
    options: config?.options ?? {},
  };
}

/**
 * Build the configured email provider, or null when email is unconfigured.
 * Pass the loaded `email` config block; env vars still take precedence.
 */
export function getOryCMSEmailProvider(config?: OryCMSEmailConfig): OryCMSEmailProvider | null {
  const resolved = resolveOryCMSEmailConfig(config);
  if (!resolved) return null;

  const { provider, from, options } = resolved;
  switch (provider) {
    case "smtp":
      return createSmtpProvider(from, options);
    case "custom":
      return createCustomProvider(options);
    default: {
      // Exhaustiveness guard — unreachable if KNOWN_PROVIDERS matches the union.
      const _never: never = provider;
      throw new Error(`Unknown OryCMS email provider: ${String(_never)}`);
    }
  }
}
