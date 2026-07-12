import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

/** Resolve a path relative to the current working directory. */
export function fromCwd(...parts: string[]): string {
  return resolve(process.cwd(), ...parts);
}

/** Resolve a path relative to the user's home directory. */
export function fromHome(...parts: string[]): string {
  return resolve(homedir(), ...parts);
}

/** Return true when a file or directory exists. */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Create a directory (and all parents) if it does not already exist. */
export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Read and parse a JSON file.
 * Throws with a descriptive message when the file is absent or malformed.
 */
export function readJsonFile<T = unknown>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid JSON in file: ${path}`);
  }
}

/** Write a value as pretty-printed JSON to a file. Creates parent directories if needed. */
export function writeJsonFile(path: string, data: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** Read a file as a UTF-8 string. Throws when absent. */
export function readTextFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return readFileSync(path, "utf-8");
}

/** Write a UTF-8 string to a file. Creates parent directories if needed. */
export function writeTextFile(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content, "utf-8");
}
