import type { OryCMSRoute } from "../dispatcher";
import { authRoutes } from "./auth";

/** MVP API surface: first-run setup and authenticated sessions only. */
export const ORYCMS_ROUTES: OryCMSRoute[] = authRoutes;
