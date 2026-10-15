/**
 * Quotes a SQL identifier (a table or column name), escaping any embedded
 * quote character by doubling it. Collection and field names are checked
 * against a strict allowed pattern before they ever reach this point (see
 * `@/schema`'s validator), so this is a second layer: even if an unsafe name
 * somehow reached here, the embedded-quote escape stops it from closing the
 * identifier and adding anything of its own to the generated statement.
 */
export type OryCMSSqlDialect = "postgresql" | "mysql" | "mongodb" | "firebase" | "oracle";

export function quoteSqlIdentifier(name: string, dialect: OryCMSSqlDialect = "postgresql"): string {
  if (dialect === "mysql") return `\`${name.replace(/`/g, "``")}\``;
  return `"${name.replace(/"/g, '""')}"`;
}
