// ANSI escape helpers — no external dependency needed
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

const NO_COLOR = process.env["NO_COLOR"] !== undefined || !process.stdout.isTTY;

function color(code: string, text: string): string {
  return NO_COLOR ? text : `${code}${text}${C.reset}`;
}

function write(stream: NodeJS.WriteStream, line: string): void {
  stream.write(line + "\n");
}

export const logger = {
  info(msg: string): void {
    write(process.stdout, `${color(C.blue, "ℹ")} ${msg}`);
  },

  success(msg: string): void {
    write(process.stdout, `${color(C.green + C.bold, "✓")} ${msg}`);
  },

  warn(msg: string): void {
    write(process.stderr, `${color(C.yellow, "⚠")} ${msg}`);
  },

  error(msg: string): void {
    write(process.stderr, `${color(C.red, "✗")} ${msg}`);
  },

  debug(msg: string): void {
    if (!process.env["DEBUG"]) return;
    write(process.stderr, `${color(C.gray, "[debug]")} ${color(C.dim, msg)}`);
  },

  /** Print a blank line. */
  blank(): void {
    write(process.stdout, "");
  },

  /**
   * Print a simple two-column table.
   * @param rows Array of [key, value] pairs.
   */
  table(rows: Array<[string, string]>): void {
    if (rows.length === 0) return;
    const keyWidth = Math.max(...rows.map(([k]) => k.length));
    for (const [k, v] of rows) {
      const padded = k.padEnd(keyWidth);
      write(process.stdout, `  ${color(C.cyan, padded)}  ${v}`);
    }
  },
};

export type Logger = typeof logger;
