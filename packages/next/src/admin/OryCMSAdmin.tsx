"use client";

import * as React from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Dashboard } from "@/components/dashboard/Dashboard";

export interface OryCMSAdminProps {
  /** Section label shown in the dashboard header. */
  section?: string;
  /**
   * Section content. When omitted, the built-in Overview dashboard is rendered.
   * Consumers may compose custom dashboard content here.
   */
  children?: React.ReactNode;
}

/**
 * The OryCMS admin dashboard shell — sidebar, topbar, session provider, and a
 * content area. Mount it from `app/admin/page.tsx`.
 */
export function OryCMSAdmin({ section = "Overview", children }: OryCMSAdminProps) {
  return <AppShell section={section}>{children ?? <Dashboard />}</AppShell>;
}
