import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { listOryCMSUsers, createOryCMSUser } from "@/users";
import { recordOryCMSAuditLog } from "@/audit";

// GET /api/orycms/users — list all users
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "users", "read");
    const users = await listOryCMSUsers();
    return oryJsonOk(users);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/users — create a user
export async function POST(request: NextRequest) {
  try {
    const session = await guardOryCMS(request, "users", "create");
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      roleId?: string | null;
      status?: "active" | "inactive" | "pending";
    };
    if (!body.email) {
      return toErrorResponse(
        Object.assign(new Error("Email is required."), { code: "VALIDATION_ERROR", statusCode: 422 }),
      );
    }
    const user = await createOryCMSUser({
      email: body.email,
      password: body.password,
      roleId: body.roleId,
      status: body.status,
    });
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "create",
      resource: "users",
      resourceId: user.id,
      metadata: { email: user.email },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk(user, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
