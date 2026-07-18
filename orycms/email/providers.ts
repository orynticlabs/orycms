import type { OryCMSEmailMessage, OryCMSEmailProvider } from "./email.types";

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
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return (await import(/* webpackIgnore: true */ pkg)) as T;
  } catch {
    throw missingPackage(pkg, provider);
  }
}

type Opts = Record<string, unknown>;
const str = (o: Opts, k: string, env?: string): string | undefined =>
  (o[k] as string | undefined) ?? (env ? process.env[env] : undefined);

// ── Resend ─────────────────────────────────────────────────────────────────────

export function createResendProvider(from: string, opts: Opts): OryCMSEmailProvider {
  return {
    name: "resend",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      const apiKey = str(opts, "apiKey", "RESEND_API_KEY");
      if (!apiKey) throw new Error('OryCMS email "resend": missing apiKey / RESEND_API_KEY.');
      const mod = await optionalImport<{ Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }>(
        "resend",
        "resend",
      );
      const client = new mod.Resend(apiKey);
      await client.emails.send({
        from: msg.from ?? from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    },
  };
}

// ── SMTP / Nodemailer ──────────────────────────────────────────────────────────

export function createSmtpProvider(from: string, opts: Opts): OryCMSEmailProvider {
  return {
    name: "smtp",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      const mod = await optionalImport<{
        createTransport: (cfg: unknown) => { sendMail: (m: unknown) => Promise<unknown> };
      }>("nodemailer", "smtp");
      const host = str(opts, "host", "SMTP_HOST");
      const port = Number(str(opts, "port", "SMTP_PORT") ?? 587);
      const user = str(opts, "user", "SMTP_USER");
      const pass = str(opts, "pass", "SMTP_PASS");
      if (!host) throw new Error('OryCMS email "smtp": missing host / SMTP_HOST.');
      const transport = mod.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
      });
      await transport.sendMail({
        from: msg.from ?? from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    },
  };
}

// ── SendGrid ───────────────────────────────────────────────────────────────────

export function createSendgridProvider(from: string, opts: Opts): OryCMSEmailProvider {
  return {
    name: "sendgrid",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      const apiKey = str(opts, "apiKey", "SENDGRID_API_KEY");
      if (!apiKey) throw new Error('OryCMS email "sendgrid": missing apiKey / SENDGRID_API_KEY.');
      const mod = await optionalImport<{
        default: { setApiKey: (k: string) => void; send: (m: unknown) => Promise<unknown> };
      }>("@sendgrid/mail", "sendgrid");
      const sg = mod.default;
      sg.setApiKey(apiKey);
      await sg.send({
        from: msg.from ?? from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    },
  };
}

// ── Amazon SES ─────────────────────────────────────────────────────────────────

export function createSesProvider(from: string, opts: Opts): OryCMSEmailProvider {
  return {
    name: "ses",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      const mod = await optionalImport<{
        SESClient: new (cfg: unknown) => { send: (cmd: unknown) => Promise<unknown> };
        SendEmailCommand: new (input: unknown) => unknown;
      }>("@aws-sdk/client-ses", "ses");
      const region = str(opts, "region", "AWS_REGION") ?? "us-east-1";
      const client = new mod.SESClient({ region });
      const cmd = new mod.SendEmailCommand({
        Source: msg.from ?? from,
        Destination: { ToAddresses: [msg.to] },
        Message: {
          Subject: { Data: msg.subject },
          Body: {
            Text: { Data: msg.text },
            ...(msg.html ? { Html: { Data: msg.html } } : {}),
          },
        },
      });
      await client.send(cmd);
    },
  };
}

// ── Mailgun ────────────────────────────────────────────────────────────────────

export function createMailgunProvider(from: string, opts: Opts): OryCMSEmailProvider {
  return {
    name: "mailgun",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      const apiKey = str(opts, "apiKey", "MAILGUN_API_KEY");
      const domain = str(opts, "domain", "MAILGUN_DOMAIN");
      if (!apiKey || !domain)
        throw new Error('OryCMS email "mailgun": missing apiKey / domain (MAILGUN_API_KEY / MAILGUN_DOMAIN).');
      const mod = await optionalImport<{
        default: new (fd: unknown) => { client: (o: unknown) => { messages: { create: (d: string, m: unknown) => Promise<unknown> } } };
      }>("mailgun.js", "mailgun");
      const formData = await optionalImport("form-data", "mailgun");
      const Mailgun = mod.default;
      const mg = new Mailgun((formData as { default: unknown }).default).client({
        username: "api",
        key: apiKey,
      });
      await mg.messages.create(domain, {
        from: msg.from ?? from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    },
  };
}

// ── Postmark ───────────────────────────────────────────────────────────────────

export function createPostmarkProvider(from: string, opts: Opts): OryCMSEmailProvider {
  return {
    name: "postmark",
    async send(msg: OryCMSEmailMessage): Promise<void> {
      const token = str(opts, "serverToken", "POSTMARK_SERVER_TOKEN");
      if (!token) throw new Error('OryCMS email "postmark": missing serverToken / POSTMARK_SERVER_TOKEN.');
      const mod = await optionalImport<{
        ServerClient: new (t: string) => { sendEmail: (m: unknown) => Promise<unknown> };
      }>("postmark", "postmark");
      const client = new mod.ServerClient(token);
      await client.sendEmail({
        From: msg.from ?? from,
        To: msg.to,
        Subject: msg.subject,
        TextBody: msg.text,
        HtmlBody: msg.html,
      });
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
