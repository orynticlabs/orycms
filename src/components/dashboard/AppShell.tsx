"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { Topbar } from "@/components/dashboard/Topbar";

const APP_VERSION = "v1.0.0";

export function AppShell({
  children,
  section,
  showInsights = true,
}: {
  children: React.ReactNode;
  section: string;
  showInsights?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AppSidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onToggle={() => setCollapsed((c) => !c)} section={section} />
        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-y-auto">
            {children}
            <footer className="border-t border-border bg-surface/65">
              <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-6 py-3 text-[11.5px] text-muted-foreground lg:px-8">
                <span>© 2026 OrynticLabs Private Limited. All rights reserved.</span>
                <span>OryCMS {APP_VERSION}</span>
              </div>
            </footer>
          </main>
          {showInsights ? <InsightsPanel /> : null}
        </div>
      </div>
    </div>
  );
}
