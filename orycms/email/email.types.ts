import type { OryCMSEmailProviderId } from "@/config";

// ── Message ────────────────────────────────────────────────────────────────────

export interface OryCMSEmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always provided so every provider has a fallback. */
  text: string;
  /** Optional HTML body. */
  html?: string;
  /** Overrides the configured default From address. */
  from?: string;
}

// ── Provider contract ──────────────────────────────────────────────────────────

/**
 * A pluggable email transport. Implementations lazy-load their SDK so OryCMS
 * ships with zero hard email dependencies — the SDK is only required when a
 * developer actually selects that provider.
 */
export interface OryCMSEmailProvider {
  /** Stable id used in logs and config. */
  readonly name: OryCMSEmailProviderId;
  send(message: OryCMSEmailMessage): Promise<void>;
}

// ── Resolved runtime config ────────────────────────────────────────────────────

export interface OryCMSResolvedEmailConfig {
  provider: OryCMSEmailProviderId;
  from: string;
  options: Record<string, unknown>;
}
