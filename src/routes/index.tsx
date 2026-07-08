import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Northwind Commerce" },
      { name: "description", content: "Premium ecommerce command center for products, orders, customers, inventory, marketing, and analytics." },
      { property: "og:title", content: "Northwind Commerce — Command Center" },
      { property: "og:description", content: "A modern ecommerce admin workspace." },
    ],
  }),
  component: Index,
});

function Index() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onToggle={() => setCollapsed((c) => !c)} />
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 overflow-y-auto">
            <Dashboard />
          </main>
          <InsightsPanel />
        </div>
      </div>
    </div>
  );
}
