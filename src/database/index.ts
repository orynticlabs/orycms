export type * from "./adapter.types";
export type { OryCMSDatabaseAdapter } from "./adapter.interface";

export { OryCMSPostgreSQLAdapter } from "./adapters/postgresql.adapter";
export { OryCMSMySQLAdapter } from "./adapters/mysql.adapter";
export { OryCMSMongoDBAdapter } from "./adapters/mongodb.adapter";
export { OryCMSFirebaseAdapter } from "./adapters/firebase.adapter";
export { OryCMSOracleAdapter } from "./adapters/oracle.adapter";

export {
  registerOryCMSDatabaseAdapter,
  getOryCMSDatabaseAdapter,
  listOryCMSDatabaseAdapters,
} from "./registry";
