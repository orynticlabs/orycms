import type { DatabaseProvider } from "../types";
import type { DatabaseProviderDefinition } from "./types";
import { postgresqlProvider } from "./providers/postgresql";
import { mysqlProvider } from "./providers/mysql";
import { mariadbProvider } from "./providers/mariadb";
import { sqliteProvider } from "./providers/sqlite";
import { mongodbProvider } from "./providers/mongodb";
import { supabaseProvider } from "./providers/supabase";
import { neonProvider } from "./providers/neon";
import { firebaseProvider } from "./providers/firebase";

export const DATABASE_PROVIDERS: Record<DatabaseProvider, DatabaseProviderDefinition> = {
  postgresql: postgresqlProvider,
  mysql: mysqlProvider,
  mariadb: mariadbProvider,
  sqlite: sqliteProvider,
  mongodb: mongodbProvider,
  supabase: supabaseProvider,
  neon: neonProvider,
  firebase: firebaseProvider,
};

export type { DatabaseProviderDefinition } from "./types";
