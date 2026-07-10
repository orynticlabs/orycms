"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function DatabasePage() {
  return (
    <AppShell section="Database">
      <PlaceholderPage
        eyebrow="Platform internals"
        title="Database"
        description="Browse table schemas, run migrations, and inspect the underlying database structure."
      />
    </AppShell>
  );
}
