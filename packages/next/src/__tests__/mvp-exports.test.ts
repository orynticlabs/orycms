import { describe, expect, it } from "vitest";
import * as api from "../index";

describe("MVP package exports", () => {
  it("exports first-run UI without advanced modules", () => {
    expect(Object.keys(api).sort()).toEqual([
      "AppShell",
      "AppSidebar",
      "Can",
      "Dashboard",
      "OryCMSAdmin",
      "OryCMSLoginPage",
      "OryCMSSessionProvider",
      "OryCMSSetupPage",
      "hasOryCMSClientPermission",
      "useOryCMSPermission",
      "useOryCMSSession",
    ]);
  });
});
