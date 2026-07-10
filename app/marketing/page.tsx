"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function MarketingPage() {
  return (
    <AppShell section="Marketing">
      <PlaceholderPage
        eyebrow="Growth"
        title="Marketing"
        description="Run campaigns, manage coupons, configure email flows, and track promotional performance."
      />
    </AppShell>
  );
}
