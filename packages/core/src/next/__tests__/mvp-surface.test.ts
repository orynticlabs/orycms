import { describe, expect, it } from "vitest";
import { ORYCMS_ROUTES } from "../index";

describe("MVP route surface", () => {
  it("ships only first-run authentication endpoints", () => {
    expect(ORYCMS_ROUTES.map(({ method, pattern }) => `${method} ${pattern}`).sort()).toEqual([
      "GET auth/me",
      "GET auth/session",
      "GET auth/setup-status",
      "POST auth/login",
      "POST auth/logout",
      "POST auth/setup",
    ]);
  });
});
