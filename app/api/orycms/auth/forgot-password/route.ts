import type { NextRequest } from "next/server";
import { getOryCMSPool } from "@/lib/db";
import { findOryCMSUserByEmail } from "@/users";
import { createOryCMSToken } from "@/tokens";
import { dispatchOryCMSTokenLink } from "@/auth/token-links";
import { recordOryCMSAuditLog } from "@/audit";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// POST /api/orycms/auth/forgot-password — public.
// ALWAYS returns 200 with an IDENTICAL body regardless of whether the email
// exists (no user enumeration via status, message, or key presence). Links
// are delivered by email only — never returned in this response, in any
// environment.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? "").toLowerCase().trim();

    // Generic success response — identical whether or not the account exists,
    // and identical regardless of whether a reset link was emailed, printed
    // to the dev console, or neither.
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

    return generic;
  } catch (err) {
    return toErrorResponse(err);
  }
}
