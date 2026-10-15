import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const publishOryCMSContentEntry = vi.fn();
const unpublishOryCMSContentEntry = vi.fn();
const recordOryCMSAuditLog = vi.fn();

class OryCMSAuthError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

class OryCMSContentError extends Error {
  code: string;
  statusCode: number;
  field?: string;
  constructor(code: string, message: string, statusCode = 400, field?: string) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.field = field;
  }
}

vi.mock("@/auth", () => ({
  protectOryCMSAdminRoute: (...args: unknown[]) => protectOryCMSAdminRoute(...args),
  OryCMSAuthError,
}));

vi.mock("@/rbac", () => ({
  requireOryCMSPermission: (...args: unknown[]) => requireOryCMSPermission(...args),
}));

vi.mock("@/content", () => ({
  publishOryCMSContentEntry: (...args: unknown[]) => publishOryCMSContentEntry(...args),
  unpublishOryCMSContentEntry: (...args: unknown[]) => unpublishOryCMSContentEntry(...args),
  OryCMSContentError,
}));

vi.mock("@/audit", () => ({
  recordOryCMSAuditLog: (...args: unknown[]) => recordOryCMSAuditLog(...args),
}));

// Import AFTER mocks are registered.
const { POST, DELETE } = await import("../route");

const SESSION = { userId: "u1", roleId: "r1" };

function ctx(id = "e1", collection = "posts") {
  return { params: Promise.resolve({ collection, id }) };
}

function req(method: string, id = "e1"): NextRequest {
  return new NextRequest(`http://localhost/api/orycms/collections/posts/content/${id}/publish`, {
    method,
  });
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  publishOryCMSContentEntry.mockReset();
  unpublishOryCMSContentEntry.mockReset();
  recordOryCMSAuditLog.mockReset();
  recordOryCMSAuditLog.mockResolvedValue(undefined);
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
});

describe("POST /api/orycms/collections/:collection/content/:id/publish", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(401);
    expect(publishOryCMSContentEntry).not.toHaveBeenCalled();
    expect(recordOryCMSAuditLog).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:publish (e.g. an Author)", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "publish");
    expect(publishOryCMSContentEntry).not.toHaveBeenCalled();
    expect(recordOryCMSAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 and records an audit row without the entry's content, on success", async () => {
    publishOryCMSContentEntry.mockResolvedValue({
      id: "e1",
      status: "published",
      data: { title: "secret draft text" },
    });

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(200);
    expect(recordOryCMSAuditLog).toHaveBeenCalledTimes(1);
    const auditCall = recordOryCMSAuditLog.mock.calls[0][0] as Record<string, unknown>;
    expect(auditCall).toMatchObject({
      userId: SESSION.userId,
      action: "publish",
      resource: "content",
      resourceId: "e1",
    });
    expect(JSON.stringify(auditCall)).not.toContain("secret draft text");
  });

  it("maps COLLECTION_NOT_FOUND to a clean 404", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("COLLECTION_NOT_FOUND", 'Collection "posts" is not registered.', 404),
    );

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(404);
  });

  it("maps ENTRY_NOT_FOUND to a clean 404", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ENTRY_NOT_FOUND", 'Entry "e1" not found.', 404),
    );

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(404);
  });

  it("maps ALREADY_PUBLISHED to a clean 409, with no driver text", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ALREADY_PUBLISHED", 'Entry "e1" is already published.', 409),
    );

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ALREADY_PUBLISHED");
    expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\/|ECONNREFUSED|at async/i);
  });

  it("does not record an audit row when the publish itself fails", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ALREADY_PUBLISHED", 'Entry "e1" is already published.', 409),
    );

    await POST(req("POST"), ctx());

    expect(recordOryCMSAuditLog).not.toHaveBeenCalled();
  });

  it("still returns 200 when the audit write itself fails", async () => {
    publishOryCMSContentEntry.mockResolvedValue({ id: "e1", status: "published", data: {} });
    recordOryCMSAuditLog.mockRejectedValue(new Error("audit table unavailable"));

    const res = await POST(req("POST"), ctx());

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/orycms/collections/:collection/content/:id/publish", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await DELETE(req("DELETE"), ctx());

    expect(res.status).toBe(401);
    expect(unpublishOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:publish", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await DELETE(req("DELETE"), ctx());

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "publish");
    expect(unpublishOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 200 and records an audit row on success", async () => {
    unpublishOryCMSContentEntry.mockResolvedValue({ id: "e1", status: "draft", data: {} });

    const res = await DELETE(req("DELETE"), ctx());

    expect(res.status).toBe(200);
    expect(recordOryCMSAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unpublish", resource: "content", resourceId: "e1" }),
    );
  });

  it("maps NOT_PUBLISHED to a clean 409", async () => {
    unpublishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("NOT_PUBLISHED", 'Entry "e1" is not published.', 409),
    );

    const res = await DELETE(req("DELETE"), ctx());

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("maps ENTRY_NOT_FOUND to a clean 404", async () => {
    unpublishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ENTRY_NOT_FOUND", 'Entry "e1" not found.', 404),
    );

    const res = await DELETE(req("DELETE"), ctx());

    expect(res.status).toBe(404);
  });
});
