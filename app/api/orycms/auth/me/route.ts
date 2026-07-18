import type { NextRequest } from "next/server";
import { protectOryCMSAdminRoute } from "@/auth";
import { getOryCMSUserPermissions } from "@/rbac";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// GET /api/orycms/auth/me — current user, role, and flat permission list.
// This is the single source of truth the admin UI uses to gate navigation and actions.
export async function GET(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    const permissions = session.roleName
      ? Array.from(await getOryCMSUserPermissions(session.roleName))
      : [];
    return oryJsonOk({
      user: { id: session.userId, email: session.email },
      roleName: session.roleName,
      permissions,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
