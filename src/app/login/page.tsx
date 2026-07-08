"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AuthStep = "login" | "otp" | "forgot" | "forgot-otp" | "reset";

const trustSignals = [
  {
    icon: ShieldCheck,
    title: "Two-step verification",
    body: "Every privileged session is gated behind device-bound OTP verification.",
  },
  {
    icon: Smartphone,
    title: "Fast operator access",
    body: "Get back into orders, dispatch, and billing with a six-digit mobile code.",
  },
  {
    icon: CheckCircle2,
    title: "Audit-ready sessions",
    body: "Sign-in events and OTP approvals are captured for the workspace security log.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("login");
  const [email, setEmail] = useState("ops@orynticlabs.com");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [otpValue, setOtpValue] = useState("");
  const [resendIn, setResendIn] = useState(28);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isOtpStep = step === "otp" || step === "forgot-otp";

  useEffect(() => {
    if (!isOtpStep || resendIn <= 0) return;

    const timer = window.setTimeout(() => {
      setResendIn((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [isOtpStep, resendIn]);

  const handleContinue = () => {
    setIsSubmitting(true);

    window.setTimeout(() => {
      setStep("otp");
      setIsSubmitting(false);
      setResendIn(28);
    }, 550);
  };

  const handleVerify = () => {
    setIsSubmitting(true);

    window.setTimeout(() => {
      if (step === "forgot-otp") {
        setStep("reset");
        setOtpValue("");
        setIsSubmitting(false);
        return;
      }

      router.push("/");
    }, 550);
  };

  const handleForgotPassword = () => {
    setPassword("");
    setOtpValue("");
    setStep("forgot");
  };

  const handleForgotContinue = () => {
    setIsSubmitting(true);

    window.setTimeout(() => {
      setStep("forgot-otp");
      setIsSubmitting(false);
      setResendIn(28);
    }, 550);
  };

  const handleResetPassword = () => {
    setIsSubmitting(true);

    window.setTimeout(() => {
      setStep("login");
      setIsSubmitting(false);
      setPassword("");
      setResetPassword("");
      setConfirmPassword("");
    }, 550);
  };

  const handleResend = () => {
    setOtpValue("");
    setResendIn(28);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden border-b border-border bg-surface-muted/35">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-35" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent/70 to-transparent" />
        <div className="relative mx-auto grid min-h-screen max-w-[1400px] items-stretch gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex flex-col justify-between px-6 py-8 lg:px-10 lg:py-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[18px] font-semibold tracking-tight">OryCMS</div>
                <div className="text-[12px] text-muted-foreground">
                  by OrynticLabs Private Limited
                </div>
              </div>
              <Badge variant="outline" className="border-border bg-surface px-3 py-1 text-[11px]">
                Secure admin access
              </Badge>
            </div>

            <div className="mt-12 max-w-[560px] lg:mt-0">
              <div className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                Operations workspace
              </div>
              <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight lg:text-[44px]">
                Login to manage orders, inventory, billing, and approvals.
              </h1>
              <p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-muted-foreground">
                This admin console is reserved for verified operators. Continue with your workspace
                credentials, then confirm the OTP sent to your trusted device.
              </p>

              <div className="mt-8 grid gap-3">
                {trustSignals.map((signal) => {
                  const Icon = signal.icon;

                  return (
                    <div
                      key={signal.title}
                      className="flex gap-3 rounded-xl border border-border bg-surface/80 p-4 shadow-xs"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">{signal.title}</div>
                        <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                          {signal.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
              <span>24/7 operator desk</span>
              <span className="h-1 w-1 rounded-full bg-border-strong" />
              <span>Session logs enabled</span>
              <span className="h-1 w-1 rounded-full bg-border-strong" />
              <span>OTP channel: SMS and authenticator</span>
            </div>
          </section>

          <section className="flex items-center border-t border-border bg-background px-6 py-8 lg:border-l lg:border-t-0 lg:px-10">
            <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-6 shadow-[0_20px_60px_-28px_rgba(20,24,31,0.22)] lg:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[22px] font-semibold tracking-tight">
                    {step === "login" && "Welcome back"}
                    {step === "otp" && "Verify OTP"}
                    {step === "forgot" && "Forgot password"}
                    {step === "forgot-otp" && "Verify recovery OTP"}
                    {step === "reset" && "Set new password"}
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted-foreground">
                    {step === "login" && "Use your workspace credentials to continue."}
                    {step === "otp" && `Enter the 6-digit code sent to ${email}.`}
                    {step === "forgot" && "Enter your workspace email to receive a recovery OTP."}
                    {step === "forgot-otp" && `Enter the recovery code sent to ${email}.`}
                    {step === "reset" && "Create a new password for your workspace account."}
                  </div>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-foreground text-background">
                  {step === "login" || step === "forgot" ? (
                    <Lock className="h-4 w-4" />
                  ) : step === "reset" ? (
                    <KeyRound className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    step === "login" || step === "forgot" ? "bg-foreground" : "bg-foreground/30",
                  )}
                />
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    step === "otp" || step === "forgot-otp"
                      ? "bg-foreground"
                      : step === "reset"
                        ? "bg-foreground/60"
                        : "bg-foreground/15",
                  )}
                />
              </div>

              {step === "login" ? (
                <div className="mt-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Work email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-10 pl-10"
                        placeholder="you@orynticlabs.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Password</Label>
                      <button
                        onClick={handleForgotPassword}
                        className="text-[11.5px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-10"
                      placeholder="Enter your password"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
                    <label className="flex items-center gap-2.5">
                      <Checkbox
                        checked={rememberDevice}
                        onCheckedChange={(checked) => setRememberDevice(Boolean(checked))}
                      />
                      <span className="text-[12px] text-foreground">Remember this device</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">30 days</span>
                  </div>

                  <Button
                    className="h-10 w-full"
                    onClick={handleContinue}
                    disabled={!email || !password || isSubmitting}
                  >
                    {isSubmitting ? "Sending OTP..." : "Continue to OTP"}
                  </Button>

                  <Separator />

                  <div className="rounded-lg border border-border bg-surface-muted/35 p-3 text-[11.5px] text-muted-foreground">
                    Admin sign-ins require OTP confirmation for workspace access, order approvals,
                    and billing changes.
                  </div>
                </div>
              ) : step === "forgot" ? (
                <div className="mt-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Recovery email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-10 pl-10"
                        placeholder="you@orynticlabs.com"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-muted/35 p-3 text-[11.5px] text-muted-foreground">
                    We will send a one-time recovery code to your registered device and workspace
                    email.
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => setStep("login")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to login
                    </Button>
                    <Button
                      className="h-10 flex-1"
                      onClick={handleForgotContinue}
                      disabled={!email || isSubmitting}
                    >
                      {isSubmitting ? "Sending OTP..." : "Send recovery OTP"}
                    </Button>
                  </div>
                </div>
              ) : step === "otp" || step === "forgot-otp" ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-lg border border-border bg-surface-muted/40 p-4">
                    <div className="text-[12px] font-medium">Verification code</div>
                    <div className="mt-1 text-[11.5px] text-muted-foreground">
                      {step === "otp"
                        ? "We sent a one-time passcode to your registered device."
                        : "We sent a recovery OTP to your registered device and email."}
                    </div>
                    <div className="mt-4 flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otpValue}
                        onChange={setOtpValue}
                        containerClassName="justify-center"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="h-11 w-11 text-base" />
                          <InputOTPSlot index={1} className="h-11 w-11 text-base" />
                          <InputOTPSlot index={2} className="h-11 w-11 text-base" />
                        </InputOTPGroup>
                        <InputOTPSeparator className="mx-1 text-muted-foreground" />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} className="h-11 w-11 text-base" />
                          <InputOTPSlot index={4} className="h-11 w-11 text-base" />
                          <InputOTPSlot index={5} className="h-11 w-11 text-base" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/35 px-3 py-2.5">
                    <div>
                      <div className="text-[12px] font-medium">Didn’t receive the code?</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Resend or switch to your authenticator app.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resendIn > 0}
                      onClick={handleResend}
                    >
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend"}
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => {
                        setStep(step === "otp" ? "login" : "forgot");
                        setOtpValue("");
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      className="h-10 flex-1"
                      onClick={handleVerify}
                      disabled={otpValue.length !== 6 || isSubmitting}
                    >
                      {isSubmitting ? "Verifying..." : "Verify and login"}
                    </Button>
                  </div>

                  <div className="text-center text-[11.5px] text-muted-foreground">
                    Need help? Contact the workspace owner or security desk.
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="rounded-lg border border-border bg-success/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-success/10 text-success">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[12.5px] font-medium">Recovery verified</div>
                        <div className="mt-1 text-[11.5px] text-muted-foreground">
                          Set a new password for {email}. Use at least 8 characters.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      className="h-10"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-10"
                      placeholder="Re-enter new password"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => setStep("forgot-otp")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      className="h-10 flex-1"
                      onClick={handleResetPassword}
                      disabled={
                        resetPassword.length < 8 ||
                        confirmPassword.length < 8 ||
                        resetPassword !== confirmPassword ||
                        isSubmitting
                      }
                    >
                      {isSubmitting ? "Updating..." : "Reset password"}
                    </Button>
                  </div>

                  <div className="text-center text-[11.5px] text-muted-foreground">
                    After reset, you can continue signing in with your updated password.
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
