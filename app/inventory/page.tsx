"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function InventoryPage() {
  return (
    <AppShell section="Inventory">
      <PlaceholderPage
        eyebrow="Commerce"
        title="Inventory"
        description="Track stock levels, manage warehouse locations, and configure low-stock alerts across all SKUs."
      />
    </AppShell>
  );
}
