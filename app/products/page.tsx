"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function ProductsPage() {
  return (
    <AppShell section="Products">
      <PlaceholderPage
        eyebrow="Commerce"
        title="Products"
        description="Manage your product catalog — add, edit, and organize items, variants, and pricing."
      />
    </AppShell>
  );
}
