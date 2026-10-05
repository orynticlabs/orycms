import type { OryCMSRoute } from "../dispatcher";
import { authRoutes } from "./auth";
import { authTokenRoutes } from "./auth-tokens";

/** MVP API surface: first-run setup, authenticated sessions, and the token-based
 * auth flows (refresh/forgot-password/reset-password/activate/invite/accept-invite). */
export const ORYCMS_ROUTES: OryCMSRoute[] = [...authRoutes, ...authTokenRoutes];
