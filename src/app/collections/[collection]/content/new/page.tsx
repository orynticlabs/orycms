"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function NewContentEntryPage({
  params: paramsPromise,
}: {
  params: Promise<{ collection: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Collections">
      <PlaceholderPage
        eyebrow={`Collection · ${params.collection}`}
        title="New entry"
        description="Create a new content entry using the collection's field schema."
      />
    </AppShell>
  );
}
