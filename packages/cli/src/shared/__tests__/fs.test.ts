import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ensureDir,
  fileExists,
  fromCwd,
  fromHome,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from "../fs";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "orycms-cli-fs-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("fileExists", () => {
  it("returns true when a file exists", () => {
    writeTextFile(join(tempDir, "a.txt"), "hello");
    expect(fileExists(join(tempDir, "a.txt"))).toBe(true);
  });

  it("returns false when a file does not exist", () => {
    expect(fileExists(join(tempDir, "missing.txt"))).toBe(false);
  });

  it("returns true for a directory", () => {
    expect(fileExists(tempDir)).toBe(true);
  });
});

describe("ensureDir", () => {
  it("creates a directory that does not exist", () => {
    const dir = join(tempDir, "sub", "nested");
    ensureDir(dir);
    expect(fileExists(dir)).toBe(true);
  });

  it("does not throw when the directory already exists", () => {
    expect(() => ensureDir(tempDir)).not.toThrow();
  });
});

describe("writeTextFile / readTextFile", () => {
  it("writes and reads a text file", () => {
    const path = join(tempDir, "hello.txt");
    writeTextFile(path, "world");
    expect(readTextFile(path)).toBe("world");
  });

  it("creates parent directories automatically", () => {
    const path = join(tempDir, "deep", "nested", "file.txt");
    writeTextFile(path, "data");
    expect(readTextFile(path)).toBe("data");
  });

  it("readTextFile throws when file is absent", () => {
    expect(() => readTextFile(join(tempDir, "ghost.txt"))).toThrow(/not found/i);
  });
});

describe("writeJsonFile / readJsonFile", () => {
  it("writes and reads a JSON file", () => {
    const path = join(tempDir, "data.json");
    writeJsonFile(path, { id: "seo", version: "1.0.0" });
    const data = readJsonFile<{ id: string; version: string }>(path);
    expect(data.id).toBe("seo");
    expect(data.version).toBe("1.0.0");
  });

  it("output is pretty-printed (indented)", () => {
    const path = join(tempDir, "pretty.json");
    writeJsonFile(path, { a: 1 });
    const raw = readTextFile(path);
    expect(raw).toContain("\n");
  });

  it("readJsonFile throws when file is absent", () => {
    expect(() => readJsonFile(join(tempDir, "absent.json"))).toThrow(/not found/i);
  });

  it("readJsonFile throws on malformed JSON", () => {
    const path = join(tempDir, "bad.json");
    writeTextFile(path, "{ bad }");
    expect(() => readJsonFile(path)).toThrow(/invalid json/i);
  });

  it("creates parent directories automatically", () => {
    const path = join(tempDir, "a", "b", "c.json");
    writeJsonFile(path, { ok: true });
    expect(readJsonFile<{ ok: boolean }>(path).ok).toBe(true);
  });
});

describe("fromCwd / fromHome", () => {
  it("fromCwd resolves from process.cwd()", () => {
    const result = fromCwd("orycms.config.ts");
    expect(result).toContain("orycms.config.ts");
    expect(result.startsWith("/")).toBe(true);
  });

  it("fromHome resolves from home directory", () => {
    const result = fromHome(".config");
    expect(result.startsWith("/")).toBe(true);
    expect(result).toContain(".config");
  });
});
