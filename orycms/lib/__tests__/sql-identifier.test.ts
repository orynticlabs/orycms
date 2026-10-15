import { describe, it, expect } from "vitest";
import { quoteSqlIdentifier } from "../sql-identifier";

describe("quoteSqlIdentifier", () => {
  it("wraps a plain name in double quotes for postgresql", () => {
    expect(quoteSqlIdentifier("posts")).toBe('"posts"');
    expect(quoteSqlIdentifier("posts", "postgresql")).toBe('"posts"');
  });

  it("wraps a plain name in backticks for mysql", () => {
    expect(quoteSqlIdentifier("posts", "mysql")).toBe("`posts`");
  });

  it("escapes an embedded double quote by doubling it, for postgresql-style quoting", () => {
    const hostile = 'foo"; DROP TABLE orycms_users; --';
    const quoted = quoteSqlIdentifier(hostile, "postgresql");

    // Every quote inside the name is doubled, so none of it can close the
    // identifier early — the whole string stays one quoted identifier, start
    // to finish, with no bare unescaped quote anywhere in the middle.
    expect(quoted).toBe('"foo""; DROP TABLE orycms_users; --"');
    expect(quoted.slice(1, -1).replace(/""/g, "")).not.toContain('"');
  });

  it("escapes an embedded backtick by doubling it, for mysql-style quoting", () => {
    const hostile = "foo`; DROP TABLE orycms_users; --";
    const quoted = quoteSqlIdentifier(hostile, "mysql");

    expect(quoted).toBe("`foo``; DROP TABLE orycms_users; --`");
  });

  it("escapes a name that is only quote characters", () => {
    expect(quoteSqlIdentifier('"""', "postgresql")).toBe('""""""""');
  });

  it("leaves unicode characters alone (format safety is the validator's job, not this helper's)", () => {
    expect(quoteSqlIdentifier("tablé_́", "postgresql")).toBe('"tablé_́"');
  });
});
