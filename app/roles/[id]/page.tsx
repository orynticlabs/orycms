"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function RoleDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Roles">
      <PlaceholderPage
        eyebrow="Role configuration"
        title={`Role · ${params.id}`}
        description="Configure permissions for this role across all collections, content, and system features."
      />
    </AppShell>
  );
}
