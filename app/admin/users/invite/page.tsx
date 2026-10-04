"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function InviteUserPage() {
  return (
    <AppShell section="Users">
      <PlaceholderPage
        eyebrow="Identity management"
        title="Invite user"
        description="Send a workspace invitation to a new admin user and assign their initial role."
      />
    </AppShell>
  );
}
