"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function NewRolePage() {
  return (
    <AppShell section="Roles">
      <PlaceholderPage
        eyebrow="Access control"
        title="Create role"
        description="Define a new role with a custom name and permission matrix."
      />
    </AppShell>
  );
}
