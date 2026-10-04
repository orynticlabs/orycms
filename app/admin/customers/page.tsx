"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function CustomersPage() {
  return (
    <AppShell section="Customers">
      <PlaceholderPage
        eyebrow="Commerce"
        title="Customers"
        description="View customer profiles, order history, lifetime value, and segment your audience for targeting."
      />
    </AppShell>
  );
}
