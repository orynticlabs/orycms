"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside className={`hidden shrink-0 border-r border-border bg-sidebar p-3 lg:block ${collapsed ? "w-[68px]" : "w-[232px]"}`}>
      <div className="flex h-11 items-center gap-3 px-2 font-semibold">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">O</span>
        {!collapsed && <span>OryCMS</span>}
      </div>
      <nav className="mt-4">
        <Link href="/admin" className="flex h-10 items-center gap-3 rounded-lg bg-sidebar-accent px-3 text-sm font-medium">
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
      </nav>
    </aside>
  );
}
