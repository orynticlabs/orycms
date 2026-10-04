"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function RolesPage() {
  return (
    <AppShell section="Roles">
      <PlaceholderPage
        eyebrow="Access control"
        title="Roles"
        description="Define roles and granular permissions to control what each team member can see and do."
      />
    </AppShell>
  );
}
