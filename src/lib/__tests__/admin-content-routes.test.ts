import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminContentCreatePath,
  adminContentEditPath,
  adminContentIndexPath,
  adminContentListPath,
  legacyCollectionContentCreatePath,
  legacyCollectionContentEditPath,
  legacyCollectionContentListPath,
} from "@/admin";

describe("admin content routes", () => {
  it("builds canonical admin content routes", () => {
    expect(adminContentIndexPath()).toBe("/admin/content");
    expect(adminContentListPath("blog-posts")).toBe("/admin/content/blog-posts");
    expect(adminContentCreatePath("blog-posts")).toBe("/admin/content/blog-posts/create");
    expect(adminContentEditPath("blog-posts", "entry-1")).toBe(
      "/admin/content/blog-posts/entry-1/edit",
    );
  });

  it("uses create instead of new for the canonical create route", () => {
    expect(adminContentCreatePath("pages")).toContain("/create");
    expect(adminContentCreatePath("pages")).not.toContain("/new");
  });

  it("keeps legacy collection content aliases available for redirects", () => {
    expect(legacyCollectionContentListPath("blog-posts")).toBe("/collections/blog-posts/content");
    expect(legacyCollectionContentCreatePath("blog-posts")).toBe(
      "/collections/blog-posts/content/new",
    );
    expect(legacyCollectionContentEditPath("blog-posts", "entry-1")).toBe(
      "/collections/blog-posts/content/entry-1/edit",
    );
  });

  it("wires content UI links through canonical admin route helpers", () => {
    const files = [
      "src/components/content/OryCMSCollectionContentPage.tsx",
      "src/components/content/OryCMSContentForm.tsx",
      "src/components/content/OryCMSContentTable.tsx",
      "src/components/dashboard/AppSidebar.tsx",
    ];

    const source = files
      .map((file) => readFileSync(path.join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).toContain("adminContentListPath");
    expect(source).toContain("adminContentCreatePath");
    expect(source).toContain("adminContentEditPath");
    expect(source).toContain("adminContentIndexPath");
    expect(source).not.toContain("router.push(`/collections/");
    expect(source).not.toContain('href="/collections/');
    expect(source).not.toContain("/content/new");
    expect(source).not.toContain('to: "/content"');
  });
});
