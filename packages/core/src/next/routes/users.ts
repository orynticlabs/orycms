import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import {
  listOryCMSUsers,
  createOryCMSUser,
  getOryCMSUser,
  updateOryCMSUser,
  deleteOryCMSUser,
} from "@/users";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { statusError } from "../http";

type UserBody = {
  email?: string;
  password?: string;
  roleId?: string | null;
  status?: "active" | "inactive" | "pending";
};

const listUsers: OryCMSRoute = {
  method: "GET",
  pattern: "users",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "users", "read");
      return oryJsonOk(await listOryCMSUsers());
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const createUser: OryCMSRoute = {
  method: "POST",
  pattern: "users",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "users", "create");
      const body = (await request.json()) as UserBody;
      if (!body.email) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Email is required.", 422));
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
  },
};

const getUser: OryCMSRoute = {
  method: "GET",
  pattern: "users/:id",
  handler: async ({ request, params }) => {
    try {
      await guardOryCMS(request, "users", "read");
      return oryJsonOk(await getOryCMSUser(params.id));
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const updateUser: OryCMSRoute = {
  method: "PATCH",
  pattern: "users/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "users", "update");
      const body = (await request.json()) as UserBody;
      const user = await updateOryCMSUser(params.id, body);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "users",
        resourceId: params.id,
        metadata: { fields: Object.keys(body) },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(user);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const deleteUser: OryCMSRoute = {
  method: "DELETE",
  pattern: "users/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "users", "delete");
      await deleteOryCMSUser(params.id);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "delete",
        resource: "users",
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

export const userRoutes: OryCMSRoute[] = [listUsers, createUser, getUser, updateUser, deleteUser];
