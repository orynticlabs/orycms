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
  /**
   * Optional: checks the transport/connection is usable without sending a
   * message (e.g. an SMTP provider's `transporter.verify()`). Providers with
   * no meaningful connection check (e.g. "custom") omit this.
   */
  verify?(): Promise<void>;
}

/**
 * Thrown by a provider when its own configuration is missing or invalid
 * (e.g. SMTP with no host, or an out-of-range port) — distinct from a
 * transport/send failure against an otherwise-valid config. Never carries a
 * secret (password, API key) in its message.
 */
export class OryCMSEmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OryCMSEmailConfigError";
  }
}

// ── Resolved runtime config ────────────────────────────────────────────────────

export interface OryCMSResolvedEmailConfig {
  provider: OryCMSEmailProviderId;
  from: string;
  options: Record<string, unknown>;
}
