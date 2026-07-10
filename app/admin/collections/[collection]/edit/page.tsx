"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { OryCMSCollectionSchemaEditor } from "@/components/collections/OryCMSCollectionSchemaEditor";

export default function AdminEditCollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = use(params);
  return (
    <AppShell section="Collections">
      <OryCMSCollectionSchemaEditor mode="edit" collectionSlug={collection} />
    </AppShell>
  );
}
