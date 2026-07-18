"use client";

import * as React from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OryCMSSessionUser {
  id: string;
  email: string;
}

export interface OryCMSSessionState {
  user: OryCMSSessionUser | null;
  roleName: string | null;
  /** Flat "resource:action" permission strings for the current role. */
  permissions: string[];
  loading: boolean;
  /** True once /auth/me has resolved (success or failure). */
  loaded: boolean;
  /** Re-fetch the session (e.g. after role change). */
  refresh: () => Promise<void>;
}

const DEFAULT_STATE: OryCMSSessionState = {
  user: null,
  roleName: null,
  permissions: [],
  loading: true,
  loaded: false,
  refresh: async () => {},
};

const OryCMSSessionContext = React.createContext<OryCMSSessionState>(DEFAULT_STATE);

// ── Provider ────────────────────────────────────────────────────────────────────

/**
 * Fetches /api/orycms/auth/me once and exposes the current user, role, and
 * permission set to the admin UI. This is the single client-side source of
 * truth for navigation/action gating. Enforcement still happens on the backend
 * (via @ory-cms/core/next route handlers); this only controls what the UI shows.
 */
export function OryCMSSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Omit<OryCMSSessionState, "refresh">>({
    user: null,
    roleName: null,
    permissions: [],
    loading: true,
    loaded: false,
  });

  const refresh = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/orycms/auth/me", {
        credentials: "include",
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) {
        setState({ user: null, roleName: null, permissions: [], loading: false, loaded: true });
        return;
      }
      const body = (await res.json()) as {
        data?: { user: OryCMSSessionUser; roleName: string | null; permissions: string[] };
      };
      const data = body.data;
      setState({
        user: data?.user ?? null,
        roleName: data?.roleName ?? null,
        permissions: data?.permissions ?? [],
        loading: false,
        loaded: true,
      });
    } catch {
      setState({ user: null, roleName: null, permissions: [], loading: false, loaded: true });
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = React.useMemo<OryCMSSessionState>(() => ({ ...state, refresh }), [state, refresh]);

  return <OryCMSSessionContext.Provider value={value}>{children}</OryCMSSessionContext.Provider>;
}

// ── Hooks ───────────────────────────────────────────────────────────────────────

export function useOryCMSSession(): OryCMSSessionState {
  return React.useContext(OryCMSSessionContext);
}

/**
 * Returns true when the current role may perform `resource:action`.
 * Mirrors the backend rule: an exact match OR `resource:manage` grants it.
 * While the session is still loading, returns false (fail-closed for UI).
 */
export function useOryCMSPermission(resource: string, action: string): boolean {
  const { permissions } = useOryCMSSession();
  return hasOryCMSClientPermission(permissions, resource, action);
}

/** Pure permission check against a flat permission list — matches backend semantics. */
export function hasOryCMSClientPermission(
  permissions: string[],
  resource: string,
  action: string,
): boolean {
  return permissions.includes(`${resource}:${action}`) || permissions.includes(`${resource}:manage`);
}

/**
 * Declarative gate for action UI (buttons, menu items). Renders `children` only
 * when the current role may perform `resource:action`; otherwise renders
 * `fallback` (default: nothing). The backend still enforces the permission —
 * this only hides UI the user can't use.
 *
 *   <Can resource="users" action="delete"><DeleteButton /></Can>
 */
export function Can({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactElement | null {
  const allowed = useOryCMSPermission(resource, action);
  return <>{allowed ? children : fallback}</>;
}
