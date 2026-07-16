import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerGlobalOryCMSHook,
  registerOryCMSPluginHook,
  registerOryCMSCollectionHooks,
  unregisterOryCMSCollectionHooks,
  clearOryCMSHookRegistry,
  getOryCMSHooksForEvent,
  hasOryCMSHooks,
} from "../hook.registry";
import { buildOryCMSHookContext, runOryCMSBeforeHooks, runOryCMSAfterHooks } from "../hook.engine";
import { OryCMSHookError } from "../hook.errors";
import type { OryCMSHookContext, OryCMSHookFn } from "../hook.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(
  operation = "beforeCreate" as OryCMSHookContext["operation"],
  collection: string | null = "blog-posts",
): Readonly<OryCMSHookContext> {
  return buildOryCMSHookContext(operation, collection, { title: "Test" }, null);
}

// ── Registration ──────────────────────────────────────────────────────────────

describe("Registration", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("registers a global hook and returns its id", () => {
    const id = registerGlobalOryCMSHook("beforeCreate", vi.fn());
    expect(id).toMatch(/^global:beforeCreate:/);
    expect(hasOryCMSHooks("beforeCreate")).toBe(true);
  });

  it("uses provided id", () => {
    const id = registerGlobalOryCMSHook("beforeCreate", vi.fn(), { id: "my-hook" });
    expect(id).toBe("my-hook");
  });

  it("registers a plugin hook", () => {
    const id = registerOryCMSPluginHook("email-plugin", "afterCreate", vi.fn());
    expect(id).toMatch(/^plugin:email-plugin:afterCreate:/);
  });

  it("registers collection hooks for a specific collection", () => {
    registerOryCMSCollectionHooks("blog-posts", { beforeCreate: [vi.fn()] });
    expect(hasOryCMSHooks("beforeCreate", "blog-posts")).toBe(true);
    expect(hasOryCMSHooks("beforeCreate", "other-collection")).toBe(false);
  });

  it("collection hook does not bleed into unrelated event", () => {
    registerOryCMSCollectionHooks("blog-posts", { afterCreate: [vi.fn()] });
    expect(hasOryCMSHooks("beforeCreate", "blog-posts")).toBe(false);
    expect(hasOryCMSHooks("afterCreate", "blog-posts")).toBe(true);
  });
});

// ── Duplicate registration prevention ────────────────────────────────────────

describe("Duplicate registration prevention", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("throws DUPLICATE_HOOK when registering the same id twice", () => {
    registerGlobalOryCMSHook("beforeCreate", vi.fn(), { id: "dup" });
    expect(() => registerGlobalOryCMSHook("beforeCreate", vi.fn(), { id: "dup" })).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_HOOK", statusCode: 409 }),
    );
  });

  it("registerOryCMSCollectionHooks is idempotent on re-upsert", () => {
    const fn = vi.fn();
    registerOryCMSCollectionHooks("blog-posts", { beforeCreate: [fn] });
    // Should not throw on second call (same ID skipped)
    expect(() => registerOryCMSCollectionHooks("blog-posts", { beforeCreate: [fn] })).not.toThrow();
  });
});

// ── Global hooks ──────────────────────────────────────────────────────────────

describe("Global hooks", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("global hook runs for any collection", async () => {
    const fn = vi.fn();
    registerGlobalOryCMSHook("beforeCreate", fn);
    await runOryCMSBeforeHooks("beforeCreate", makeCtx("beforeCreate", "posts"));
    await runOryCMSBeforeHooks("beforeCreate", makeCtx("beforeCreate", "pages"));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("global hook runs even when collection is null", async () => {
    const fn = vi.fn();
    registerGlobalOryCMSHook("beforeLogin", fn);
    await runOryCMSBeforeHooks("beforeLogin", makeCtx("beforeLogin", null));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── Collection hooks ──────────────────────────────────────────────────────────

describe("Collection hooks", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("collection hook only runs for its collection", async () => {
    const fn = vi.fn();
    registerOryCMSCollectionHooks("blog-posts", { beforeCreate: [fn] });
    await runOryCMSBeforeHooks("beforeCreate", makeCtx("beforeCreate", "blog-posts"));
    await runOryCMSBeforeHooks("beforeCreate", makeCtx("beforeCreate", "pages"));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("unregisterOryCMSCollectionHooks removes all collection hooks", async () => {
    const fn = vi.fn();
    registerOryCMSCollectionHooks("blog-posts", { beforeCreate: [fn], afterCreate: [fn] });
    unregisterOryCMSCollectionHooks("blog-posts");
    await runOryCMSBeforeHooks("beforeCreate", makeCtx("beforeCreate", "blog-posts"));
    expect(fn).not.toHaveBeenCalled();
    expect(hasOryCMSHooks("beforeCreate", "blog-posts")).toBe(false);
  });
});

// ── Priority execution ────────────────────────────────────────────────────────

describe("Priority execution", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("higher priority hooks run first", async () => {
    const order: number[] = [];
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        order.push(10);
      },
      { priority: 10, id: "h10" },
    );
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        order.push(50);
      },
      { priority: 50, id: "h50" },
    );
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        order.push(5);
      },
      { priority: 5, id: "h5" },
    );
    await runOryCMSBeforeHooks("beforeCreate", makeCtx());
    expect(order).toEqual([50, 10, 5]);
  });

  it("hooks with equal priority run in registration order", async () => {
    const order: string[] = [];
    registerGlobalOryCMSHook(
      "afterCreate",
      () => {
        order.push("a");
      },
      { id: "a" },
    );
    registerGlobalOryCMSHook(
      "afterCreate",
      () => {
        order.push("b");
      },
      { id: "b" },
    );
    await runOryCMSAfterHooks("afterCreate", makeCtx("afterCreate"));
    expect(order).toEqual(["a", "b"]);
  });
});

// ── Multiple hooks ────────────────────────────────────────────────────────────

describe("Multiple hooks", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("all registered hooks are called", async () => {
    const calls: string[] = [];
    registerGlobalOryCMSHook(
      "beforeUpdate",
      () => {
        calls.push("g1");
      },
      { id: "g1" },
    );
    registerGlobalOryCMSHook(
      "beforeUpdate",
      () => {
        calls.push("g2");
      },
      { id: "g2" },
    );
    registerOryCMSCollectionHooks("blog-posts", {
      beforeUpdate: [
        () => {
          calls.push("c1");
        },
        () => {
          calls.push("c2");
        },
      ],
    });
    await runOryCMSBeforeHooks("beforeUpdate", makeCtx("beforeUpdate", "blog-posts"));
    expect(calls).toContain("g1");
    expect(calls).toContain("g2");
    expect(calls).toContain("c1");
    expect(calls).toContain("c2");
    expect(calls).toHaveLength(4);
  });
});

// ── Async hooks ───────────────────────────────────────────────────────────────

describe("Async hooks", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("async hooks are awaited before continuing", async () => {
    const log: string[] = [];
    registerGlobalOryCMSHook(
      "beforeCreate",
      async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        log.push("async-done");
      },
      { id: "async-hook" },
    );
    await runOryCMSBeforeHooks("beforeCreate", makeCtx());
    expect(log).toEqual(["async-done"]);
  });

  it("Promise-returning hooks are awaited", async () => {
    const fn: OryCMSHookFn = () => Promise.resolve();
    registerGlobalOryCMSHook("afterCreate", fn, { id: "promise-hook" });
    await expect(
      runOryCMSAfterHooks("afterCreate", makeCtx("afterCreate")),
    ).resolves.toBeUndefined();
  });
});

// ── Timeout ───────────────────────────────────────────────────────────────────

describe("Timeout", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("throws HOOK_TIMEOUT when hook exceeds its timeout", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => new Promise<void>((resolve) => setTimeout(resolve, 200)),
      { id: "slow-hook", timeout: 10 },
    );
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).rejects.toMatchObject({
      code: "HOOK_TIMEOUT",
      statusCode: 408,
    });
  });

  it("fast hook completes within timeout", async () => {
    registerGlobalOryCMSHook("beforeCreate", vi.fn(), { id: "fast-hook", timeout: 1000 });
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).resolves.toBeUndefined();
  });
});

// ── Cancellation ──────────────────────────────────────────────────────────────

describe("Cancellation", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("before hook returning { cancel: true } throws HOOK_ABORTED", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => ({ cancel: true as const, reason: "Blocked by validation" }),
      { id: "cancel-hook" },
    );
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).rejects.toMatchObject({
      code: "HOOK_ABORTED",
      statusCode: 422,
    });
  });

  it("HOOK_ABORTED message matches reason", async () => {
    registerGlobalOryCMSHook(
      "beforeDelete",
      () => ({ cancel: true as const, reason: "Cannot delete published entries." }),
      { id: "cancel-delete" },
    );
    try {
      await runOryCMSBeforeHooks("beforeDelete", makeCtx("beforeDelete"));
    } catch (err) {
      expect((err as OryCMSHookError).message).toBe("Cannot delete published entries.");
    }
  });

  it("hooks after a cancelling hook do NOT run", async () => {
    const afterFn = vi.fn();
    registerGlobalOryCMSHook("beforeCreate", () => ({ cancel: true as const, reason: "stop" }), {
      id: "cancel",
      priority: 100,
    });
    registerGlobalOryCMSHook("beforeCreate", afterFn, { id: "should-not-run", priority: 50 });
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).rejects.toMatchObject({
      code: "HOOK_ABORTED",
    });
    expect(afterFn).not.toHaveBeenCalled();
  });

  it("after hooks do NOT support cancellation (void-only)", async () => {
    const fn: OryCMSHookFn = vi.fn().mockResolvedValue(undefined);
    registerGlobalOryCMSHook("afterCreate", fn, { id: "after-hook" });
    await expect(
      runOryCMSAfterHooks("afterCreate", makeCtx("afterCreate")),
    ).resolves.toBeUndefined();
  });
});

// ── Errors ────────────────────────────────────────────────────────────────────

describe("Errors", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("throws HOOK_FAILED when hook throws a generic error", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        throw new Error("Something went wrong");
      },
      { id: "failing-hook" },
    );
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).rejects.toMatchObject({
      code: "HOOK_FAILED",
      statusCode: 500,
    });
  });

  it("INVALID_HOOK thrown when fn is not a function", () => {
    expect(() =>
      registerGlobalOryCMSHook("beforeCreate", null as unknown as OryCMSHookFn, { id: "bad-hook" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_HOOK" }));
  });

  it("OryCMSHookError is an instance of Error", () => {
    const err = new OryCMSHookError("HOOK_FAILED", "test", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("OryCMSHookError");
    expect(err.code).toBe("HOOK_FAILED");
  });

  it("re-throws OryCMSHookError directly without wrapping", async () => {
    registerGlobalOryCMSHook(
      "beforeCreate",
      () => {
        throw new OryCMSHookError("HOOK_NOT_FOUND", "direct", 404);
      },
      { id: "rethrow-hook" },
    );
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).rejects.toMatchObject({
      code: "HOOK_NOT_FOUND",
      statusCode: 404,
    });
  });
});

// ── Transaction propagation ───────────────────────────────────────────────────

describe("Transaction propagation", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("context.transaction is passed through to hooks", async () => {
    const fakeClient = { query: vi.fn() };
    let receivedTx: unknown;
    registerGlobalOryCMSHook(
      "beforeCreate",
      (ctx) => {
        receivedTx = ctx.transaction;
      },
      { id: "tx-hook" },
    );
    const ctx = buildOryCMSHookContext("beforeCreate", "posts", {}, null, {
      transaction: fakeClient,
    });
    await runOryCMSBeforeHooks("beforeCreate", ctx);
    expect(receivedTx).toBe(fakeClient);
  });
});

// ── Before hook abort ─────────────────────────────────────────────────────────

describe("Before hook abort", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("abort stops execution before the engine operation", async () => {
    let engineRan = false;
    registerGlobalOryCMSHook(
      "beforeCollectionCreate",
      () => ({ cancel: true as const, reason: "Not allowed" }),
      { id: "abort" },
    );

    async function simulatedEngine() {
      await runOryCMSBeforeHooks("beforeCollectionCreate", makeCtx("beforeCollectionCreate"));
      engineRan = true; // should not reach here
    }

    await expect(simulatedEngine()).rejects.toMatchObject({ code: "HOOK_ABORTED" });
    expect(engineRan).toBe(false);
  });
});

// ── After hook execution ──────────────────────────────────────────────────────

describe("After hook execution", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("after hooks run after the operation", async () => {
    const log: string[] = [];
    registerGlobalOryCMSHook(
      "afterCreate",
      () => {
        log.push("after");
      },
      { id: "after" },
    );

    log.push("engine");
    await runOryCMSAfterHooks("afterCreate", makeCtx("afterCreate"));
    expect(log).toEqual(["engine", "after"]);
  });
});

// ── No registered hooks (fast path) ──────────────────────────────────────────

describe("No registered hooks", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("runOryCMSBeforeHooks is a no-op with no hooks", async () => {
    await expect(runOryCMSBeforeHooks("beforeCreate", makeCtx())).resolves.toBeUndefined();
  });

  it("runOryCMSAfterHooks is a no-op with no hooks", async () => {
    await expect(
      runOryCMSAfterHooks("afterCreate", makeCtx("afterCreate")),
    ).resolves.toBeUndefined();
  });

  it("hasOryCMSHooks returns false when nothing registered", () => {
    expect(hasOryCMSHooks("beforeCreate")).toBe(false);
    expect(hasOryCMSHooks("beforeCreate", "some-collection")).toBe(false);
  });

  it("getOryCMSHooksForEvent returns empty array", () => {
    expect(getOryCMSHooksForEvent("beforeCreate", "blog-posts")).toHaveLength(0);
  });
});

// ── Existing engine compatibility ─────────────────────────────────────────────

describe("Existing engine compatibility", () => {
  beforeEach(() => clearOryCMSHookRegistry());

  it("content engine calls beforeCreate and afterCreate hooks", async () => {
    // Arrange: import dynamically to get fresh module state
    const { createOryCMSContentEntry } = await import("@/content");
    const { registerOryCMSCollection, clearOryCMSRegistry } = await import("@/schema");

    clearOryCMSRegistry();
    registerOryCMSCollection({
      name: "Posts",
      slug: "posts",
      labels: { singular: "Post", plural: "Posts" },
      fields: [{ name: "title", type: "text", required: true }],
    });

    const beforeFn = vi.fn();
    const afterFn = vi.fn();
    registerGlobalOryCMSHook("beforeCreate", beforeFn, { id: "compat-before" });
    registerGlobalOryCMSHook("afterCreate", afterFn, { id: "compat-after" });

    const mockRow = { id: "1", title: "Hello", createdAt: new Date(), updatedAt: new Date() };
    const fakePool = {
      query: vi.fn().mockResolvedValue({ rows: [mockRow] }),
    };

    // Act
    await createOryCMSContentEntry(
      "posts",
      { data: { title: "Hello" } },
      fakePool as unknown as import("pg").Pool,
    );

    // Assert
    expect(beforeFn).toHaveBeenCalledOnce();
    expect(afterFn).toHaveBeenCalledOnce();
    const beforeCtx = beforeFn.mock.calls[0][0] as OryCMSHookContext;
    expect(beforeCtx.collection).toBe("posts");
    expect(beforeCtx.operation).toBe("beforeCreate");

    clearOryCMSRegistry();
  });

  it("engine behavior is unchanged when no hooks are registered", async () => {
    const { createOryCMSContentEntry } = await import("@/content");
    const { registerOryCMSCollection, clearOryCMSRegistry } = await import("@/schema");

    clearOryCMSRegistry();
    registerOryCMSCollection({
      name: "Posts",
      slug: "posts",
      labels: { singular: "Post", plural: "Posts" },
      fields: [{ name: "title", type: "text", required: true }],
    });

    const mockRow = { id: "1", title: "Hello", createdAt: new Date(), updatedAt: new Date() };
    const queryFn = vi.fn().mockResolvedValue({ rows: [mockRow] });

    await createOryCMSContentEntry("posts", { data: { title: "Hello" } }, {
      query: queryFn,
    } as unknown as import("pg").Pool);

    // DB was still called correctly
    expect(queryFn).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "posts"'),
      expect.any(Array),
    );

    clearOryCMSRegistry();
  });
});
