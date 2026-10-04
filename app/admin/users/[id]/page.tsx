"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function UserDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Users">
      <PlaceholderPage
        eyebrow="User profile"
        title={`User · ${params.id}`}
        description="View and update this user's profile, role assignments, and activity log."
      />
    </AppShell>
  );
}
