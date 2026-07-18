"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { Topbar } from "@/components/dashboard/Topbar";
import { OryCMSSessionProvider } from "@/hooks";

const APP_VERSION = "v1.0.0";

export function AppShell({ children, section }: { children: React.ReactNode; section: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  return (
    <OryCMSSessionProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <AppSidebar collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onToggle={() => setCollapsed((c) => !c)}
            section={section}
            insightsOpen={insightsOpen}
            onInsightsToggle={() => setInsightsOpen((o) => !o)}
          />
          <div className="flex min-h-0 flex-1">
            <main className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1">{children}</div>
              <footer className="border-t border-border bg-surface/65">
                <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-6 py-3 text-[11.5px] text-muted-foreground lg:px-8">
                  <span>© 2026 OrynticLabs Private Limited. All rights reserved.</span>
                  <span>OryCMS {APP_VERSION}</span>
                </div>
              </footer>
            </main>
            <InsightsPanel open={insightsOpen} />
          </div>
        </div>
      </div>
    </OryCMSSessionProvider>
  );
}
