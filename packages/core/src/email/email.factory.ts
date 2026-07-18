import type { OryCMSEmailProvider, OryCMSResolvedEmailConfig } from "./email.types";
import type { OryCMSEmailConfig, OryCMSEmailProviderId } from "@/config";
import {
  createResendProvider,
  createSmtpProvider,
  createSendgridProvider,
  createSesProvider,
  createMailgunProvider,
  createPostmarkProvider,
  createCustomProvider,
} from "./providers";

const KNOWN_PROVIDERS: OryCMSEmailProviderId[] = [
  "resend",
  "smtp",
  "sendgrid",
  "ses",
  "mailgun",
  "postmark",
  "custom",
];

function isKnownProvider(v: string | undefined): v is OryCMSEmailProviderId {
  return !!v && (KNOWN_PROVIDERS as string[]).includes(v);
}

/**
 * Resolve the effective email config from (in priority order):
 *   1. ORYCMS_EMAIL_PROVIDER / ORYCMS_EMAIL_FROM env vars
 *   2. the `email` block in orycms.config.ts
 * Returns null when no provider is configured → dev mode (return links).
 */
export function resolveOryCMSEmailConfig(
  config?: OryCMSEmailConfig,
): OryCMSResolvedEmailConfig | null {
  const envProvider = process.env.ORYCMS_EMAIL_PROVIDER;
  const provider = isKnownProvider(envProvider) ? envProvider : config?.provider;

  if (!provider) return null;

  const from =
    process.env.ORYCMS_EMAIL_FROM ?? config?.from ?? "OryCMS <no-reply@localhost>";

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
export function getOryCMSEmailProvider(
  config?: OryCMSEmailConfig,
): OryCMSEmailProvider | null {
  const resolved = resolveOryCMSEmailConfig(config);
  if (!resolved) return null;

  const { provider, from, options } = resolved;
  switch (provider) {
    case "resend":
      return createResendProvider(from, options);
    case "smtp":
      return createSmtpProvider(from, options);
    case "sendgrid":
      return createSendgridProvider(from, options);
    case "ses":
      return createSesProvider(from, options);
    case "mailgun":
      return createMailgunProvider(from, options);
    case "postmark":
      return createPostmarkProvider(from, options);
    case "custom":
      return createCustomProvider(options);
    default: {
      // Exhaustiveness guard — unreachable if KNOWN_PROVIDERS matches the union.
      const _never: never = provider;
      throw new Error(`Unknown OryCMS email provider: ${String(_never)}`);
    }
  }
}
