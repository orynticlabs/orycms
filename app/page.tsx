"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function Home() {
  return (
    <AppShell section="Overview">
      <Dashboard />
    </AppShell>
  );
}
