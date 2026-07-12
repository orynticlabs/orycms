import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock factories (hoisted above all imports) ────────────────────────────────

const {
  pgConnect,
  pgQuery,
  pgEnd,
  PgClient,
  NeonClient,
  mysqlExecute,
  mysqlEnd,
  mysqlCreateConnection,
  sqliteGet,
  sqlitePrepare,
  sqliteClose,
  SqliteDatabase,
  mongoClose,
  mongoAsPromise,
  mongoCreateConnection,
  firebaseInitializeApp,
  firebaseCert,
  firebaseDeleteApp,
  firestoreListCollections,
  firebaseGetFirestore,
} = vi.hoisted(() => {
  // pg / neon ─────────────────────────────────────────────────────────────────
  const pgConnect = vi.fn().mockResolvedValue(undefined);
  const pgQuery = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
  const pgEnd = vi.fn().mockResolvedValue(undefined);
  // Regular functions required — arrow functions cannot be used as constructors
  const PgClient = vi.fn(function (this: Record<string, unknown>) {
    this["connect"] = pgConnect;
    this["query"] = pgQuery;
    this["end"] = pgEnd;
  });
  const NeonClient = vi.fn(function (this: Record<string, unknown>) {
    this["connect"] = pgConnect;
    this["query"] = pgQuery;
    this["end"] = pgEnd;
  });

  // mysql2/promise ─────────────────────────────────────────────────────────────
  const mysqlExecute = vi.fn().mockResolvedValue([[], []]);
  const mysqlEnd = vi.fn().mockResolvedValue(undefined);
  const mysqlCreateConnection = vi
    .fn()
    .mockResolvedValue({ execute: mysqlExecute, end: mysqlEnd });

  // better-sqlite3 ─────────────────────────────────────────────────────────────
  const sqliteGet = vi.fn().mockReturnValue({});
  const sqlitePrepare = vi.fn().mockReturnValue({ get: sqliteGet });
  const sqliteClose = vi.fn();
  const SqliteDatabase = vi.fn(function (this: Record<string, unknown>) {
    this["prepare"] = sqlitePrepare;
    this["close"] = sqliteClose;
  });

  // mongoose ────────────────────────────────────────────────────────────────────
  const mongoClose = vi.fn().mockResolvedValue(undefined);
  const mongoAsPromise = vi.fn().mockResolvedValue({ close: mongoClose });
  const mongoCreateConnection = vi.fn().mockReturnValue({ asPromise: mongoAsPromise });

  // firebase-admin ──────────────────────────────────────────────────────────────
  const firestoreListCollections = vi.fn().mockResolvedValue([]);
  const firebaseGetFirestore = vi
    .fn()
    .mockReturnValue({ listCollections: firestoreListCollections });
  const firebaseDeleteApp = vi.fn().mockResolvedValue(undefined);
  const firebaseCert = vi.fn().mockReturnValue({});
  const firebaseInitializeApp = vi.fn().mockReturnValue({ name: "orycms-test" });

  return {
    pgConnect,
    pgQuery,
    pgEnd,
    PgClient,
    NeonClient,
    mysqlExecute,
    mysqlEnd,
    mysqlCreateConnection,
    sqliteGet,
    sqlitePrepare,
    sqliteClose,
    SqliteDatabase,
    mongoClose,
    mongoAsPromise,
    mongoCreateConnection,
    firebaseInitializeApp,
    firebaseCert,
    firebaseDeleteApp,
    firestoreListCollections,
    firebaseGetFirestore,
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("pg", () => ({ Client: PgClient }));
vi.mock("@neondatabase/serverless", () => ({ Client: NeonClient }));
vi.mock("mysql2/promise", () => ({ createConnection: mysqlCreateConnection }));
vi.mock("better-sqlite3", () => ({ default: SqliteDatabase }));
vi.mock("mongoose", () => ({ default: { createConnection: mongoCreateConnection } }));
vi.mock("firebase-admin/app", () => ({
  initializeApp: firebaseInitializeApp,
  cert: firebaseCert,
  deleteApp: firebaseDeleteApp,
}));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: firebaseGetFirestore }));

// ── Subject under test ────────────────────────────────────────────────────────

import { testDatabaseConnection, getDatabaseConnectionError } from "../database/connection";
import type {
  PostgresqlWizardResult,
  MysqlWizardResult,
  MariadbWizardResult,
  SqliteWizardResult,
  MongodbWizardResult,
  SupabaseWizardResult,
  NeonWizardResult,
  FirebaseWizardResult,
  DatabaseWizardResult,
} from "../database/wizard";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PG: PostgresqlWizardResult = {
  provider: "postgresql",
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "secret",
  database: "mydb",
  ssl: false,
};

const MYSQL: MysqlWizardResult = {
  provider: "mysql",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "secret",
  database: "mydb",
};

const MARIADB: MariadbWizardResult = {
  provider: "mariadb",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "secret",
  database: "mydb",
};

const SQLITE: SqliteWizardResult = {
  provider: "sqlite",
  filePath: "./mydb.sqlite",
};

const MONGO: MongodbWizardResult = {
  provider: "mongodb",
  uri: "mongodb://localhost:27017/mydb",
};

const SUPABASE: SupabaseWizardResult = {
  provider: "supabase",
  url: "https://xyz.supabase.co",
  anonKey: "anon-key",
  serviceKey: "service-key",
};

const NEON: NeonWizardResult = {
  provider: "neon",
  databaseUrl: "postgresql://u:p@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require",
};

const FIREBASE: FirebaseWizardResult = {
  provider: "firebase",
  projectId: "my-project",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  clientEmail: "sa@my-project.iam.gserviceaccount.com",
};

const ALL_CONFIGS: DatabaseWizardResult[] = [
  PG, MYSQL, MARIADB, SQLITE, MONGO, SUPABASE, NEON, FIREBASE,
];

// ── Fetch stub (Supabase) ─────────────────────────────────────────────────────

function stubFetchOk(): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
}

function stubFetchFail(status: number, error?: Error): void {
  const mock = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue({ ok: false, status } as Response);
  vi.stubGlobal("fetch", mock);
}

// ── Global reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  pgConnect.mockResolvedValue(undefined);
  pgQuery.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  pgEnd.mockResolvedValue(undefined);

  mysqlExecute.mockResolvedValue([[], []]);
  mysqlEnd.mockResolvedValue(undefined);
  mysqlCreateConnection.mockResolvedValue({ execute: mysqlExecute, end: mysqlEnd });

  sqliteGet.mockReturnValue({});
  sqlitePrepare.mockReturnValue({ get: sqliteGet });

  mongoClose.mockResolvedValue(undefined);
  mongoAsPromise.mockResolvedValue({ close: mongoClose });
  mongoCreateConnection.mockReturnValue({ asPromise: mongoAsPromise });

  firestoreListCollections.mockResolvedValue([]);
  firebaseGetFirestore.mockReturnValue({ listCollections: firestoreListCollections });
  firebaseDeleteApp.mockResolvedValue(undefined);
  firebaseInitializeApp.mockReturnValue({ name: "orycms-test" });

  stubFetchOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── testDatabaseConnection — success ──────────────────────────────────────────

describe("testDatabaseConnection — success", () => {
  it.each(ALL_CONFIGS)("$provider returns ok:true", async (config) => {
    const result = await testDatabaseConnection(config);
    expect(result.ok).toBe(true);
  });

  it("postgresql — message includes the provider name", async () => {
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toContain("PostgreSQL");
  });

  it("postgresql — latencyMs is a non-negative number", async () => {
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("postgresql — ssl:true is forwarded to the Client", async () => {
    const result = await testDatabaseConnection({ ...PG, ssl: true });
    expect(result.ok).toBe(true);
    expect(PgClient).toHaveBeenCalledWith(expect.objectContaining({ ssl: true }));
  });

  it("mysql — createConnection receives correct params", async () => {
    await testDatabaseConnection(MYSQL);
    expect(mysqlCreateConnection).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 3306, database: "mydb" }),
    );
  });

  it("mariadb — uses the same mysql2 connector as mysql", async () => {
    const result = await testDatabaseConnection(MARIADB);
    expect(result.ok).toBe(true);
    expect(mysqlCreateConnection).toHaveBeenCalledOnce();
  });

  it("sqlite — calls prepare('SELECT 1').get() and then close()", async () => {
    await testDatabaseConnection(SQLITE);
    expect(sqlitePrepare).toHaveBeenCalledWith("SELECT 1");
    expect(sqliteGet).toHaveBeenCalled();
    expect(sqliteClose).toHaveBeenCalled();
  });

  it("mongodb — closes the connection after success", async () => {
    await testDatabaseConnection(MONGO);
    expect(mongoClose).toHaveBeenCalledOnce();
  });

  it("supabase — calls the REST /rest/v1/ endpoint with the service key", async () => {
    await testDatabaseConnection(SUPABASE);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE.url}/rest/v1/`,
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: SUPABASE.serviceKey }),
      }),
    );
  });

  it("neon — uses the @neondatabase/serverless Client with connectionString", async () => {
    const result = await testDatabaseConnection(NEON);
    expect(result.ok).toBe(true);
    expect(NeonClient).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: NEON.databaseUrl }),
    );
  });

  it("firebase — initializes a named app and deletes it after success", async () => {
    await testDatabaseConnection(FIREBASE);
    expect(firebaseInitializeApp).toHaveBeenCalledOnce();
    expect(firebaseDeleteApp).toHaveBeenCalledOnce();
  });

  it("firebase — passes credentials to cert()", async () => {
    await testDatabaseConnection(FIREBASE);
    expect(firebaseCert).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: FIREBASE.projectId,
        privateKey: FIREBASE.privateKey,
        clientEmail: FIREBASE.clientEmail,
      }),
    );
  });
});

// ── testDatabaseConnection — failure ──────────────────────────────────────────

describe("testDatabaseConnection — failure", () => {
  it("postgresql — ECONNREFUSED returns ok:false with the code", async () => {
    pgConnect.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ECONNREFUSED");
      expect(result.error).toContain("Connection refused");
    }
  });

  it("postgresql — ENOTFOUND returns ok:false", async () => {
    pgConnect.mockRejectedValueOnce(
      Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }),
    );
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Host not found");
  });

  it("postgresql — wrong password (28P01) returns ok:false", async () => {
    pgConnect.mockRejectedValueOnce(
      Object.assign(new Error("password authentication failed"), { code: "28P01" }),
    );
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Password authentication failed");
  });

  it("postgresql — bad db name (3D000) returns ok:false", async () => {
    pgConnect.mockRejectedValueOnce(
      Object.assign(new Error("database does not exist"), { code: "3D000" }),
    );
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Database does not exist");
  });

  it("mysql — ER_ACCESS_DENIED_ERROR returns ok:false", async () => {
    mysqlCreateConnection.mockRejectedValueOnce(
      Object.assign(new Error("Access denied for user"), { code: "ER_ACCESS_DENIED_ERROR" }),
    );
    const result = await testDatabaseConnection(MYSQL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Access denied");
  });

  it("mysql — ER_BAD_DB_ERROR returns ok:false", async () => {
    mysqlCreateConnection.mockRejectedValueOnce(
      Object.assign(new Error("Unknown database"), { code: "ER_BAD_DB_ERROR" }),
    );
    const result = await testDatabaseConnection(MYSQL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Database does not exist");
  });

  it("mariadb — connection failure returns ok:false", async () => {
    mysqlCreateConnection.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    const result = await testDatabaseConnection(MARIADB);
    expect(result.ok).toBe(false);
  });

  it("sqlite — ENOENT from constructor returns ok:false", async () => {
    SqliteDatabase.mockImplementationOnce(function () {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    });
    const result = await testDatabaseConnection(SQLITE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("File not found");
  });

  it("sqlite — EACCES from constructor returns ok:false", async () => {
    SqliteDatabase.mockImplementationOnce(function () {
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    });
    const result = await testDatabaseConnection(SQLITE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Permission denied");
  });

  it("mongodb — ECONNREFUSED returns ok:false", async () => {
    mongoAsPromise.mockRejectedValueOnce(
      Object.assign(new Error("failed to connect"), { code: "ECONNREFUSED" }),
    );
    const result = await testDatabaseConnection(MONGO);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Connection refused");
  });

  it("mongodb — MongoServerSelectionError returns ok:false with helpful message", async () => {
    const err = Object.assign(new Error("No servers available"), {
      name: "MongoServerSelectionError",
    });
    mongoAsPromise.mockRejectedValueOnce(err);
    const result = await testDatabaseConnection(MONGO);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("MongoDB server selection failed");
  });

  it("supabase — HTTP 401 returns ok:false with code HTTP_401", async () => {
    stubFetchFail(401);
    const result = await testDatabaseConnection(SUPABASE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HTTP_401");
  });

  it("supabase — HTTP 500 returns ok:false with code HTTP_500", async () => {
    stubFetchFail(500);
    const result = await testDatabaseConnection(SUPABASE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HTTP_500");
  });

  it("supabase — fetch ECONNREFUSED returns ok:false", async () => {
    stubFetchFail(0, Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
    const result = await testDatabaseConnection(SUPABASE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Connection refused");
  });

  it("neon — connection failure returns ok:false", async () => {
    pgConnect.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    const result = await testDatabaseConnection(NEON);
    expect(result.ok).toBe(false);
  });

  it("firebase — listCollections failure returns ok:false", async () => {
    firestoreListCollections.mockRejectedValueOnce(
      Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" }),
    );
    const result = await testDatabaseConnection(FIREBASE);
    expect(result.ok).toBe(false);
  });

  it("firebase — deleteApp is called even when listCollections throws", async () => {
    firestoreListCollections.mockRejectedValueOnce(new Error("auth error"));
    await testDatabaseConnection(FIREBASE);
    expect(firebaseDeleteApp).toHaveBeenCalledOnce();
  });

  it("never throws — always returns a result object", async () => {
    pgConnect.mockRejectedValueOnce(new Error("unexpected crash"));
    await expect(testDatabaseConnection(PG)).resolves.toBeDefined();
  });
});

// ── testDatabaseConnection — package not installed ────────────────────────────

describe("testDatabaseConnection — package not installed", () => {
  const moduleErr = (code: string) =>
    Object.assign(new Error(`Cannot find module`), { code });

  it("ERR_MODULE_NOT_FOUND returns PKG_NOT_FOUND with install hint", async () => {
    pgConnect.mockRejectedValueOnce(moduleErr("ERR_MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(PG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PKG_NOT_FOUND");
      expect(result.error).toContain("npm install");
    }
  });

  it("MODULE_NOT_FOUND (CJS fallback) also maps to PKG_NOT_FOUND", async () => {
    mysqlCreateConnection.mockRejectedValueOnce(moduleErr("MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(MYSQL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PKG_NOT_FOUND");
  });

  it("postgresql PKG_NOT_FOUND mentions pg", async () => {
    pgConnect.mockRejectedValueOnce(moduleErr("ERR_MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(PG);
    if (!result.ok) expect(result.error).toContain("pg");
  });

  it("mysql PKG_NOT_FOUND mentions mysql2", async () => {
    mysqlCreateConnection.mockRejectedValueOnce(moduleErr("ERR_MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(MYSQL);
    if (!result.ok) expect(result.error).toContain("mysql2");
  });

  it("mariadb PKG_NOT_FOUND mentions mysql2", async () => {
    mysqlCreateConnection.mockRejectedValueOnce(moduleErr("ERR_MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(MARIADB);
    if (!result.ok) expect(result.error).toContain("mysql2");
  });

  it("sqlite PKG_NOT_FOUND mentions better-sqlite3", async () => {
    SqliteDatabase.mockImplementationOnce(function () {
      throw moduleErr("ERR_MODULE_NOT_FOUND");
    });
    const result = await testDatabaseConnection(SQLITE);
    if (!result.ok) expect(result.error).toContain("better-sqlite3");
  });

  it("mongodb PKG_NOT_FOUND mentions mongoose", async () => {
    mongoCreateConnection.mockImplementationOnce(function () {
      throw moduleErr("ERR_MODULE_NOT_FOUND");
    });
    const result = await testDatabaseConnection(MONGO);
    if (!result.ok) expect(result.error).toContain("mongoose");
  });

  it("neon PKG_NOT_FOUND mentions @neondatabase/serverless", async () => {
    pgConnect.mockRejectedValueOnce(moduleErr("ERR_MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(NEON);
    if (!result.ok) expect(result.error).toContain("@neondatabase/serverless");
  });

  it("firebase PKG_NOT_FOUND mentions firebase-admin", async () => {
    firestoreListCollections.mockRejectedValueOnce(moduleErr("ERR_MODULE_NOT_FOUND"));
    const result = await testDatabaseConnection(FIREBASE);
    if (!result.ok) expect(result.error).toContain("firebase-admin");
  });
});

// ── testDatabaseConnection — timeout ─────────────────────────────────────────
//
// Real timers, timeoutMs:1 — no need for vi.useFakeTimers().
// A never-resolving promise and a 1ms deadline is enough to exercise the
// Promise.race / clearTimeout path without waiting for wall-clock seconds.

describe("testDatabaseConnection — timeout", () => {
  it("returns ETIMEDOUT when the connection hangs past timeoutMs", async () => {
    pgConnect.mockReturnValueOnce(new Promise(() => {})); // never resolves
    const result = await testDatabaseConnection(PG, { timeoutMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ETIMEDOUT");
      expect(result.error).toContain("timed out");
    }
  });

  it("succeeds when the connection resolves before the timeout fires", async () => {
    // Default mock resolves immediately — 5s timeout should never fire
    const result = await testDatabaseConnection(PG, { timeoutMs: 5_000 });
    expect(result.ok).toBe(true);
  });

  it("timeout applies across providers — mongodb", async () => {
    mongoAsPromise.mockReturnValueOnce(new Promise(() => {}));
    const result = await testDatabaseConnection(MONGO, { timeoutMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ETIMEDOUT");
  });

  it("timeout applies across providers — neon", async () => {
    pgConnect.mockReturnValueOnce(new Promise(() => {}));
    const result = await testDatabaseConnection(NEON, { timeoutMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ETIMEDOUT");
  });
});

// ── getDatabaseConnectionError ────────────────────────────────────────────────

describe("getDatabaseConnectionError", () => {
  const mkErr = (code: string, msg = "raw message") =>
    Object.assign(new Error(msg), { code });

  const nodeCodes: Array<[string, string]> = [
    ["ECONNREFUSED", "Connection refused"],
    ["ETIMEDOUT", "timed out"],
    ["CONNECT_TIMEOUT", "timed out"],
    ["ENOTFOUND", "Host not found"],
    ["ENOENT", "File not found"],
    ["EACCES", "Permission denied"],
    ["EPERM", "Permission denied"],
  ];

  it.each(nodeCodes)("code %s → contains '%s'", (code, hint) => {
    expect(getDatabaseConnectionError(mkErr(code))).toContain(hint);
  });

  const dbCodes: Array<[string, string]> = [
    ["ER_ACCESS_DENIED_ERROR", "Access denied"],
    ["ER_BAD_DB_ERROR", "Database does not exist"],
    ["28P01", "Password authentication failed"],
    ["3D000", "Database does not exist"],
  ];

  it.each(dbCodes)("DB code %s → contains '%s'", (code, hint) => {
    expect(getDatabaseConnectionError(mkErr(code))).toContain(hint);
  });

  it("MySQL sqlState '28000' → authentication failed", () => {
    const err = Object.assign(new Error("auth fail"), { sqlState: "28000" });
    expect(getDatabaseConnectionError(err)).toContain("Authentication failed");
  });

  it("MySQL sqlState '28P01' → authentication failed", () => {
    const err = Object.assign(new Error("auth fail"), { sqlState: "28P01" });
    expect(getDatabaseConnectionError(err)).toContain("Authentication failed");
  });

  it("MongoServerSelectionError → includes the error message", () => {
    const err = Object.assign(new Error("No servers available"), {
      name: "MongoServerSelectionError",
    });
    const msg = getDatabaseConnectionError(err);
    expect(msg).toContain("MongoDB server selection failed");
    expect(msg).toContain("No servers available");
  });

  it("unknown error code → falls back to error.message", () => {
    expect(getDatabaseConnectionError(mkErr("EWEIRD", "something weird"))).toBe(
      "something weird",
    );
  });

  it("plain Error with no code → returns error.message", () => {
    expect(getDatabaseConnectionError(new Error("plain error"))).toBe("plain error");
  });

  it("non-Error string → returns String(value)", () => {
    expect(getDatabaseConnectionError("raw string error")).toBe("raw string error");
  });

  it("number → returns String(value)", () => {
    expect(getDatabaseConnectionError(42)).toBe("42");
  });

  it("null → returns 'null'", () => {
    expect(getDatabaseConnectionError(null)).toBe("null");
  });
});
