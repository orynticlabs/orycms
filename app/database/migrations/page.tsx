"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function MigrationsPage() {
  return (
    <AppShell section="Database">
      <PlaceholderPage
        eyebrow="Database · Migrations"
        title="Migrations"
        description="View applied and pending schema migrations, and run or rollback migration batches."
      />
    </AppShell>
  );
}
