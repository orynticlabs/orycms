import type { NextRequest } from "next/server";
import { getOryCMSPool } from "@/lib/db";
import { findOryCMSUserByEmail } from "@/users";
import { createOryCMSToken } from "@/tokens";
import { dispatchOryCMSTokenLink } from "@/auth/token-links";
import { recordOryCMSAuditLog } from "@/audit";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// POST /api/orycms/auth/forgot-password — public.
// ALWAYS returns 200 regardless of whether the email exists (no user enumeration).
// When the user exists, a reset token is created and emailed / returned.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? "").toLowerCase().trim();

    // Generic success response — identical whether or not the account exists.
    const generic = oryJsonOk({
      message: "If an account exists for that email, a reset link has been sent.",
    });

    if (!email) return generic;

    const pool = getOryCMSPool();
    const user = await findOryCMSUserByEmail(email, pool);
    if (!user) {
      // Record the attempt but reveal nothing to the caller.
      await recordOryCMSAuditLog({
        action: "forgot-password",
        resource: "auth",
        metadata: { email, found: false },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => {});
      return generic;
    }

    const rawToken = await createOryCMSToken({ type: "reset", email, userId: user.id }, pool);
    const dispatch = await dispatchOryCMSTokenLink(request, "reset", email, rawToken);

    await recordOryCMSAuditLog({
      userId: user.id,
      action: "forgot-password",
      resource: "auth",
      resourceId: user.id,
      metadata: { emailed: dispatch.emailed },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    }).catch(() => {});

    // In dev/no-provider mode we DO return the link so the flow is testable.
    // (When a provider is configured, dispatch.link is null.)
    return oryJsonOk({
      message: "If an account exists for that email, a reset link has been sent.",
      resetLink: dispatch.link,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
