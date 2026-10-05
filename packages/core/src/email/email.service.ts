import type { OryCMSEmailMessage } from "./email.types";
import { getOryCMSEmailProvider } from "./email.factory";
import { loadOryCMSConfig } from "@/config";
import type { OryCMSEmailConfig } from "@/config";

export interface OryCMSSendResult {
  /** True when a provider actually sent the message. */
  sent: boolean;
  /** The provider used, or null in dev/no-provider mode. */
  provider: string | null;
}

/**
 * Send an email through the configured provider.
 *
 * - If a provider is configured (via orycms.config.ts email block or
 *   ORYCMS_EMAIL_PROVIDER env), the message is sent and `{ sent: true }` returned.
 * - If NOT configured, this is a no-op returning `{ sent: false }` — callers
 *   (invite/reset/activation) fall back to a console-only dev print (outside
 *   production) or a logged warning (in production); the link is never
 *   returned in an API response either way.
 * - If a provider IS configured but its own config is invalid (e.g. SMTP
 *   with no host), or it throws while sending, the error propagates —
 *   callers decide whether to swallow it, but it is never silently treated
 *   as success.
 *
 * `emailConfig` can be injected (tests); otherwise it's loaded from config.
 */
export async function sendOryCMSEmail(
  message: OryCMSEmailMessage,
  emailConfig?: OryCMSEmailConfig,
): Promise<OryCMSSendResult> {
  const config = emailConfig ?? (await loadEmailConfigSafe());
  const provider = getOryCMSEmailProvider(config);

  if (!provider) {
    return { sent: false, provider: null };
  }

  await provider.send(message);
  return { sent: true, provider: provider.name };
}

/** True when an email provider is configured (send mode), false in dev/link mode. */
export async function isOryCMSEmailConfigured(emailConfig?: OryCMSEmailConfig): Promise<boolean> {
  const config = emailConfig ?? (await loadEmailConfigSafe());
  return getOryCMSEmailProvider(config) !== null;
}

async function loadEmailConfigSafe(): Promise<OryCMSEmailConfig | undefined> {
  try {
    const config = await loadOryCMSConfig();
    return config.email;
  } catch (err) {
    // A missing config file (tests, first-run) is expected and falls back to
    // env-only silently. A config file that EXISTS but fails to load/parse/
    // validate is a real misconfiguration — log it so it's never silent.
    console.error(
      "[orycms] Failed to load orycms.config.ts; email provider config falls back to env-only:",
      err instanceof Error ? err.message : "unknown error",
    );
    return undefined;
  }
}
