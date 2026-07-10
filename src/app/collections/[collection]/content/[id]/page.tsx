"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function EditContentEntryPage({
  params: paramsPromise,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Collections">
      <PlaceholderPage
        eyebrow={`Collection · ${params.collection}`}
        title={`Edit entry · ${params.id}`}
        description="Edit content entry fields, manage localization, and publish status."
      />
    </AppShell>
  );
}
