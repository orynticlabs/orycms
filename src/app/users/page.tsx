"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function UsersPage() {
  return (
    <AppShell section="Users">
      <PlaceholderPage
        eyebrow="Identity management"
        title="Users"
        description="Manage admin users, their roles, and access permissions across the workspace."
      />
    </AppShell>
  );
}
