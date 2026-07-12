"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Lock, Mail, Shield, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const setupSignals = [
  {
    icon: UserPlus,
    title: "Owner account",
    body: "The first account gets Owner-level access — full control over users, content, and settings.",
  },
  {
    icon: Lock,
    title: "Secure by default",
    body: "Passwords are hashed with bcrypt (cost 12). Only a SHA-256 token hash is stored per session.",
  },
  {
    icon: Shield,
    title: "One-time setup",
    body: "This screen disappears permanently after your Owner account is created.",
  },
  {
    icon: CheckCircle2,
    title: "Instant access",
    body: "Setup signs you in immediately — no email confirmation required to get started.",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/orycms/auth/setup-status")
      .then((r) => r.json())
      .then((data: { success: boolean; data?: { initialized: boolean } }) => {
        if (data.success && data.data?.initialized) router.replace("/login");
      })
      .catch(() => {});
  }, [router]);

  const passwordMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && password === confirm && !isSubmitting;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orycms/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!res.ok || !data.success) {
        setError(data.error?.message ?? "Setup failed. Please try again.");
        setIsSubmitting(false);
        return;
      }
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) handleSubmit();
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Left panel – desktop only ───────────────────────────────── */}
      <aside className="relative hidden overflow-hidden border-r border-border lg:flex lg:w-[52%] lg:flex-col lg:justify-between xl:w-[55%]">
        {/* decorative backgrounds */}
        <div className="absolute inset-0 bg-surface-muted/60" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-accent/60 to-transparent" />

        {/* content */}
        <div className="relative flex flex-1 flex-col justify-between px-10 py-10">
          {/* brand */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[18px] font-semibold tracking-tight">OryCMS</div>
              <div className="text-[12px] text-muted-foreground">
                By OrynticLabs Private Limited
              </div>
            </div>
            <Badge variant="outline" className="border-border bg-surface/80 px-3 py-1 text-[11px]">
              First-time setup
            </Badge>
          </div>

          {/* headline + signals */}
          <div className="max-w-[500px]">
            <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
              Installation
            </p>
            <h1 className="mt-3 text-[36px] font-semibold leading-tight tracking-tight xl:text-[42px]">
              Create your Owner account to unlock OryCMS.
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
              OryCMS requires one Owner account before it can be used. You can invite additional
              operators from Settings later.
            </p>

            <div className="mt-8 grid gap-3">
              {setupSignals.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="flex gap-3 rounded-xl border border-border bg-surface/80 p-4 shadow-xs backdrop-blur-sm"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium">{s.title}</div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {s.body}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* footer */}
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
            <span>One-time setup</span>
            <span className="h-1 w-1 rounded-full bg-border-strong" />
            <span>Owner-level access</span>
            <span className="h-1 w-1 rounded-full bg-border-strong" />
            <span>Invite users later from Settings</span>
          </div>
        </div>
      </aside>

      {/* ── Right panel – form ──────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        {/* mobile brand */}
        <div className="mb-8 text-center lg:hidden">
          <div className="text-[20px] font-semibold tracking-tight">OryCMS</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            by OrynticLabs Private Limited
          </div>
        </div>

        {/* card */}
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-surface p-6 shadow-[0_20px_60px_-20px_rgba(20,24,31,0.18)] lg:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight">Create Owner account</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                This will be the primary administrator.
              </p>
            </div>
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background">
              <KeyRound className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-6 space-y-4" onKeyDown={onKey}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-10"
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                suppressHydrationWarning
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-[12px] text-warning">Use at least 8 characters.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10"
                placeholder="Re-enter password"
                autoComplete="new-password"
                suppressHydrationWarning
              />
              {passwordMismatch && (
                <p className="text-[12px] text-destructive">Passwords do not match.</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                {error}
              </div>
            )}

            <Button className="mt-1 h-10 w-full" onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? "Creating account…" : "Create Owner account"}
            </Button>
          </div>

          <div className="mt-5 text-center text-[12px] text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-medium text-foreground/80 hover:text-foreground"
            >
              Sign in instead
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
