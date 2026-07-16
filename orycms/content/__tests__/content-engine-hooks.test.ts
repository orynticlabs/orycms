import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  createOryCMSContentEntry,
  updateOryCMSContentEntry,
  deleteOryCMSContentEntry,
  publishOryCMSContentEntry,
} from "../content.engine";
import { registerGlobalOryCMSHook, clearOryCMSHookRegistry } from "@/hooks";
import type { OryCMSHookContext } from "@/hooks";
import { registerOryCMSCollection, clearOryCMSRegistry } from "@/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = "2024-01-01T00:00:00.000Z";

function row(overrides: Record<string, unknown> = {}) {
  return { id: "1", title: "Test", createdAt: NOW, updatedAt: NOW, ...overrides };
}

function makePool(impl: (sql: string, params?: unknown[]) => unknown): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}

function singleRow(r = row()) {
  return makePool(() => ({ rows: [r] }));
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSRegistry();
  clearOryCMSHookRegistry();
  registerOryCMSCollection({
    name: "Posts",
    slug: "posts",
    tableName: "posts",
    labels: { singular: "Post", plural: "Posts" },
    fields: [{ name: "title", type: "text", required: true }],
  });
  registerOryCMSCollection({
    name: "Articles",
    slug: "articles",
    tableName: "articles",
    labels: { singular: "Article", plural: "Articles" },
    fields: [{ name: "title", type: "text", required: true }],
    draft: { enabled: true },
  });
});

afterEach(() => {
  clearOryCMSRegistry();
  clearOryCMSHookRegistry();
});

// ── Execution order ───────────────────────────────────────────────────────────

describe("Execution order", () => {
  it("create: beforeCreate → DB write → afterCreate", async () => {
    const order: string[] = [];
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        order.push("before");
      },
      { id: "b" },
    );
    registerGlobalOryCMSHook(
      "afterCreate",
      () => {
        order.push("after");
      },
      { id: "a" },
    );

    const pool = makePool(() => {
      order.push("db");
      return { rows: [row()] };
    });
    await createOryCMSContentEntry("posts", { data: { title: "T" } }, pool);

    expect(order).toEqual(["before", "db", "after"]);
  });

  it("update: beforeUpdate → DB write → afterUpdate", async () => {
    const order: string[] = [];
    registerGlobalOryCMSHook(
      "beforeUpdate",
      () => {
        order.push("before");
      },
      { id: "b" },
    );
    registerGlobalOryCMSHook(
      "afterUpdate",
      () => {
        order.push("after");
      },
      { id: "a" },
    );

    const call = 0;
    const pool = makePool(() => {
      order.push("db");
      return { rows: [row()] };
    });
    await updateOryCMSContentEntry("posts", "1", { data: { title: "U" } }, pool);

    expect(order[0]).toBe("db"); // GET existing
    expect(order[1]).toBe("before");
    expect(order[2]).toBe("db"); // UPDATE
    expect(order[3]).toBe("after");
  });

  it("delete: beforeDelete → DB write → afterDelete", async () => {
    const order: string[] = [];
    registerGlobalOryCMSHook(
      "beforeDelete",
      () => {
        order.push("before");
      },
      { id: "b" },
    );
    registerGlobalOryCMSHook(
      "afterDelete",
      () => {
        order.push("after");
      },
      { id: "a" },
    );

    const call = 0;
    const pool = makePool(() => {
      order.push("db");
      return { rows: [row()] };
    });
    await deleteOryCMSContentEntry("posts", "1", pool);

    expect(order[0]).toBe("db"); // GET existing
    expect(order[1]).toBe("before");
    expect(order[2]).toBe("db"); // DELETE
    expect(order[3]).toBe("after");
  });

  it("publish: beforePublish → DB write → afterPublish", async () => {
    const order: string[] = [];
    registerGlobalOryCMSHook(
      "beforePublish",
      () => {
        order.push("before");
      },
      { id: "b" },
    );
    registerGlobalOryCMSHook(
      "afterPublish",
      () => {
        order.push("after");
      },
      { id: "a" },
    );

    let call = 0;
    const pool = makePool(() => {
      call++;
      order.push("db");
      if (call === 1) return { rows: [{ ...row(), _isDraft: true }] };
      return { rows: [{ ...row(), _isDraft: false, _publishedAt: NOW }] };
    });
    await publishOryCMSContentEntry("articles", "1", pool);

    expect(order[1]).toBe("before");
    expect(order[2]).toBe("db");
    expect(order[3]).toBe("after");
  });
});

// ── Data mutation ─────────────────────────────────────────────────────────────

describe("Data mutation", () => {
  it("beforeCreate mutation is persisted to DB", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      (ctx: OryCMSHookContext) => {
        ctx.data["injected"] = "by-hook";
      },
      { id: "mutate" },
    );

    let capturedSql = "";
    let capturedParams: unknown[] = [];
    const pool = makePool((sql: string, params?: unknown[]) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return { rows: [row()] };
    });

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, pool);

    expect(capturedSql).toContain('"injected"');
    expect(capturedParams).toContain("by-hook");
  });

  it("beforeCreate hook can overwrite existing fields", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      (ctx: OryCMSHookContext) => {
        ctx.data["title"] = "overwritten";
      },
      { id: "overwrite" },
    );

    let capturedParams: unknown[] = [];
    const pool = makePool((_sql: string, params?: unknown[]) => {
      capturedParams = params ?? [];
      return { rows: [row()] };
    });

    await createOryCMSContentEntry("posts", { data: { title: "original" } }, pool);
    expect(capturedParams).toContain("overwritten");
    expect(capturedParams).not.toContain("original");
  });

  it("beforeUpdate mutation is persisted to DB", async () => {
    registerGlobalOryCMSHook(
      "beforeUpdate",
      (ctx: OryCMSHookContext) => {
        ctx.data["slug"] = "auto-slug";
      },
      { id: "mutate-update" },
    );

    let updateSql = "";
    let updateParams: unknown[] = [];
    let call = 0;
    const pool = makePool((sql: string, params?: unknown[]) => {
      call++;
      if (call === 2) {
        updateSql = sql;
        updateParams = params ?? [];
      }
      return { rows: [row()] };
    });

    await updateOryCMSContentEntry("posts", "1", { data: { title: "U" } }, pool);

    expect(updateSql).toContain('"slug"');
    expect(updateParams).toContain("auto-slug");
  });

  it("context passed to beforeCreate references correct collection and operation", async () => {
    let captured: OryCMSHookContext | null = null;
    registerGlobalOryCMSHook(
      "beforeCreate",
      (ctx: OryCMSHookContext) => {
        captured = ctx;
      },
      { id: "capture" },
    );

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, singleRow());

    expect(captured).not.toBeNull();
    expect(captured!.collection).toBe("posts");
    expect(captured!.operation).toBe("beforeCreate");
    expect(captured!.previous).toBeNull();
  });

  it("beforeUpdate context includes previous entry", async () => {
    let capturedPrev: unknown = undefined;
    registerGlobalOryCMSHook(
      "beforeUpdate",
      (ctx: OryCMSHookContext) => {
        capturedPrev = ctx.previous;
      },
      { id: "prev-check" },
    );

    const pool = makePool(() => ({ rows: [row({ title: "Old" })] }));
    await updateOryCMSContentEntry("posts", "1", { data: { title: "New" } }, pool);

    expect(capturedPrev).not.toBeNull();
  });
});

// ── Async hooks ───────────────────────────────────────────────────────────────

describe("Async hooks", () => {
  it("async beforeCreate completes before DB write", async () => {
    let hookDone = false;
    registerGlobalOryCMSHook(
      "beforeCreate",
      async () => {
        await new Promise<void>((r) => setTimeout(r, 10));
        hookDone = true;
      },
      { id: "async-before" },
    );

    let dbCalledAfterHook = false;
    const pool = makePool(() => {
      dbCalledAfterHook = hookDone;
      return { rows: [row()] };
    });

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, pool);
    expect(dbCalledAfterHook).toBe(true);
  });

  it("async afterCreate completes before function returns", async () => {
    const log: string[] = [];
    registerGlobalOryCMSHook(
      "afterCreate",
      async () => {
        await new Promise<void>((r) => setTimeout(r, 10));
        log.push("after-done");
      },
      { id: "async-after" },
    );

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, singleRow());
    expect(log).toContain("after-done");
  });

  it("async mutation: data mutated asynchronously is still persisted", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      async (ctx: OryCMSHookContext) => {
        await new Promise<void>((r) => setTimeout(r, 5));
        ctx.data["async_field"] = "async-value";
      },
      { id: "async-mutate" },
    );

    let capturedParams: unknown[] = [];
    const pool = makePool((_sql: string, params?: unknown[]) => {
      capturedParams = params ?? [];
      return { rows: [row()] };
    });

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, pool);
    expect(capturedParams).toContain("async-value");
  });
});

// ── Aborted operations ────────────────────────────────────────────────────────

describe("Aborted operations", () => {
  it("beforeCreate cancel prevents DB write", async () => {
    registerGlobalOryCMSHook("beforeCreate", () => ({ cancel: true as const, reason: "Blocked" }), {
      id: "cancel-create",
    });

    const pool = makePool(() => ({ rows: [] }));
    await expect(
      createOryCMSContentEntry("posts", { data: { title: "T" } }, pool),
    ).rejects.toMatchObject({ code: "HOOK_ABORTED", statusCode: 422 });
    expect(pool.query as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("beforeUpdate cancel prevents DB write (GET still runs)", async () => {
    registerGlobalOryCMSHook("beforeUpdate", () => ({ cancel: true as const, reason: "Blocked" }), {
      id: "cancel-update",
    });

    let calls = 0;
    const pool = makePool(() => {
      calls++;
      return { rows: [row()] };
    });
    await expect(
      updateOryCMSContentEntry("posts", "1", { data: { title: "U" } }, pool),
    ).rejects.toMatchObject({ code: "HOOK_ABORTED" });
    expect(calls).toBe(1); // only the GET, not the UPDATE
  });

  it("beforeDelete cancel prevents DB delete (GET still runs)", async () => {
    registerGlobalOryCMSHook("beforeDelete", () => ({ cancel: true as const, reason: "Blocked" }), {
      id: "cancel-delete",
    });

    let calls = 0;
    const pool = makePool(() => {
      calls++;
      return { rows: [row()] };
    });
    await expect(deleteOryCMSContentEntry("posts", "1", pool)).rejects.toMatchObject({
      code: "HOOK_ABORTED",
    });
    expect(calls).toBe(1);
  });

  it("beforePublish cancel prevents DB publish (GET still runs)", async () => {
    registerGlobalOryCMSHook(
      "beforePublish",
      () => ({ cancel: true as const, reason: "Blocked" }),
      { id: "cancel-publish" },
    );

    let calls = 0;
    const pool = makePool(() => {
      calls++;
      return { rows: [{ ...row(), _isDraft: true }] };
    });
    await expect(publishOryCMSContentEntry("articles", "1", pool)).rejects.toMatchObject({
      code: "HOOK_ABORTED",
    });
    expect(calls).toBe(1);
  });

  it("abort reason is exposed in the thrown error", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => ({ cancel: true as const, reason: "Content policy violation" }),
      { id: "policy-hook" },
    );

    await expect(
      createOryCMSContentEntry("posts", { data: { title: "T" } }, singleRow()),
    ).rejects.toMatchObject({ message: "Content policy violation" });
  });

  it("hook throwing (non-cancel) also aborts the operation", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        throw new Error("Validation failed");
      },
      { id: "throw-hook" },
    );

    const pool = makePool(() => ({ rows: [] }));
    await expect(
      createOryCMSContentEntry("posts", { data: { title: "T" } }, pool),
    ).rejects.toMatchObject({ code: "HOOK_FAILED" });
    expect(pool.query as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});

// ── After-hook failures ───────────────────────────────────────────────────────

describe("After-hook failures", () => {
  it("afterCreate failure does not corrupt the returned entry", async () => {
    registerGlobalOryCMSHook(
      "afterCreate",
      () => {
        throw new Error("Notification service down");
      },
      { id: "after-fail-create" },
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const entry = await createOryCMSContentEntry("posts", { data: { title: "T" } }, singleRow());
    expect(entry.id).toBe("1");
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("afterCreate"), expect.any(Error));
    errSpy.mockRestore();
  });

  it("afterUpdate failure does not corrupt the returned entry", async () => {
    registerGlobalOryCMSHook(
      "afterUpdate",
      () => {
        throw new Error("Cache invalidation failed");
      },
      { id: "after-fail-update" },
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = makePool(() => ({ rows: [row()] }));
    const entry = await updateOryCMSContentEntry("posts", "1", { data: { title: "U" } }, pool);
    expect(entry.id).toBe("1");
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("afterUpdate"), expect.any(Error));
    errSpy.mockRestore();
  });

  it("afterDelete failure does not corrupt the delete result", async () => {
    registerGlobalOryCMSHook(
      "afterDelete",
      () => {
        throw new Error("Cleanup failed");
      },
      { id: "after-fail-delete" },
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const pool = makePool(() => {
      calls++;
      return { rows: [row()] };
    });
    await expect(deleteOryCMSContentEntry("posts", "1", pool)).resolves.toBeUndefined();
    expect(calls).toBe(2); // GET + DELETE both ran
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("afterDelete"), expect.any(Error));
    errSpy.mockRestore();
  });

  it("afterPublish failure does not corrupt the returned published entry", async () => {
    registerGlobalOryCMSHook(
      "afterPublish",
      () => {
        throw new Error("Search index failed");
      },
      { id: "after-fail-publish" },
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let call = 0;
    const pool = makePool(() => {
      call++;
      if (call === 1) return { rows: [{ ...row(), _isDraft: true }] };
      return { rows: [{ ...row(), _isDraft: false, _publishedAt: NOW }] };
    });
    const entry = await publishOryCMSContentEntry("articles", "1", pool);
    expect(entry.status).toBe("published");
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("afterPublish"), expect.any(Error));
    errSpy.mockRestore();
  });

  it("async after-hook failure is also caught", async () => {
    registerGlobalOryCMSHook(
      "afterCreate",
      async () => {
        await new Promise<void>((r) => setTimeout(r, 5));
        throw new Error("Async failure");
      },
      { id: "async-after-fail" },
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const entry = await createOryCMSContentEntry("posts", { data: { title: "T" } }, singleRow());
    expect(entry).toBeDefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// ── Multiple hooks ────────────────────────────────────────────────────────────

describe("Multiple hooks and registration order", () => {
  it("multiple beforeCreate hooks all run and mutations accumulate", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      (ctx: OryCMSHookContext) => {
        ctx.data["field_a"] = "a";
      },
      { id: "h1" },
    );
    registerGlobalOryCMSHook(
      "beforeCreate",
      (ctx: OryCMSHookContext) => {
        ctx.data["field_b"] = "b";
      },
      { id: "h2" },
    );

    let capturedParams: unknown[] = [];
    const pool = makePool((_sql: string, params?: unknown[]) => {
      capturedParams = params ?? [];
      return { rows: [row()] };
    });

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, pool);
    expect(capturedParams).toContain("a");
    expect(capturedParams).toContain("b");
  });

  it("higher-priority hooks run first and can affect lower-priority mutations", async () => {
    const order: number[] = [];
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        order.push(1);
      },
      { id: "low", priority: 1 },
    );
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        order.push(100);
      },
      { id: "high", priority: 100 },
    );

    await createOryCMSContentEntry("posts", { data: { title: "T" } }, singleRow());
    expect(order).toEqual([100, 1]);
  });
});
