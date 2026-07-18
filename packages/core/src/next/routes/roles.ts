import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import {
  listOryCMSRoles,
  createOryCMSRole,
  getOryCMSRole,
  updateOryCMSRole,
  deleteOryCMSRole,
  getOryCMSRolePermissions,
  setOryCMSRolePermissions,
} from "@/roles";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { statusError } from "../http";

const listRoles: OryCMSRoute = {
  method: "GET",
  pattern: "roles",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "roles", "read");
      return oryJsonOk(await listOryCMSRoles());
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const createRole: OryCMSRoute = {
  method: "POST",
  pattern: "roles",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "roles", "create");
      const body = (await request.json()) as { name?: string; description?: string | null };
      if (!body.name) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Role name is required.", 422));
      }
      const role = await createOryCMSRole({ name: body.name, description: body.description });
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "create",
        resource: "roles",
        resourceId: role.id,
        metadata: { name: role.name },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(role, 201);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const getRole: OryCMSRoute = {
  method: "GET",
  pattern: "roles/:id",
  handler: async ({ request, params }) => {
    try {
      await guardOryCMS(request, "roles", "read");
      return oryJsonOk(await getOryCMSRole(params.id));
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const updateRole: OryCMSRoute = {
  method: "PATCH",
  pattern: "roles/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "roles", "update");
      const body = (await request.json()) as { name?: string; description?: string | null };
      const role = await updateOryCMSRole(params.id, body);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "roles",
        resourceId: params.id,
        metadata: { fields: Object.keys(body) },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(role);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const deleteRole: OryCMSRoute = {
  method: "DELETE",
  pattern: "roles/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "roles", "delete");
      await deleteOryCMSRole(params.id);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "delete",
        resource: "roles",
        resourceId: params.id,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk({ id: params.id, deleted: true });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const getRolePermissions: OryCMSRoute = {
  method: "GET",
  pattern: "roles/:id/permissions",
  handler: async ({ request, params }) => {
    try {
      await guardOryCMS(request, "roles", "read");
      return oryJsonOk(await getOryCMSRolePermissions(params.id));
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const setRolePermissions: OryCMSRoute = {
  method: "PUT",
  pattern: "roles/:id/permissions",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "roles", "update");
      const body = (await request.json()) as { permissionIds?: string[] };
      const permissionIds = Array.isArray(body.permissionIds) ? body.permissionIds : [];
      await setOryCMSRolePermissions(params.id, permissionIds);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "roles",
        resourceId: params.id,
        metadata: { permissionCount: permissionIds.length },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk({ roleId: params.id, permissionIds });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

export const roleRoutes: OryCMSRoute[] = [
  listRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
];
