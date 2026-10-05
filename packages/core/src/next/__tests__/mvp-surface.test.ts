import { describe, expect, it } from "vitest";
import { ORYCMS_ROUTES } from "../index";

// Grows module-by-module as U1-3's sub-tasks land (see internal/PROGRESS.md).
// As of U1-3.2: session routes (U1-3.1/U1-3.1b) + the 6 token-based auth routes.
describe("MVP route surface", () => {
  it("ships the auth module's session + token-based routes, nothing else yet", () => {
    expect(ORYCMS_ROUTES.map(({ method, pattern }) => `${method} ${pattern}`).sort()).toEqual([
      "GET auth/me",
      "GET auth/session",
      "GET auth/setup-status",
      "POST auth/accept-invite",
      "POST auth/activate",
      "POST auth/forgot-password",
      "POST auth/invite",
      "POST auth/login",
      "POST auth/logout",
      "POST auth/refresh",
      "POST auth/reset-password",
      "POST auth/setup",
    ]);
  });
});
