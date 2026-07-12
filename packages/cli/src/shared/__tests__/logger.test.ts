import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../logger";

// Capture all writes so we don't pollute test output
const stdoutWrites: string[] = [];
const stderrWrites: string[] = [];

beforeEach(() => {
  stdoutWrites.length = 0;
  stderrWrites.length = 0;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdoutWrites.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrWrites.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("info writes to stdout", () => {
    logger.info("hello");
    expect(stdoutWrites.some((w) => w.includes("hello"))).toBe(true);
  });

  it("success writes to stdout", () => {
    logger.success("done");
    expect(stdoutWrites.some((w) => w.includes("done"))).toBe(true);
  });

  it("warn writes to stderr", () => {
    logger.warn("careful");
    expect(stderrWrites.some((w) => w.includes("careful"))).toBe(true);
  });

  it("error writes to stderr", () => {
    logger.error("boom");
    expect(stderrWrites.some((w) => w.includes("boom"))).toBe(true);
  });

  it("debug is silent without DEBUG env var", () => {
    const prev = process.env["DEBUG"];
    delete process.env["DEBUG"];
    logger.debug("secret");
    expect(stderrWrites).toHaveLength(0);
    if (prev !== undefined) process.env["DEBUG"] = prev;
  });

  it("debug writes to stderr when DEBUG is set", () => {
    const prev = process.env["DEBUG"];
    process.env["DEBUG"] = "1";
    logger.debug("visible");
    expect(stderrWrites.some((w) => w.includes("visible"))).toBe(true);
    if (prev !== undefined) process.env["DEBUG"] = prev;
    else delete process.env["DEBUG"];
  });

  it("blank writes an empty line to stdout", () => {
    logger.blank();
    expect(stdoutWrites.some((w) => w === "\n")).toBe(true);
  });

  it("table writes key-value rows to stdout", () => {
    logger.table([
      ["id", "my-plugin"],
      ["version", "1.0.0"],
    ]);
    const out = stdoutWrites.join("");
    expect(out).toContain("id");
    expect(out).toContain("my-plugin");
    expect(out).toContain("version");
    expect(out).toContain("1.0.0");
  });

  it("table is a no-op for empty rows", () => {
    logger.table([]);
    expect(stdoutWrites).toHaveLength(0);
  });
});
