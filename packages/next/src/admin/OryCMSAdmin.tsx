"use client";

import * as React from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Dashboard } from "@/components/dashboard/Dashboard";

export interface OryCMSAdminProps {
  /** Section label shown in the topbar (e.g. "Overview", "Collections"). */
  section?: string;
  /**
   * Section content. When omitted, the built-in Overview dashboard is rendered.
   * Consumers pass their own OryCMS feature component (e.g. OryCMSCollectionsAdminPage)
   * or compose custom content per route.
   */
  children?: React.ReactNode;
}

/**
 * The OryCMS admin dashboard shell — sidebar, topbar, session provider, and a
 * content area. Mount it from a consumer route (e.g. `app/admin/[[...seg]]/page.tsx`
 * or per-section pages) and pass the section component as `children`:
 *
 *   import { OryCMSAdmin, OryCMSCollectionsAdminPage } from "@ory-cms/next";
 *   export default function Page() {
 *     return (
 *       <OryCMSAdmin section="Collections">
 *         <OryCMSCollectionsAdminPage />
 *       </OryCMSAdmin>
 *     );
 *   }
 *
 * All data flows through the `@ory-cms/core/next` API handlers via fetch — the
 * session provider inside AppShell reads `/api/orycms/auth/me` for nav gating.
 */
export function OryCMSAdmin({ section = "Overview", children }: OryCMSAdminProps) {
  return <AppShell section={section}>{children ?? <Dashboard />}</AppShell>;
}
