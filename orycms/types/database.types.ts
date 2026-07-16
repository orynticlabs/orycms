export type OryCMSColumnType =
  | "varchar"
  | "text"
  | "integer"
  | "bigint"
  | "float"
  | "decimal"
  | "boolean"
  | "timestamp"
  | "date"
  | "json"
  | "jsonb"
  | "uuid";

export interface OryCMSTableColumn {
  name: string;
  type: OryCMSColumnType;
  nullable: boolean;
  defaultValue?: string;
  isPrimary: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

export interface OryCMSTableIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface OryCMSDatabaseTable {
  name: string;
  schema: string;
  rowCount: number;
  columns: OryCMSTableColumn[];
  indexes: OryCMSTableIndex[];
}

export type OryCMSMigrationStatus = "pending" | "applied" | "failed";

export interface OryCMSMigration {
  id: string;
  name: string;
  status: OryCMSMigrationStatus;
  appliedAt?: string;
  batch: number;
}
