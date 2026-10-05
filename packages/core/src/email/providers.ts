import type { OryCMSEmailMessage, OryCMSEmailProvider } from "./email.types";
import { OryCMSEmailConfigError } from "./email.types";

/**
 * Every provider lazy-loads its SDK via dynamic import(). OryCMS declares NO
 * email SDK as a dependency — the import only runs when a developer selects that
 * provider, and a clear error is thrown if the package isn't installed.
 */

function missingPackage(pkg: string, provider: string): Error {
  return new Error(
    `OryCMS email provider "${provider}" requires the "${pkg}" package. ` +
      `Install it with: npm install ${pkg}`,
  );
}

async function optionalImport<T = unknown>(pkg: string, provider: string): Promise<T> {
  try {
    return (await import(/* webpackIgnore: true */ pkg)) as T;
  } catch {
    throw missingPackage(pkg, provider);
  }
}

type Opts = Record<string, unknown>;
const str = (o: Opts, k: string, env?: string): string | undefined =>
  (o[k] as string | undefined) ?? (env ? process.env[env] : undefined);

/** Reads an option that may be a native number (config) or a string (env var). */
function numOpt(o: Opts, k: string, env?: string): number | undefined {
  const raw = o[k] ?? (env ? process.env[env] : undefined);
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "") return Number(raw);
  return undefined;
}

/** Reads an option that may be a native boolean (config) or a string (env var). */
function boolOpt(o: Opts, k: string, env?: string): boolean | undefined {
  const raw = o[k] ?? (env ? process.env[env] : undefined);
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

// ── SMTP / Nodemailer ──────────────────────────────────────────────────────────
//
// SMTP is the only real email transport OryCMS ships. Resend, SendGrid, SES,
// Mailgun, and Postmark provider implementations were removed here (see
// internal/PROGRESS.md's dated log entry) once nothing else in the repo was
// found to depend on them.

export interface OryCMSSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

interface OryCMSSmtpTransport {
  sendMail: (m: unknown) => Promise<unknown>;
  verify: () => Promise<true>;
}

/**
 * Resolve and validate SMTP config from (in priority order per field) config
 * `email.options` then the matching `SMTP_*` env var. Throws
 * `OryCMSEmailConfigError` for a missing host/from or an invalid port —
 * never for a missing user/password, since anonymous relays are valid.
 */
export function resolveOryCMSSmtpConfig(from: string, opts: Opts): OryCMSSmtpConfig {
  const host = str(opts, "host", "SMTP_HOST");
  if (!host) {
    throw new OryCMSEmailConfigError(
      "OryCMS SMTP: missing host. Set SMTP_HOST, or email.options.host in orycms.config.ts.",
    );
  }

  const resolvedFrom = str(opts, "from", "SMTP_FROM") ?? from;
  if (!resolvedFrom) {
    throw new OryCMSEmailConfigError(
      'OryCMS SMTP: missing "from" address. Set SMTP_FROM, email.from, or email.options.from.',
    );
  }

  const port = numOpt(opts, "port", "SMTP_PORT") ?? 587;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new OryCMSEmailConfigError(
      `OryCMS SMTP: invalid port "${port}" — must be an integer between 1 and 65535.`,
    );
  }

  const secure = boolOpt(opts, "secure", "SMTP_SECURE") ?? port === 465;
  const user = str(opts, "user", "SMTP_USER");
  const password = str(opts, "password", "SMTP_PASSWORD");

  return { host, port, secure, user, password, from: resolvedFrom };
}

/**
 * Strips the SMTP password (when present) out of an error's message before
 * it is thrown or logged — so a transport failure can never leak the
 * credential via `.message`.
 */
function sanitizeSmtpError(err: unknown, password: string | undefined): Error {
  const original = err instanceof Error ? err : new Error(String(err));
  if (!password) return original;
  const sanitized = new Error(original.message.split(password).join("[REDACTED]"));
  sanitized.name = original.name;
  return sanitized;
}

/**
 * SMTP provider via nodemailer. Config is validated eagerly (at provider
 * construction, i.e. when `getOryCMSEmailProvider` is called) so a missing
 * host/from or an invalid port fails loudly immediately, rather than only
 * once a message is actually sent.
 */
export function createSmtpProvider(from: string, opts: Opts): OryCMSEmailProvider {
  const config = resolveOryCMSSmtpConfig(from, opts);

  async function getTransport(): Promise<OryCMSSmtpTransport> {
    const mod = await optionalImport<{
      createTransport: (cfg: unknown) => OryCMSSmtpTransport;
    }>("nodemailer", "smtp");
    return mod.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
  }

  return {
    name: "smtp",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      try {
        const transport = await getTransport();
        await transport.sendMail({
          from: msg.from ?? config.from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        });
      } catch (err) {
        throw sanitizeSmtpError(err, config.password);
      }
    },
    async verify(): Promise<void> {
      try {
        const transport = await getTransport();
        await transport.verify();
      } catch (err) {
        throw sanitizeSmtpError(err, config.password);
      }
    },
  };
}

// ── Custom ─────────────────────────────────────────────────────────────────────

/**
 * Custom provider: the developer supplies their own `send` function via
 * config `email.options.send`. Enables any transport OryCMS doesn't ship.
 */
export function createCustomProvider(opts: Opts): OryCMSEmailProvider {
  const send = opts.send as ((msg: OryCMSEmailMessage) => Promise<void>) | undefined;
  if (typeof send !== "function") {
    throw new Error(
      'OryCMS email "custom": config email.options.send must be an async function (msg) => Promise<void>.',
    );
  }
  return { name: "custom", send };
}
