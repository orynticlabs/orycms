export const HOOK_DEFAULT_TIMEOUT_MS = 5_000;

export const HOOK_EVENTS = {
  // Collection
  BEFORE_COLLECTION_CREATE: "beforeCollectionCreate",
  AFTER_COLLECTION_CREATE: "afterCollectionCreate",
  BEFORE_COLLECTION_UPDATE: "beforeCollectionUpdate",
  AFTER_COLLECTION_UPDATE: "afterCollectionUpdate",
  BEFORE_COLLECTION_DELETE: "beforeCollectionDelete",
  AFTER_COLLECTION_DELETE: "afterCollectionDelete",
  // Content
  BEFORE_CREATE: "beforeCreate",
  AFTER_CREATE: "afterCreate",
  BEFORE_UPDATE: "beforeUpdate",
  AFTER_UPDATE: "afterUpdate",
  BEFORE_DELETE: "beforeDelete",
  AFTER_DELETE: "afterDelete",
  BEFORE_PUBLISH: "beforePublish",
  AFTER_PUBLISH: "afterPublish",
  BEFORE_UNPUBLISH: "beforeUnpublish",
  AFTER_UNPUBLISH: "afterUnpublish",
  // Media
  BEFORE_UPLOAD: "beforeUpload",
  AFTER_UPLOAD: "afterUpload",
  BEFORE_MEDIA_DELETE: "beforeMediaDelete",
  AFTER_MEDIA_DELETE: "afterMediaDelete",
  // Auth
  BEFORE_LOGIN: "beforeLogin",
  AFTER_LOGIN: "afterLogin",
  BEFORE_LOGOUT: "beforeLogout",
  AFTER_LOGOUT: "afterLogout",
  // Migration
  BEFORE_MIGRATION: "beforeMigration",
  AFTER_MIGRATION: "afterMigration",
  BEFORE_ROLLBACK: "beforeRollback",
  AFTER_ROLLBACK: "afterRollback",
} as const;
