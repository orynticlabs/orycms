import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOryCMSHookRegistry,
  buildOryCMSHookContext,
  hasOryCMSHooks,
  runOryCMSAfterHooks,
  runOryCMSBeforeHooks,
} from "@/hooks";
import { clearOryCMSPluginRegistry, registerOryCMSPlugin, unregisterOryCMSPlugin } from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlugin(id: string, overrides: Partial<OryCMSPlugin> = {}): OryCMSPlugin {
  return { id, name: `Plugin ${id}`, version: "1.0.0", ...overrides };
}

function ctx(
  event:
    | "beforeCreate"
    | "afterCreate"
    | "beforeUpdate"
    | "afterUpdate"
    | "beforeDelete"
    | "afterDelete"
    | "beforePublish"
    | "afterPublish" = "beforeCreate",
) {
  return buildOryCMSHookContext(event, "posts", { title: "T" }, null);
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSPluginRegistry();
  clearOryCMSHookRegistry();
});

afterEach(() => {
  clearOryCMSPluginRegistry();
  clearOryCMSHookRegistry();
});

// ── Load ──────────────────────────────────────────────────────────────────────

describe("Load", () => {
  it("registers plugin hook into the hook engine", () => {
    const fn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }));
    expect(hasOryCMSHooks("beforeCreate")).toBe(true);
  });

  it("hook executes when the matching lifecycle event fires", async () => {
    const fn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }));
    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("registers all eight supported lifecycle hooks", () => {
    const fn = vi.fn();
    registerOryCMSPlugin(
      makePlugin("p", {
        hooks: {
          beforeCreate: fn,
          afterCreate: fn,
          beforeUpdate: fn,
          afterUpdate: fn,
          beforeDelete: fn,
          afterDelete: fn,
          beforePublish: fn,
          afterPublish: fn,
        },
      }),
    );

    expect(hasOryCMSHooks("beforeCreate")).toBe(true);
    expect(hasOryCMSHooks("afterCreate")).toBe(true);
    expect(hasOryCMSHooks("beforeUpdate")).toBe(true);
    expect(hasOryCMSHooks("afterUpdate")).toBe(true);
    expect(hasOryCMSHooks("beforeDelete")).toBe(true);
    expect(hasOryCMSHooks("afterDelete")).toBe(true);
    expect(hasOryCMSHooks("beforePublish")).toBe(true);
    expect(hasOryCMSHooks("afterPublish")).toBe(true);
  });

  it("supports an array of hooks for a single event", async () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: [fn1, fn2] } }));
    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("plugin with no hooks loads without error and registers nothing", () => {
    expect(() => registerOryCMSPlugin(makePlugin("no-hooks"))).not.toThrow();
    expect(hasOryCMSHooks("beforeCreate")).toBe(false);
  });

  it("hook receives context with correct collection and operation", async () => {
    let received: unknown;
    registerOryCMSPlugin(
      makePlugin("p", {
        hooks: {
          beforeCreate: (hookCtx) => {
            received = hookCtx;
          },
        },
      }),
    );

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect((received as { collection: string }).collection).toBe("posts");
    expect((received as { operation: string }).operation).toBe("beforeCreate");
  });
});

// ── Unload ────────────────────────────────────────────────────────────────────

describe("Unload", () => {
  it("removes plugin hooks from the hook engine", () => {
    const fn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }));
    unregisterOryCMSPlugin("p");
    expect(hasOryCMSHooks("beforeCreate")).toBe(false);
  });

  it("unloaded plugin hook does not execute", async () => {
    const fn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { afterCreate: fn } }));
    unregisterOryCMSPlugin("p");
    await runOryCMSAfterHooks("afterCreate", ctx("afterCreate"));
    expect(fn).not.toHaveBeenCalled();
  });

  it("unloading one plugin leaves other plugins' hooks intact", async () => {
    const fnA = vi.fn();
    const fnB = vi.fn();
    registerOryCMSPlugin(makePlugin("a", { hooks: { beforeCreate: fnA } }));
    registerOryCMSPlugin(makePlugin("b", { hooks: { beforeCreate: fnB } }));
    unregisterOryCMSPlugin("a");

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).toHaveBeenCalledOnce();
  });

  it("clearOryCMSPluginRegistry removes all plugin hooks", () => {
    registerOryCMSPlugin(makePlugin("a", { hooks: { beforeCreate: () => {} } }));
    registerOryCMSPlugin(makePlugin("b", { hooks: { afterCreate: () => {} } }));
    clearOryCMSPluginRegistry();
    expect(hasOryCMSHooks("beforeCreate")).toBe(false);
    expect(hasOryCMSHooks("afterCreate")).toBe(false);
  });
});

// ── Reload ────────────────────────────────────────────────────────────────────

describe("Reload", () => {
  it("unload then reload registers fresh hooks exactly once", async () => {
    const fn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }));
    unregisterOryCMSPlugin("p");
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }));

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reload with a different hook function uses the new function", async () => {
    const oldFn = vi.fn();
    const newFn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: oldFn } }));
    unregisterOryCMSPlugin("p");
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: newFn } }));

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(oldFn).not.toHaveBeenCalled();
    expect(newFn).toHaveBeenCalledOnce();
  });
});

// ── Duplicate protection ──────────────────────────────────────────────────────

describe("Duplicate protection", () => {
  it("registering the same plugin id twice throws and does not duplicate hooks", async () => {
    const fn = vi.fn();
    registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }));

    expect(() => registerOryCMSPlugin(makePlugin("p", { hooks: { beforeCreate: fn } }))).toThrow(
      "already registered",
    );

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── Execution order ───────────────────────────────────────────────────────────

describe("Execution order", () => {
  it("multiple plugins' hooks execute in plugin registration order", async () => {
    const order: string[] = [];
    registerOryCMSPlugin(
      makePlugin("a", {
        hooks: {
          beforeCreate: () => {
            order.push("a");
          },
        },
      }),
    );
    registerOryCMSPlugin(
      makePlugin("b", {
        hooks: {
          beforeCreate: () => {
            order.push("b");
          },
        },
      }),
    );
    registerOryCMSPlugin(
      makePlugin("c", {
        hooks: {
          beforeCreate: () => {
            order.push("c");
          },
        },
      }),
    );

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("hooks within an array on one plugin execute in array order", async () => {
    const order: string[] = [];
    registerOryCMSPlugin(
      makePlugin("p", {
        hooks: {
          afterCreate: [
            () => {
              order.push("1");
            },
            () => {
              order.push("2");
            },
            () => {
              order.push("3");
            },
          ],
        },
      }),
    );

    await runOryCMSAfterHooks("afterCreate", ctx("afterCreate"));
    expect(order).toEqual(["1", "2", "3"]);
  });

  it("mixed plugins and hook arrays interleave correctly by registration order", async () => {
    const order: string[] = [];
    registerOryCMSPlugin(
      makePlugin("a", {
        hooks: {
          afterUpdate: [
            () => {
              order.push("a1");
            },
            () => {
              order.push("a2");
            },
          ],
        },
      }),
    );
    registerOryCMSPlugin(
      makePlugin("b", {
        hooks: {
          afterUpdate: () => {
            order.push("b1");
          },
        },
      }),
    );

    await runOryCMSAfterHooks(
      "afterUpdate",
      buildOryCMSHookContext("afterUpdate", "posts", {}, null),
    );
    expect(order).toEqual(["a1", "a2", "b1"]);
  });
});

// ── Async hooks ───────────────────────────────────────────────────────────────

describe("Async hooks", () => {
  it("async plugin hook is awaited before continuing", async () => {
    const log: string[] = [];
    registerOryCMSPlugin(
      makePlugin("p", {
        hooks: {
          afterCreate: async () => {
            await new Promise<void>((r) => setTimeout(r, 10));
            log.push("done");
          },
        },
      }),
    );

    await runOryCMSAfterHooks("afterCreate", ctx("afterCreate"));
    expect(log).toEqual(["done"]);
  });

  it("async before hook completes before next hook runs", async () => {
    const order: string[] = [];
    registerOryCMSPlugin(
      makePlugin("a", {
        hooks: {
          beforeCreate: async () => {
            await new Promise<void>((r) => setTimeout(r, 10));
            order.push("async-a");
          },
        },
      }),
    );
    registerOryCMSPlugin(
      makePlugin("b", {
        hooks: {
          beforeCreate: () => {
            order.push("sync-b");
          },
        },
      }),
    );

    await runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"));
    expect(order).toEqual(["async-a", "sync-b"]);
  });

  it("before hook returning cancel aborts the operation", async () => {
    registerOryCMSPlugin(
      makePlugin("guard", {
        hooks: {
          beforeCreate: () => ({ cancel: true as const, reason: "Plugin blocked this" }),
        },
      }),
    );

    await expect(runOryCMSBeforeHooks("beforeCreate", ctx("beforeCreate"))).rejects.toMatchObject({
      code: "HOOK_ABORTED",
      message: "Plugin blocked this",
    });
  });
});
