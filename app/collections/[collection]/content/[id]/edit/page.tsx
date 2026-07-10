"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { OryCMSCollectionContentPage } from "@/components/content/OryCMSCollectionContentPage";

export default function EditContentEntryPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = use(params);
  return (
    <AppShell section="Collections">
      <OryCMSCollectionContentPage collectionSlug={collection} mode="edit" entryId={id} />
    </AppShell>
  );
}
