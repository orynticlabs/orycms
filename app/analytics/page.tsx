"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function AnalyticsPage() {
  return (
    <AppShell section="Analytics">
      <PlaceholderPage
        eyebrow="Growth"
        title="Analytics"
        description="Deep-dive into revenue trends, traffic sources, conversion funnels, and cohort analysis."
      />
    </AppShell>
  );
}
