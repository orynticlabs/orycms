"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, PanelLeft } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { OryCMSSessionProvider, useOryCMSSession } from "../../hooks/use-orycms-session";

function Shell({ children, section }: { children: React.ReactNode; section: string }) {
  const router = useRouter();
  const { user, loaded } = useOryCMSSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (loaded && !user) router.replace("/login?from=/admin");
  }, [loaded, user, router]);

  const logout = async () => {
    await fetch("/api/orycms/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (!loaded) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading dashboard…</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar collapsed={collapsed} />
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <button onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar" className="rounded-md p-2 hover:bg-accent">
            <PanelLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">{section}</span>
          <span className="ml-auto hidden text-sm text-muted-foreground sm:block">{user.email}</span>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export function AppShell(props: { children: React.ReactNode; section: string }) {
  return <OryCMSSessionProvider><Shell {...props} /></OryCMSSessionProvider>;
}
