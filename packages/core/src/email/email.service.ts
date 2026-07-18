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
 *   (invite/reset/activation) then surface the raw link in the API response so
 *   development works with zero email setup.
 *
 * `emailConfig` can be injected (tests); otherwise it's loaded from config.
 * Provider send failures propagate — callers decide whether to swallow them.
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
export async function isOryCMSEmailConfigured(
  emailConfig?: OryCMSEmailConfig,
): Promise<boolean> {
  const config = emailConfig ?? (await loadEmailConfigSafe());
  return getOryCMSEmailProvider(config) !== null;
}

async function loadEmailConfigSafe(): Promise<OryCMSEmailConfig | undefined> {
  try {
    const config = await loadOryCMSConfig();
    return config.email;
  } catch {
    // Config file may not exist (e.g. tests, first-run) — fall back to env-only.
    return undefined;
  }
}
