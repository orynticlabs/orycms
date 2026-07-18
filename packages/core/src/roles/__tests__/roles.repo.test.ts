import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  listOryCMSRoles,
  getOryCMSRole,
  createOryCMSRole,
  updateOryCMSRole,
  deleteOryCMSRole,
  getOryCMSRolePermissions,
  setOryCMSRolePermissions,
} from "../roles.repo";

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

describe("listOryCMSRoles / getOryCMSRole", () => {
  it("lists roles ordered by name", async () => {
    const pool = makePool(() => ({ rows: [{ id: "r1", name: "Admin", description: null }] }));
    const roles = await listOryCMSRoles(pool);
    expect(roles[0].name).toBe("Admin");
  });

  it("getOryCMSRole throws 404 when missing", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(getOryCMSRole("nope", pool)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("createOryCMSRole", () => {
  it("inserts a role and returns it", async () => {
    const pool = makePool(() => ({ rows: [{ id: "r9", name: "Support", description: "d" }] }));
    const role = await createOryCMSRole({ name: "Support", description: "d" }, pool);
    expect(role).toEqual({ id: "r9", name: "Support", description: "d" });
  });
});

describe("updateOryCMSRole", () => {
  it("updates and clears the permission cache", async () => {
    const pool = makePool((sql) =>
      sql.startsWith("UPDATE orycms_roles")
        ? { rows: [{ id: "r1", name: "Renamed", description: null }] }
        : { rows: [] },
    );
    const role = await updateOryCMSRole("r1", { name: "Renamed" }, pool);
    expect(role.name).toBe("Renamed");
  });
});

describe("getOryCMSRolePermissions", () => {
  it("joins permissions through the junction table", async () => {
    const rows = [{ id: "p1", name: "users:read", resource: "users", action: "read" }];
    const pool = makePool(() => ({ rows }));
    const perms = await getOryCMSRolePermissions("r1", pool);
    expect(perms).toEqual(rows);
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain("orycms_role_permissions");
  });
});

describe("setOryCMSRolePermissions", () => {
  it("clears existing then inserts each permission id", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await setOryCMSRolePermissions("r1", ["p1", "p2"], pool);
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toContain("DELETE FROM orycms_role_permissions");
    expect(calls.filter((s) => s.includes("INSERT INTO orycms_role_permissions"))).toHaveLength(2);
  });

  it("with an empty list only clears assignments", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await setOryCMSRolePermissions("r1", [], pool);
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("DELETE FROM orycms_role_permissions");
  });
});

describe("deleteOryCMSRole", () => {
  it("issues a DELETE on orycms_roles", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await deleteOryCMSRole("r1", pool);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("DELETE FROM orycms_roles");
  });
});
