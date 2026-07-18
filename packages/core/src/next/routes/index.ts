import type { OryCMSRoute } from "../dispatcher";
import { authRoutes } from "./auth";
import { collectionRoutes } from "./collections";
import { mediaRoutes } from "./media";
import { userRoutes } from "./users";
import { roleRoutes } from "./roles";
import { settingsRoutes } from "./settings";
import { auditRoutes } from "./audit";
import { databaseRoutes } from "./database";
import { stubRoutes } from "./stubs";

/**
 * The full OryCMS API route table.
 *
 * Order matters: within a segment-count group, literal patterns are listed
 * before param patterns so the literal wins (e.g. `media/folders` before
 * `media/:id`). Each resource file keeps its own routes correctly ordered.
 */
export const ORYCMS_ROUTES: OryCMSRoute[] = [
  ...authRoutes,
  ...collectionRoutes,
  ...mediaRoutes,
  ...userRoutes,
  ...roleRoutes,
  ...settingsRoutes,
  ...auditRoutes,
  ...databaseRoutes,
  ...stubRoutes,
];
