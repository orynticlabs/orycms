/**
 * Minimal ambient declarations for optional peer dependencies.
 *
 * These packages are not installed inside the CLI itself — they live in the
 * user's project and are loaded lazily at runtime via dynamic import.
 * The declarations here type-check only what connection.ts actually uses.
 */

declare module "mysql2/promise" {
  interface Connection {
    execute(sql: string, params?: unknown[]): Promise<unknown>;
    end(): Promise<void>;
  }
  export function createConnection(config: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    multipleStatements?: boolean;
  }): Promise<Connection>;
}

declare module "better-sqlite3" {
  interface Statement {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
    all(...params: unknown[]): unknown[];
  }
  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
  }
  type DatabaseConstructor = new (path: string, options?: object) => Database;
  const Database: DatabaseConstructor;
  export default Database;
}

declare module "mongoose" {
  interface MongooseConnection {
    asPromise(): Promise<MongooseConnection>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any;
    close(): Promise<void>;
  }
  const mongoose: {
    createConnection(uri: string): MongooseConnection;
  };
  export default mongoose;
}

declare module "@neondatabase/serverless" {
  interface NeonClient {
    connect(): Promise<void>;
    query(sql: string): Promise<{ rows: unknown[] }>;
    end(): Promise<void>;
  }
  type NeonClientConstructor = new (config: {
    connectionString?: string;
    [key: string]: unknown;
  }) => NeonClient;
  export const Client: NeonClientConstructor;
}

declare module "firebase-admin/app" {
  interface FirebaseApp {
    name: string;
  }
  interface ServiceAccount {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  }
  export function cert(serviceAccount: ServiceAccount): object;
  export function initializeApp(options: { credential: object }, name?: string): FirebaseApp;
  export function deleteApp(app: FirebaseApp): Promise<void>;
}

declare module "firebase-admin/firestore" {
  interface FirebaseApp {
    name: string;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyData = Record<string, any>;
  interface DocumentSnapshot {
    data(): AnyData | undefined;
  }
  interface QuerySnapshot {
    docs: DocumentSnapshot[];
  }
  interface DocumentReference {
    set(data: AnyData): Promise<void>;
    get(): Promise<DocumentSnapshot>;
    delete(): Promise<void>;
  }
  interface CollectionReference {
    doc(id: string): DocumentReference;
    orderBy(field: string, dir?: "asc" | "desc"): { get(): Promise<QuerySnapshot> };
  }
  interface Firestore {
    listCollections(): Promise<unknown[]>;
    collection(name: string): CollectionReference;
  }
  export function getFirestore(app: FirebaseApp): Firestore;
}
