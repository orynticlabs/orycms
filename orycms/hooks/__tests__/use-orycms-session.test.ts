import { describe, it, expect } from "vitest";
import { hasOryCMSClientPermission } from "../use-orycms-session";

describe("hasOryCMSClientPermission", () => {
  const perms = ["content:read", "content:create", "media:manage"];

  it("grants an exact resource:action match", () => {
    expect(hasOryCMSClientPermission(perms, "content", "read")).toBe(true);
    expect(hasOryCMSClientPermission(perms, "content", "create")).toBe(true);
  });

  it("grants any action when the role has resource:manage", () => {
    expect(hasOryCMSClientPermission(perms, "media", "read")).toBe(true);
    expect(hasOryCMSClientPermission(perms, "media", "delete")).toBe(true);
    expect(hasOryCMSClientPermission(perms, "media", "publish")).toBe(true);
  });

  it("denies actions not granted and resources absent", () => {
    expect(hasOryCMSClientPermission(perms, "content", "delete")).toBe(false);
    expect(hasOryCMSClientPermission(perms, "users", "read")).toBe(false);
  });

  it("denies everything for an empty permission set (fail-closed)", () => {
    expect(hasOryCMSClientPermission([], "content", "read")).toBe(false);
  });
});
