import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import {
  listOryCMSUsers,
  getOryCMSUser,
  createOryCMSUser,
  updateOryCMSUser,
  deleteOryCMSUser,
  setOryCMSUserStatus,
} from "../users.repo";
import { OryCMSAuthError } from "@/auth";

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

describe("listOryCMSUsers", () => {
  it("selects users joined with roles", async () => {
    const rows = [{ id: "u1", email: "a@b.co", status: "active", roleId: "r1", roleName: "Admin" }];
    const pool = makePool(() => ({ rows }));
    const users = await listOryCMSUsers(pool);
    expect(users).toEqual(rows);
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain("FROM orycms_users");
    expect(sql).toContain("LEFT JOIN orycms_roles");
  });
});

describe("getOryCMSUser", () => {
  it("returns the user when found", async () => {
    const pool = makePool(() => ({ rows: [{ id: "u1", email: "a@b.co", status: "active", roleId: null }] }));
    expect((await getOryCMSUser("u1", pool)).id).toBe("u1");
  });

  it("throws 404 when not found", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(getOryCMSUser("nope", pool)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("createOryCMSUser", () => {
  it("hashes the password and inserts with given status/role", async () => {
    const pool = makePool((sql) => {
      if (sql.includes("INSERT INTO orycms_users")) {
        return { rows: [{ id: "u9", email: "new@b.co", status: "active", roleId: "r1" }] };
      }
      return { rows: [] };
    });
    const user = await createOryCMSUser(
      { email: "New@B.co", password: "supersecret", status: "active", roleId: "r1" },
      pool,
    );
    expect(user.id).toBe("u9");
    const insertCall = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      (c[0] as string).includes("INSERT INTO orycms_users"),
    )!;
    const params = insertCall[1] as unknown[];
    expect(params[0]).toBe("new@b.co"); // normalized email
    expect(await bcrypt.compare("supersecret", params[1] as string)).toBe(true); // real hash
    expect(params[2]).toBe("active");
  });

  it("rejects a short password with WEAK_PASSWORD", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(createOryCMSUser({ email: "a@b.co", password: "short" }, pool)).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
  });

  it("creates a pending user without a password (invite flow) using a random hash", async () => {
    let insertedHash = "";
    const pool = makePool((sql, params) => {
      if (sql.includes("INSERT INTO orycms_users")) {
        insertedHash = (params as unknown[])[1] as string;
        return { rows: [{ id: "u9", email: "p@b.co", status: "pending", roleId: null }] };
      }
      return { rows: [] };
    });
    const user = await createOryCMSUser({ email: "p@b.co" }, pool);
    expect(user.status).toBe("pending");
    expect(insertedHash).toMatch(/^\$2[aby]\$/); // a real bcrypt hash, not empty
  });
});

describe("updateOryCMSUser", () => {
  it("builds a dynamic SET clause and hashes a new password", async () => {
    const pool = makePool((sql) => {
      if (sql.startsWith("UPDATE orycms_users")) {
        return { rows: [{ id: "u1", email: "a@b.co", status: "inactive", roleId: null }] };
      }
      return { rows: [] };
    });
    await updateOryCMSUser("u1", { status: "inactive", password: "brandnewpass" }, pool);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    const sql = call[0] as string;
    expect(sql).toContain("status =");
    expect(sql).toContain('"passwordHash" =');
  });

  it("no-op update returns the existing user via getOryCMSUser", async () => {
    const pool = makePool(() => ({ rows: [{ id: "u1", email: "a@b.co", status: "active", roleId: null }] }));
    const user = await updateOryCMSUser("u1", {}, pool);
    expect(user.id).toBe("u1");
  });
});

describe("deleteOryCMSUser / setOryCMSUserStatus", () => {
  it("delete issues a DELETE", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await deleteOryCMSUser("u1", pool);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("DELETE FROM orycms_users");
  });

  it("setStatus updates the status column", async () => {
    const pool = makePool((sql) =>
      sql.startsWith("UPDATE orycms_users")
        ? { rows: [{ id: "u1", email: "a@b.co", status: "inactive", roleId: null }] }
        : { rows: [] },
    );
    const user = await setOryCMSUserStatus("u1", "inactive", pool);
    expect(user.status).toBe("inactive");
  });
});
