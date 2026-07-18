import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { createOryCMSUser } from "@/users";
import { createOryCMSToken } from "@/tokens";
import { dispatchOryCMSTokenLink } from "@/auth/token-links";
import { recordOryCMSAuditLog } from "@/audit";

// POST /api/orycms/auth/invite — invite a new user (guarded: users:create)
// Creates a pending account + invite token, then emails/returns the accept link.
export async function POST(request: NextRequest) {
  try {
    const session = await guardOryCMS(request, "users", "create");
    const body = (await request.json()) as { email?: string; roleId?: string | null };
    if (!body.email) {
      return toErrorResponse(
        Object.assign(new Error("Email is required."), { code: "VALIDATION_ERROR", statusCode: 422 }),
      );
    }

    const email = body.email.toLowerCase().trim();
    const user = await createOryCMSUser({ email, roleId: body.roleId ?? null, status: "pending" });
    const rawToken = await createOryCMSToken({
      type: "invite",
      email,
      userId: user.id,
      metadata: { roleId: body.roleId ?? null },
    });

    const dispatch = await dispatchOryCMSTokenLink(request, "invite", email, rawToken);

    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "invite",
      resource: "users",
      resourceId: user.id,
      metadata: { email, emailed: dispatch.emailed },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return oryJsonOk(
      { userId: user.id, email, emailed: dispatch.emailed, inviteLink: dispatch.link },
      201,
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
